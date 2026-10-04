// 단어 목록 → AI 후보 그림 생성 (이미 만든 후보는 건너뜀: 중간에 멈춰도 이어서 실행 가능)
// npm run images:generate -- --dry-run            프롬프트·예상 비용만 확인
// npm run images:generate -- --limit 5            앞의 5단어만
// npm run images:generate -- --only 귀,코 --candidates 3
import fs from 'node:fs';
import path from 'node:path';
import { CANDIDATES, loadEnv, loadWords, parseArgs, require } from './common.mjs';

const { buildPrompt, PROMPT_TEMPLATE_VERSION } = require('../../server/src/promptBuilder.js');
const { createOpenAIClient } = require('../../server/src/openaiClient.js');

// 공식 가격표 기준 1024x1024 장당 USD (모르는 모델은 표시 안 함)
const PRICE = { 'gpt-image-1-mini': { low: 0.005, medium: 0.011, high: 0.036 }, 'gpt-image-1': { low: 0.011, medium: 0.042, high: 0.167 }, 'gpt-image-2': { low: 0.006, medium: 0.053, high: 0.211 } };

const args = parseArgs(process.argv.slice(2));
loadEnv();
const model = args.model || process.env.LIBRARY_MODEL || 'gpt-image-1-mini';
const quality = args.quality || 'medium';
const per = Number(args.candidates || 2);
let words = loadWords({ batch: args.batch ? Number(args.batch) : undefined, only: args.only ? String(args.only).split(',') : undefined });
if (args.limit) words = words.slice(0, Number(args.limit));

const todo = [];
for (const w of words) for (let n = 1; n <= per; n++) {
  const file = path.join(CANDIDATES, w.id, `${n}.png`);
  if (!fs.existsSync(file)) todo.push({ w, n, file });
}
const unit = PRICE[model]?.[quality];
console.log(`모델 ${model} / 품질 ${quality} / 단어 ${words.length}개 × 후보 ${per}장 → 새로 만들 그림 ${todo.length}장`);
console.log(unit ? `예상 비용: 약 $${(unit * todo.length).toFixed(2)} (약 ${Math.round(unit * todo.length * 1400).toLocaleString()}원, 1달러=1,400원)` : '예상 비용: 이 모델은 장당 가격표가 없어 계산하지 않아요.');

if (args['dry-run']) {
  for (const { w } of todo.filter((t) => t.n === 1).slice(0, 3)) console.log(`\n[${w.label}] ${buildPrompt(w)}`);
  process.exit(0);
}
if (!process.env.OPENAI_API_KEY) {
  console.error('\nOPENAI_API_KEY가 없어요. server/.env 에 넣어 주세요 (이 파일은 git에 올라가지 않아요).');
  process.exit(1);
}

const client = createOpenAIClient({ apiKey: process.env.OPENAI_API_KEY, model, timeoutMs: 120_000 });
let ok = 0, fail = 0;
for (const { w, n, file } of todo) {
  try {
    let png;
    for (let attempt = 1; ; attempt++) {
      try { png = await client.generateImage({ prompt: buildPrompt(w) + (w.extra ? ` ${w.extra}` : ''), size: '1024x1024', quality }); break; }
      catch (e) {
        // 분당 생성 한도(429)면 잠깐 기다렸다 다시 (크레딧 부족 429는 재시도 안 함)
        if (e.status === 429 && !/credits/i.test(e.message) && attempt < 4) { await new Promise((r) => setTimeout(r, 20_000)); continue; }
        throw e;
      }
    }
    fs.mkdirSync(path.dirname(file), { recursive: true });
    fs.writeFileSync(file, png);
    fs.writeFileSync(path.join(CANDIDATES, w.id, 'meta.json'), JSON.stringify({ ...w, model, quality, promptVersion: PROMPT_TEMPLATE_VERSION }, null, 2));
    ok++;
    console.log(`✓ ${w.label} #${n}`);
  } catch (e) {
    fail++;
    console.log(`✗ ${w.label} #${n}: ${e.message}`);
  }
}
console.log(`\n완료: 성공 ${ok}장, 실패 ${fail}장. 다음: npm run images:review`);
