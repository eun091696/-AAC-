#!/usr/bin/env node
'use strict';
// 그림 연결 평가: 정답 세트(eval/image-match.json)로 정확도(precision)·재현율(recall) 측정
// npm run eval:match  (임베딩 + LLM 호출, 1회 수 원)
const fs = require('node:fs');
const path = require('node:path');
const { createEmbedder } = require('../src/embeddings');
const { createRetriever, loadIndex } = require('../src/retrieval');
const { createImageJudge } = require('../src/imageJudge');

const root = path.join(__dirname, '..');
const apiKey = (fs.readFileSync(path.join(root, '.env'), 'utf8').match(/^OPENAI_API_KEY=(.*)$/m) || [])[1]?.trim();
const { cases } = JSON.parse(fs.readFileSync(path.join(root, 'eval/image-match.json'), 'utf8'));
const model = process.env.OPENAI_TEXT_MODEL || 'gpt-5-mini';

function score(res) {
  let tp = 0, fp = 0, fn = 0, tn = 0;
  const wrong = [];
  cases.forEach((c, i) => {
    const got = res[i].id ? res[i].label : null;
    if (got && c.expect?.includes(got)) tp++;
    else if (got) { fp++; wrong.push(`${c.label} -> ${got} (틀리게 연결)`); }
    else if (c.expect) { fn++; wrong.push(`${c.label} -> 없음 (정답 ${c.expect[0]})`); }
    else tn++;
  });
  const p = tp / (tp + fp || 1), r = tp / (tp + fn || 1);
  return { p, r, f1: (2 * p * r) / (p + r || 1), tp, fp, fn, tn, wrong };
}

(async () => {
  const embedder = createEmbedder({ apiKey });
  const retriever = createRetriever({ index: loadIndex(), embedder, judge: createImageJudge({ apiKey, model, effort: process.env.JUDGE_EFFORT || 'minimal' }) });
  const items = cases.map((c) => ({ label: c.label, say: c.say }));
  const runs = [['임베딩만(기준점수)', { judge: null }], ['임베딩 후보 + LLM 판단', { onError: (err) => console.log('  ! LLM 판단 실패:', err.message) }]];
  const report = { at: new Date().toISOString(), embed: `${embedder.model}/${embedder.dims}`, judge: `${model}/${process.env.JUDGE_EFFORT || 'minimal'}`, cases: cases.length, results: {} };
  for (const [name, opts] of runs) {
    const t0 = Date.now();
    const s = score(await retriever.match(items, opts));
    report.results[name] = { precision: +s.p.toFixed(3), recall: +s.r.toFixed(3), f1: +s.f1.toFixed(3), ms: Date.now() - t0 };
    console.log(`\n[${name}] 정확도 ${s.p.toFixed(2)}  재현율 ${s.r.toFixed(2)}  F1 ${s.f1.toFixed(2)}  (맞음 ${s.tp} / 틀린 연결 ${s.fp} / 놓침 ${s.fn} / 올바른 비연결 ${s.tn})  ${Date.now() - t0}ms`);
    s.wrong.forEach((w) => console.log('  -', w));
  }
  fs.writeFileSync(path.join(root, 'eval/image-match.result.json'), JSON.stringify(report, null, 1));
})();
