// 검수에서 고른 그림 등록: 앱용 256px WebP + 서버용 512px WebP + 원본 보관 + 목록 갱신
// npm run images:approve -- --reviewer 안창은
import fs from 'node:fs';
import path from 'node:path';
import { APP_ASSETS, APP_INDEX, CANDIDATES, ORIGINALS, ROOT, SELECTIONS, SERVER_LIBRARY, loadWords, parseArgs, require } from './common.mjs';

const args = parseArgs(process.argv.slice(2));
if (!args.reviewer || args.reviewer === true) { console.error('검수자 이름이 필요해요: --reviewer 이름'); process.exit(1); }
if (!fs.existsSync(SELECTIONS)) { console.error('선택한 그림이 없어요. 먼저 npm run images:review 에서 고르고 저장하세요.'); process.exit(1); }
const sharp = require('sharp');
const selections = JSON.parse(fs.readFileSync(SELECTIONS, 'utf8'));
const byId = new Map(loadWords().map((w) => [w.id, w]));
const manifestPath = path.join(SERVER_LIBRARY, 'approved.json');
const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
manifest.entries = Array.isArray(manifest.entries) ? manifest.entries : [];
for (const d of [APP_ASSETS, ORIGINALS, SERVER_LIBRARY]) fs.mkdirSync(d, { recursive: true });

const square = (src, size) => sharp(src).resize(size, size, { fit: 'contain', background: '#ffffff' }).flatten({ background: '#ffffff' }).webp({ quality: 82 });
const now = new Date().toISOString();
let added = 0;
for (const [id, file] of Object.entries(selections)) {
  const w = byId.get(id);
  if (!w) { console.log(`- 건너뜀: 단어 목록에 없는 id ${id}`); continue; }
  const src = path.join(CANDIDATES, id, file);
  const meta = JSON.parse(fs.readFileSync(path.join(CANDIDATES, id, 'meta.json'), 'utf8'));
  await square(src, 256).toFile(path.join(APP_ASSETS, `${id}.webp`));
  await square(src, 512).toFile(path.join(SERVER_LIBRARY, `${id}.webp`));
  fs.copyFileSync(src, path.join(ORIGINALS, `${id}.png`));
  const entry = { id, label: w.label, kind: w.kind, visualMeaning: w.meaning, builtin: w.batch === 1, file: `${id}.webp`, source: 'ai', model: meta.model, promptVersion: meta.promptVersion, reviewedBy: String(args.reviewer), reviewedAt: now };
  const i = manifest.entries.findIndex((e) => e.id === id);
  if (i >= 0) manifest.entries[i] = entry; else manifest.entries.push(entry);
  added++;
  console.log(`✓ ${w.label} (${(fs.statSync(path.join(APP_ASSETS, `${id}.webp`)).size / 1024).toFixed(1)}KB)`);
}
manifest.entries.sort((a, b) => a.label.localeCompare(b.label, 'ko'));
fs.writeFileSync(manifestPath, JSON.stringify(manifest, null, 2) + '\n');

// 앱 목록 파일 다시 만들기 (React Native는 이미지를 require로 고정해야 해서 코드로 생성)
const lines = manifest.entries.filter((e) => fs.existsSync(path.join(APP_ASSETS, e.file))).map((e) =>
  `  { id: ${JSON.stringify(e.id)}, label: ${JSON.stringify(e.label)}, kind: ${JSON.stringify(e.kind)}, visualMeaning: ${JSON.stringify(e.visualMeaning)}, builtin: ${e.builtin === true}, asset: require('../../assets/library/${e.file}') },`);
fs.writeFileSync(APP_INDEX, `// 자동 생성 파일: npm run images:approve 가 다시 만듦. 직접 고치지 마세요.
import type { ImageSourcePropType } from 'react-native';

export type BundledImage = { id: string; label: string; kind: 'n' | 'p'; visualMeaning: string; builtin: boolean; asset: ImageSourcePropType };

export const BUNDLED_IMAGES: BundledImage[] = [
${lines.join('\n')}
];
`);
const total = fs.readdirSync(APP_ASSETS).filter((f) => f.endsWith('.webp')).reduce((s, f) => s + fs.statSync(path.join(APP_ASSETS, f)).size, 0);
console.log(`\n등록 ${added}개 · 앱 라이브러리 총 ${manifest.entries.length}개, ${(total / 1024 / 1024).toFixed(2)}MB`);
console.log(`원본은 ${path.relative(ROOT, ORIGINALS)} 에 있어요 (git 제외). 나중에 S3에 올려 보관해요.`);
