// 앱 문장이 바뀌었는데 음성을 다시 만들지 않았는지 검사 (모델 없이 CI에서 실행)
import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';

const ROOT = path.resolve(import.meta.dirname, '../..');
execFileSync('npx', ['tsc', 'scripts/voice-library/phrases.ts', '--outDir', '.tts-check', '--module', 'commonjs', '--target', 'es2020', '--skipLibCheck', '--ignoreConfig'], { cwd: ROOT });
const phrases = JSON.parse(execFileSync('node', ['.tts-check/scripts/voice-library/phrases.js'], { cwd: ROOT, encoding: 'utf8' }));
fs.rmSync(path.join(ROOT, '.tts-check'), { recursive: true, force: true });
const { clips } = JSON.parse(fs.readFileSync(path.join(ROOT, 'scripts/voice-library/manifest.json'), 'utf8'));
const missing = phrases.filter((t) => !clips[t] || !fs.existsSync(path.join(ROOT, 'assets/voice', clips[t])));
if (missing.length) {
  console.error(`음성 없는 문장 ${missing.length}개 (npm run voice:generate 필요):\n- ${missing.slice(0, 20).join('\n- ')}`);
  process.exit(1);
}
console.log(`voice ok: ${phrases.length}개`);
