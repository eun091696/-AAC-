'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { checkBoardRules } = require('../src/boardRules');

const p = (w, s = w) => ({ i: '🙂', w, s, t: 'p' });
const good = { items: [p('도와주세요'), p('멈춰요', '잠깐 멈춰 주세요'), p('화장실', '화장실 가고 싶어요'), p('네'), p('아파요'), p('무서워요'), p('물 주세요'), p('괜찮아요'), p('싫어요'), p('좋아요')], l1: [0, 1, 2, 3, 4, 5] };

test('규칙 채점: 좋은 판은 통과 ("네" 같은 짧은 대답 허용)', () => {
  assert.deepEqual(checkBoardRules(good), []);
});

test('규칙 채점: 필수 버튼·존댓말·L1·버튼 수 문제를 잡음', () => {
  const bad = { items: [p('물 줘', '물 줘'), ...good.items.slice(3)], l1: [0, 0, 9] };
  const f = checkBoardRules(bad);
  for (const k of ['버튼 수 8', '도움 버튼 없음', '멈춤 버튼 없음', '화장실 버튼 없음', '존댓말 아님: 물 줘', 'L1 번호 오류']) assert.ok(f.includes(k), k);
});
