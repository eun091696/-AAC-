#!/usr/bin/env node
'use strict';
// 검수 그림 색인(library/embeddings.json) 생성. 그림이 추가·변경되면 다시 실행: npm run embeddings
const fs = require('node:fs');
const path = require('node:path');
const { createEmbedder, entryText } = require('../src/embeddings');

const root = path.join(__dirname, '..');
const env = fs.readFileSync(path.join(root, '.env'), 'utf8');
const apiKey = (env.match(/^OPENAI_API_KEY=(.*)$/m) || [])[1]?.trim();
if (!apiKey) throw new Error('server/.env 에 OPENAI_API_KEY 필요');

(async () => {
  const { entries } = JSON.parse(fs.readFileSync(path.join(root, 'library/approved.json'), 'utf8'));
  const embedder = createEmbedder({ apiKey });
  const texts = entries.map(entryText);
  const vectors = await embedder.embed(texts);
  const out = {
    model: embedder.model, dims: embedder.dims, builtAt: new Date().toISOString(),
    entries: entries.map((e, i) => ({ id: e.id, label: e.label, kind: e.kind, meaning: e.visualMeaning, text: texts[i], vector: vectors[i].map((x) => Math.round(x * 1e5) / 1e5) })),
  };
  fs.writeFileSync(path.join(root, 'library/embeddings.json'), JSON.stringify(out));
  console.log(`색인 완료: ${out.entries.length}개, ${out.dims}차원`);
})();
