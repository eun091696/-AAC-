'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');

const { validateCardImageBody } = require('../src/validate');

test('accepts minimal valid body', () => {
  const result = validateCardImageBody({ label: '사과' });
  assert.equal(result.ok, true);
  assert.equal(result.value.label, '사과');
  assert.equal(result.value.sentence, undefined);
  assert.equal(result.value.kind, undefined);
});

test('accepts full valid body with kind n and p', () => {
  const r1 = validateCardImageBody({ label: '사과', sentence: '사과를 먹어요', kind: 'n' });
  assert.equal(r1.ok, true);
  assert.equal(r1.value.kind, 'n');

  const r2 = validateCardImageBody({ label: '아파요', kind: 'p' });
  assert.equal(r2.ok, true);
  assert.equal(r2.value.kind, 'p');
});

test('trims label and sentence', () => {
  const result = validateCardImageBody({ label: '  사과  ', sentence: '  좋아요  ' });
  assert.equal(result.ok, true);
  assert.equal(result.value.label, '사과');
  assert.equal(result.value.sentence, '좋아요');
});

test('rejects missing label', () => {
  const result = validateCardImageBody({});
  assert.equal(result.ok, false);
});

test('rejects empty/whitespace-only label', () => {
  const result = validateCardImageBody({ label: '   ' });
  assert.equal(result.ok, false);
});

test('rejects label over 80 chars', () => {
  const result = validateCardImageBody({ label: 'a'.repeat(81) });
  assert.equal(result.ok, false);
});

test('accepts label at exactly 80 chars', () => {
  const result = validateCardImageBody({ label: 'a'.repeat(80) });
  assert.equal(result.ok, true);
});

test('rejects sentence over 160 chars', () => {
  const result = validateCardImageBody({ label: '사과', sentence: 'a'.repeat(161) });
  assert.equal(result.ok, false);
});

test('accepts sentence at exactly 160 chars', () => {
  const result = validateCardImageBody({ label: '사과', sentence: 'a'.repeat(160) });
  assert.equal(result.ok, true);
});

test('rejects invalid kind value', () => {
  const result = validateCardImageBody({ label: '사과', kind: 'x' });
  assert.equal(result.ok, false);
});

test('rejects non-object body', () => {
  assert.equal(validateCardImageBody(null).ok, false);
  assert.equal(validateCardImageBody('foo').ok, false);
  assert.equal(validateCardImageBody([]).ok, false);
});

test('rejects non-string label/sentence', () => {
  assert.equal(validateCardImageBody({ label: 123 }).ok, false);
  assert.equal(validateCardImageBody({ label: '사과', sentence: 123 }).ok, false);
});
