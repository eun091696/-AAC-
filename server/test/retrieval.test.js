'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { createRetriever, queryText } = require('../src/retrieval');
const { normalize } = require('../src/embeddings');

// 가짜 임베딩: 글자에 따라 정해진 방향 (API 호출 없음)
const VEC = { 물: [1, 0, 0], 생수: [0.9, 0.1, 0], 배: [0, 1, 0], '배 타요 - 배 타고 싶어요': [0.1, 0.9, 0.3], 머리: [0, 0, 1], 머리카락: [0, 0.2, 0.95] };
const fakeEmbedder = { embed: async (texts) => texts.map((t) => normalize(VEC[t] || [0.3, 0.3, 0.3])) };
const index = { entries: [
  { id: 'n_water', label: '물', meaning: '마시는 물', text: '물 - 마시는 물', vector: normalize([1, 0, 0]) },
  { id: 'n_belly', label: '배', meaning: '몸의 배', text: '배 - 몸의 배', vector: normalize([0, 1, 0]) },
  { id: 'n_head', label: '머리', meaning: '신체 머리', text: '머리 - 신체 머리', vector: normalize([0, 0, 1]) },
] };

test('queryText: 말하는 문장이 다를 때만 붙임', () => {
  assert.equal(queryText('물', '물'), '물');
  assert.equal(queryText('배 타요', '배 타고 싶어요'), '배 타요 - 배 타고 싶어요');
});

test('LLM 판단 없이: 이름 일치 + 높은 점수만 연결 (보수적)', async () => {
  const r = createRetriever({ index, embedder: fakeEmbedder, threshold: 0.99 });
  const m = await r.match([{ label: '물', say: '물' }, { label: '생수', say: '생수' }, { label: '머리카락', say: '머리카락' }]);
  assert.equal(m[0].id, 'n_water');
  assert.equal(m[0].how, 'exact');
  assert.equal(m[1].id, 'n_water', '0.994 >= 0.99');
  assert.equal(m[2].id, null, '0.978 < 0.99 이면 연결 안 함');
});

test('LLM 판단: 후보 중 고른 것만 연결, -1이면 연결 안 함', async () => {
  let seen;
  const judge = { judge: async (items) => { seen = items; return items.map((it) => (it.label === '배 타요' ? -1 : 0)); } };
  const r = createRetriever({ index, embedder: fakeEmbedder, judge });
  const m = await r.match([{ label: '생수', say: '생수' }, { label: '배 타요', say: '배 타고 싶어요' }]);
  assert.equal(m[0].id, 'n_water');
  assert.equal(m[0].how, 'judged');
  assert.equal(m[0].meaning, '마시는 물');
  assert.equal(m[1].id, null, '동음이의어는 LLM이 거절');
  assert.ok(seen[0].candidates.length >= 1 && seen[0].candidates[0].meaning === '마시는 물');
});

test('LLM 판단 실패하면 보수적 규칙으로 대체하고 오류를 알림', async () => {
  const errors = [];
  const r = createRetriever({ index, embedder: fakeEmbedder, judge: { judge: async () => { throw new Error('down'); } } });
  const m = await r.match([{ label: '배', say: '배' }], { onError: (e) => errors.push(e.message) });
  assert.equal(m[0].id, 'n_belly');
  assert.equal(m[0].how, 'exact');
  assert.deepEqual(errors, ['down']);
});

test('related: 상황과 가까운 카드 이름 순서', async () => {
  const r = createRetriever({ index, embedder: fakeEmbedder });
  assert.deepEqual((await r.related('생수', 2)), ['물', '배']);
});

test('속도: 이름이 같고 뜻이 하나뿐이면 판단 생략, 동음이의어는 판단', async () => {
  let asked = [];
  const judge = { judge: async (items) => { asked = items.map((x) => x.label); return items.map(() => -1); } };
  const idx = { entries: [...index.entries, { id: 'p_toilet', label: '화장실', meaning: '화장실 문', text: '화장실 - 화장실 문', vector: normalize([0.5, 0.5, 0]) }] };
  const r = createRetriever({ index: idx, embedder: fakeEmbedder, judge });
  const m = await r.match([{ label: '화장실', say: '화장실 가고 싶어요' }, { label: '배', say: '배 주세요' }]);
  assert.equal(m[0].id, 'p_toilet');
  assert.equal(m[0].how, 'exact');
  assert.deepEqual(asked, ['배'], '배는 과일일 수도 있어 LLM이 판단');
  assert.equal(m[1].id, null);
});
