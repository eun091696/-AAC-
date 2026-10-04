// 그림 라이브러리 공통: 경로, 단어 목록 해석, .env 읽기
import { createRequire } from 'node:module';
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

export const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
export const WORK = path.join(ROOT, '.image-work'); // 원본·후보 (git 제외, 나중에 S3 보관)
export const CANDIDATES = path.join(WORK, 'candidates');
export const ORIGINALS = path.join(WORK, 'originals');
export const SELECTIONS = path.join(WORK, 'selections.json');
export const APP_ASSETS = path.join(ROOT, 'assets', 'library'); // 앱에 포함되는 256px WebP
export const SERVER_LIBRARY = path.join(ROOT, 'server', 'library'); // 서버 조회용 512px WebP
export const APP_INDEX = path.join(ROOT, 'src', 'lib', 'libraryImages.generated.ts');
export const require = createRequire(import.meta.url);

/** 같은 단어·종류·뜻이면 항상 같은 id (파일 이름은 ASCII로) */
export const wordId = (w) => `${w.kind}_${crypto.createHash('sha1').update(`${w.label}|${w.kind}|${w.meaning}`).digest('hex').slice(0, 10)}`;

export function loadWords({ batch, only } = {}) {
  const concepts = JSON.parse(fs.readFileSync(path.join(ROOT, 'shared', 'visualConcepts.json'), 'utf8'));
  const list = JSON.parse(fs.readFileSync(path.join(ROOT, 'scripts', 'image-library', 'words.json'), 'utf8')).words;
  const out = [];
  for (const raw of list) {
    const w = { ...raw };
    if (w.kind === 'n' && !w.meaning) {
      const c = concepts.nouns[w.label];
      if (!c) throw new Error(`"${w.label}": 사전(shared/visualConcepts.json)에 없는 명사는 meaning/scene을 직접 적어야 해요.`);
      w.meaning = c.meaning;
      w.scene = w.scene || c.scene;
    }
    if (w.kind === 'n' && concepts.ambiguous[w.label] && !concepts.ambiguous[w.label].includes(w.meaning)) {
      throw new Error(`"${w.label}"은 다의어예요. meaning을 사전 선택지 중 하나로 적어 주세요: ${concepts.ambiguous[w.label].join(' / ')}`);
    }
    if (!w.meaning || !w.scene) throw new Error(`"${w.label}": meaning과 scene이 필요해요.`);
    w.id = wordId(w);
    w.ambiguous = !!concepts.ambiguous[w.label];
    out.push(w);
  }
  return out.filter((w) => (batch ? w.batch === batch : true) && (only ? only.includes(w.label) : true));
}

/** server/.env 를 읽어 환경 변수로 (값은 출력하지 않음) */
export function loadEnv() {
  const file = path.join(ROOT, 'server', '.env');
  if (!fs.existsSync(file)) return;
  for (const line of fs.readFileSync(file, 'utf8').split('\n')) {
    const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/);
    if (m && !process.env[m[1]]) process.env[m[1]] = m[2].replace(/^["']|["']$/g, '');
  }
}

export function parseArgs(argv) {
  const a = {};
  for (let i = 0; i < argv.length; i++) {
    const k = argv[i];
    if (!k.startsWith('--')) continue;
    const next = argv[i + 1];
    if (next === undefined || next.startsWith('--')) a[k.slice(2)] = true;
    else { a[k.slice(2)] = next; i++; }
  }
  return a;
}
