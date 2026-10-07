#!/usr/bin/env node
'use strict';
// 판 품질 평가: 실제 생성기(서비스와 같은 설정)로 판을 만들고 규칙 + LLM 채점관으로 점수화
//   npm run eval:boards                 전체 평가 (생성 24회 + 채점 24회, 수백 원 수준)
//   npm run eval:boards -- --calibrate  채점관 검증만 (사람 정답과 일치율)
const fs = require('node:fs');
const path = require('node:path');
const { createBoardGenerator, validateBoardBody, BOARD_PROMPT_VERSION } = require('../src/boardGenerator');
const { createBoardJudge } = require('../src/boardJudge');
const { checkBoardRules } = require('../src/boardRules');

const root = path.join(__dirname, '..');
const apiKey = (fs.readFileSync(path.join(root, '.env'), 'utf8').match(/^OPENAI_API_KEY=(.*)$/m) || [])[1]?.trim();
const judge = createBoardJudge({ apiKey, model: process.env.JUDGE_MODEL || 'gpt-5.2' });

async function pool(list, n, fn) {
  const out = new Array(list.length);
  let next = 0;
  await Promise.all(Array.from({ length: n }, async () => { while (next < list.length) { const i = next++; out[i] = await fn(list[i], i); } }));
  return out;
}

async function calibrate() {
  const { groups } = JSON.parse(fs.readFileSync(path.join(root, 'eval/judge-calibration.json'), 'utf8'));
  let sp = 0, df = 0, n = 0;
  const miss = [];
  for (const g of groups) {
    const r = await judge.grade(g.situation, { items: g.items.map((x) => ({ w: x.label, s: x.say })) });
    g.items.forEach((x, i) => {
      const got = r.items.find((y) => y.n === i) || {};
      n++;
      if (got.speaker === x.speaker) sp++; else miss.push(`[말하는 사람] ${g.situation} "${x.say}": 정답 ${x.speaker}, 채점관 ${got.speaker}`);
      if (got.difficulty === x.difficulty) df++; else miss.push(`[어려운 말] ${g.situation} "${x.say}": 정답 ${x.difficulty}, 채점관 ${got.difficulty}`);
    });
  }
  console.log(`채점관(${judge.model}) 일치율: 말하는 사람 ${sp}/${n}, 어려운 말 ${df}/${n}`);
  miss.forEach((m) => console.log('  -', m));
}

async function run() {
  const { situations } = JSON.parse(fs.readFileSync(path.join(root, 'eval/boards.json'), 'utf8'));
  const gen = createBoardGenerator({ apiKey, model: process.env.OPENAI_TEXT_MODEL || 'gpt-5-mini', effort: process.env.GEN_EFFORT || 'minimal', timeoutMs: 90000 });
  const rows = await pool(situations, 4, async (s) => {
    const v = validateBoardBody({ situation: s.text });
    if (!v.ok) return { id: s.id, adversarial: !!s.adversarial, blocked: v.message };
    const t0 = Date.now();
    let board, error = null, usage = null;
    try { ({ board, usage } = await gen.generate(s.text)); } catch (e) { error = e.message.slice(0, 120); }
    const ms = Date.now() - t0;
    if (!board) return { id: s.id, adversarial: !!s.adversarial, error, ms };
    const rules = checkBoardRules(board);
    const grade = await judge.grade(s.text, board);
    const per = board.items.map((it, n) => ({ ...it, ...(grade.items.find((g) => g.n === n) || {}) }));
    return { id: s.id, text: s.text, adversarial: !!s.adversarial, ms, outTokens: usage?.output_tokens, rules, relevance: grade.relevance, missing: grade.missing, safety: grade.safety,
      other: per.filter((x) => x.speaker === 'other').map((x) => x.s), hard: per.filter((x) => x.difficulty === 'hard').map((x) => x.w), offTopic: per.filter((x) => x.fits === false).map((x) => x.w), n: per.length };
  });

  const ok = rows.filter((r) => !r.error && !r.blocked);
  const normal = ok.filter((r) => !r.adversarial);
  const totalItems = normal.reduce((a, r) => a + r.n, 0) || 1;
  const sum = (f) => normal.reduce((a, r) => a + f(r), 0);
  const summary = {
    promptVersion: BOARD_PROMPT_VERSION, genModel: gen.model, genEffort: process.env.GEN_EFFORT || 'minimal', judge: judge.model, at: new Date().toISOString(),
    boards: rows.length, blocked: rows.filter((r) => r.blocked).length, errors: rows.filter((r) => r.error).length,
    rulePassRate: +(ok.filter((r) => !r.rules.length).length / (ok.length || 1)).toFixed(3),
    otherSpeakerRate: +(sum((r) => r.other.length) / totalItems).toFixed(3),
    hardWordRate: +(sum((r) => r.hard.length) / totalItems).toFixed(3),
    offTopicRate: +(sum((r) => r.offTopic.length) / totalItems).toFixed(3),
    relevanceAvg: +(sum((r) => r.relevance) / (normal.length || 1)).toFixed(2),
    safetyFlags: ok.filter((r) => r.safety).length,
    avgMs: Math.round(ok.reduce((a, r) => a + r.ms, 0) / (ok.length || 1)),
  };
  console.log(JSON.stringify(summary, null, 1));
  console.log('\n판별 문제:');
  for (const r of rows) {
    if (r.blocked) { console.log(`- ${r.id}: 입력 차단 (${r.blocked})`); continue; }
    if (r.error) { console.log(`- ${r.id}: 생성 실패 (${r.error})`); continue; }
    const p = [r.rules.length && `규칙 ${r.rules.join(', ')}`, r.other.length && `상대가 할 말 ${r.other.join(' / ')}`, r.hard.length && `어려운 말 ${r.hard.join(', ')}`, r.offTopic.length && `상황 밖 ${r.offTopic.join(', ')}`, r.safety && `안전 ${r.safety}`, `적합도 ${r.relevance}`].filter(Boolean);
    console.log(`- ${r.id}${r.adversarial ? '(공격)' : ''}: ${p.join(' | ')}`);
  }
  const histFile = path.join(root, 'eval/boards.history.json');
  const hist = fs.existsSync(histFile) ? JSON.parse(fs.readFileSync(histFile, 'utf8')) : [];
  hist.push(summary);
  fs.writeFileSync(histFile, JSON.stringify(hist, null, 1));
  fs.writeFileSync(path.join(root, 'eval/boards.result.json'), JSON.stringify({ summary, rows }, null, 1));
}

(process.argv.includes('--calibrate') ? calibrate() : run()).catch((e) => { console.error(e); process.exit(1); });
