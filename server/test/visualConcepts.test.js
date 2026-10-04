'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');

const { resolveVisualMeaning, loadData, VISUAL_MEANING_MAX } = require('../src/visualConcepts');

const testData = {
  nouns: {
    사과: undefined, // intentionally NOT present: 사과 is ambiguous, must not be in nouns
    물: { meaning: '마시는 물(음료)', scene: 'a cup of water' },
  },
  ambiguous: {
    사과: ['먹는 과일 사과', '잘못에 대해 사과하기'],
    배: ['먹는 과일 배', '몸의 배(복부)', '타는 배(선박)'],
  },
};
delete testData.nouns.사과;

test('real shared dictionary loads and has the documented shape', () => {
  const data = loadData();
  assert.equal(typeof data.nouns, 'object');
  assert.equal(typeof data.ambiguous, 'object');
  assert.ok(Object.keys(data.nouns).length >= 25, 'expects ~30 curated unambiguous nouns');
  assert.ok('사과' in data.ambiguous, '사과 must be ambiguous (fruit vs apology), not a plain noun');
  assert.equal('사과' in data.nouns, false, '사과 must NOT be in the unambiguous noun dictionary');
});

test('curated unambiguous noun resolves from dictionary when no guardian meaning is given', () => {
  const r = resolveVisualMeaning({ label: '물', kind: 'n' }, testData);
  assert.equal(r.ok, true);
  assert.equal(r.meaning, '마시는 물(음료)');
  assert.equal(r.scene, 'a cup of water');
});

test('curated unambiguous noun uses the dictionary scene when guardian meaning equals the curated default', () => {
  const r = resolveVisualMeaning({ label: '물', kind: 'n', visualMeaning: '마시는 물(음료)' }, testData);
  assert.equal(r.ok, true);
  assert.equal(r.meaning, '마시는 물(음료)');
  assert.equal(r.scene, 'a cup of water');
});

test('curated unambiguous noun is overridden verbatim when guardian meaning differs from the curated default', () => {
  const r = resolveVisualMeaning(
    { label: '물', kind: 'n', visualMeaning: '수돗장에서 손을 씻고 있는 물' },
    testData,
  );
  assert.equal(r.ok, true);
  assert.equal(r.meaning, '수돗장에서 손을 씻고 있는 물');
  assert.equal(r.scene, '수돗장에서 손을 씻고 있는 물');
});

test('ambiguous noun without visualMeaning returns 422-style meaning_required with choices', () => {
  const r = resolveVisualMeaning({ label: '사과', kind: 'n' }, testData);
  assert.equal(r.ok, false);
  assert.equal(r.error, 'meaning_required');
  assert.deepEqual(r.choices, ['먹는 과일 사과', '잘못에 대해 사과하기']);
});

test('ambiguous noun with an explicit non-matching description is accepted verbatim (choices are suggestions, not a whitelist)', () => {
  const r = resolveVisualMeaning(
    { label: '배', kind: 'n', visualMeaning: '사람이 몸의 배를 손으로 가리키는 장면' },
    testData,
  );
  assert.equal(r.ok, true);
  assert.equal(r.meaning, '사람이 몸의 배를 손으로 가리키는 장면');
  assert.equal(r.scene, '사람이 몸의 배를 손으로 가리키는 장면');
});

test('ambiguous noun with a visualMeaning matching a choice exactly resolves', () => {
  const r = resolveVisualMeaning({ label: '사과', kind: 'n', visualMeaning: '먹는 과일 사과' }, testData);
  assert.equal(r.ok, true);
  assert.equal(r.meaning, '먹는 과일 사과');
});

test('same ambiguous label, different chosen meaning, resolves to a different meaning/scene', () => {
  const fruit = resolveVisualMeaning({ label: '배', kind: 'n', visualMeaning: '먹는 과일 배' }, testData);
  const body = resolveVisualMeaning({ label: '배', kind: 'n', visualMeaning: '몸의 배(복부)' }, testData);
  assert.equal(fruit.ok, true);
  assert.equal(body.ok, true);
  assert.notEqual(fruit.meaning, body.meaning);
});

test('unknown noun (not in dictionary, not ambiguous) requires an explicit visualMeaning', () => {
  const missing = resolveVisualMeaning({ label: '기린', kind: 'n' }, testData);
  assert.equal(missing.ok, false);
  assert.equal(missing.error, 'meaning_required');

  const provided = resolveVisualMeaning({ label: '기린', kind: 'n', visualMeaning: '목이 긴 동물 기린' }, testData);
  assert.equal(provided.ok, true);
  assert.equal(provided.meaning, '목이 긴 동물 기린');
});

test('kind p (expression) always requires explicit guardian description, never a default smiley', () => {
  const missing = resolveVisualMeaning({ label: '아파요', kind: 'p' }, testData);
  assert.equal(missing.ok, false);
  assert.equal(missing.error, 'meaning_required');

  const provided = resolveVisualMeaning(
    { label: '아파요', kind: 'p', visualMeaning: '배를 만지며 찡그리는 표정' },
    testData,
  );
  assert.equal(provided.ok, true);
  assert.equal(provided.scene, '배를 만지며 찡그리는 표정');
});

test('visualMeaning over VISUAL_MEANING_MAX chars is rejected as invalid_request, not meaning_required', () => {
  const r = resolveVisualMeaning({ label: '기린', kind: 'n', visualMeaning: 'a'.repeat(VISUAL_MEANING_MAX + 1) }, testData);
  assert.equal(r.ok, false);
  assert.equal(r.error, 'invalid_request');
});

test('whitespace-only visualMeaning is treated as absent (still meaning_required)', () => {
  const r = resolveVisualMeaning({ label: '기린', kind: 'n', visualMeaning: '   ' }, testData);
  assert.equal(r.ok, false);
  assert.equal(r.error, 'meaning_required');
});
