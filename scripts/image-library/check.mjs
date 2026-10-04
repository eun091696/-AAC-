// CI 검사: 단어 목록이 사전 규칙에 맞는지, 앱 목록 파일이 실제 그림 파일을 가리키는지
import fs from 'node:fs';
import path from 'node:path';
import { APP_ASSETS, SERVER_LIBRARY, loadWords } from './common.mjs';

const words = loadWords(); // 다의어 뜻·필수 값 위반이면 여기서 오류
const ids = new Set();
for (const w of words) {
  const key = `${w.label}|${w.kind}|${w.meaning}`;
  if (ids.has(key)) throw new Error(`중복 단어: ${key}`);
  ids.add(key);
}
const manifest = JSON.parse(fs.readFileSync(path.join(SERVER_LIBRARY, 'approved.json'), 'utf8'));
for (const e of manifest.entries ?? []) {
  if (!e.reviewedBy || !Date.parse(e.reviewedAt)) throw new Error(`검수 정보 없음: ${e.label}`);
  for (const f of [path.join(APP_ASSETS, e.file), path.join(SERVER_LIBRARY, e.file)]) if (!fs.existsSync(f)) throw new Error(`그림 파일 없음: ${f}`);
}
console.log(`image library: 단어 ${words.length}개, 등록된 그림 ${manifest.entries?.length ?? 0}개 확인`);
