// 콕톡 기본 음성 라이브러리 생성 (Supertonic 3, 목소리 F1 "Sarah", 기기 내 실행)
// 준비: .tts-work/ 에 Supertonic nodejs 예제(helper.js, onnxruntime-web)와 모델(assets/onnx, voice_styles/F1.json)
// 실행: npm run voice:generate  (이미 만든 문장은 건너뜀)
import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';

const ROOT = path.resolve(import.meta.dirname, '../..');
const WORK = path.join(ROOT, '.tts-work');
const OUT = path.join(ROOT, 'assets/voice');
const MANIFEST = path.join(ROOT, 'scripts/voice-library/manifest.json');
const GEN_TS = path.join(ROOT, 'src/lib/voiceClips.generated.ts');
const VOICE = 'F1', STEPS = 8, SPEED = 1.0;

const key = (t) => t.replace(/\s+/g, ' ').trim();
const fnv = (s) => { let h = 0x811c9dc5; for (const c of Buffer.from(s)) { h ^= c; h = Math.imul(h, 0x01000193) >>> 0; } return h.toString(16).padStart(8, '0'); };

execFileSync('npx', ['tsc', 'scripts/voice-library/phrases.ts', '--outDir', '.tts-work/phr', '--module', 'commonjs', '--target', 'es2020', '--skipLibCheck', '--ignoreConfig'], { cwd: ROOT });
const phrases = JSON.parse(execFileSync('node', ['.tts-work/phr/scripts/voice-library/phrases.js'], { cwd: ROOT, encoding: 'utf8' }));
const manifest = fs.existsSync(MANIFEST) ? JSON.parse(fs.readFileSync(MANIFEST, 'utf8')) : { voice: `supertonic-3/${VOICE}`, steps: STEPS, speed: SPEED, clips: {} };
fs.mkdirSync(OUT, { recursive: true });

const todo = phrases.filter((t) => !manifest.clips[key(t)] || !fs.existsSync(path.join(OUT, manifest.clips[key(t)])));
console.log(`문장 ${phrases.length}개, 새로 만들 것 ${todo.length}개`);
if (todo.length) {
  const { loadTextToSpeech, loadVoiceStyle } = await import(path.join(WORK, 'st/helper.js'));
  const tts = await loadTextToSpeech(path.join(WORK, 'assets/onnx'), false);
  const style = loadVoiceStyle([path.join(WORK, `assets/voice_styles/${VOICE}.json`)], false);
  const { Mp3Encoder } = await import(path.join(WORK, 'st/node_modules/@breezystack/lamejs/dist/lamejs.js'));
  // 44.1kHz -> 22.05kHz 모노 MP3 40kbps (문장당 수 KB)
  const toMp3 = (f32) => { const n = Math.floor(f32.length / 2), pcm = new Int16Array(n); for (let k = 0; k < n; k++) { const v = Math.max(-1, Math.min(1, (f32[2 * k] + f32[2 * k + 1]) / 2)); pcm[k] = v * 32767; } const enc = new Mp3Encoder(1, tts.sampleRate / 2, 40), out = []; for (let k = 0; k < n; k += 1152) out.push(enc.encodeBuffer(pcm.subarray(k, k + 1152))); out.push(enc.flush()); return Buffer.concat(out.map((b) => Buffer.from(b))); };
  let i = 0;
  for (const t of todo) {
    const { wav, duration } = await tts.call(t, 'ko', style, STEPS, SPEED);
    const file = `${fnv(key(t))}.mp3`;
    fs.writeFileSync(path.join(OUT, file), toMp3(wav.slice(0, Math.floor(tts.sampleRate * duration[0]))));
    manifest.clips[key(t)] = file;
    if (++i % 25 === 0) { console.log(`${i}/${todo.length}`); fs.writeFileSync(MANIFEST, JSON.stringify(manifest, null, 1)); }
  }
}
// 앱에서 쓰지 않게 된 문장은 정리
const live = new Set(phrases.map(key));
for (const k of Object.keys(manifest.clips)) if (!live.has(k)) { fs.rmSync(path.join(OUT, manifest.clips[k]), { force: true }); delete manifest.clips[k]; }
fs.writeFileSync(MANIFEST, JSON.stringify(manifest, null, 1));

const entries = Object.entries(manifest.clips).sort(([a], [b]) => a.localeCompare(b));
fs.writeFileSync(GEN_TS, `// 자동 생성 파일 (npm run voice:generate). 직접 고치지 마세요.\n// 목소리: ${manifest.voice}\nexport const VOICE_CLIPS: Record<string, number> = {\n${entries.map(([k, f]) => `  ${JSON.stringify(k)}: require('../../assets/voice/${f}'),`).join('\n')}\n};\n`);
console.log(`완료: ${entries.length}개`);
