'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');

const { validateCardImageBody } = require('../src/validate');

test('accepts minimal valid body (label + kind)', () => {
  const result = validateCardImageBody({ label: '사과', kind: 'n' });
  assert.equal(result.ok, true);
  assert.equal(result.value.label, '사과');
  assert.equal(result.value.kind, 'n');
  assert.equal(result.value.visualMeaning, undefined);
});

test('accepts full valid body with kind n and visualMeaning', () => {
  const r1 = validateCardImageBody({
    label: '사과',
    kind: 'n',
    visualMeaning: '먹는 과일 사과',
  });
  assert.equal(r1.ok, true);
  assert.equal(r1.value.visualMeaning, '먹는 과일 사과');

  const r2 = validateCardImageBody({ label: '아파요', kind: 'p', visualMeaning: '배를 만지며 찡그리는 표정' });
  assert.equal(r2.ok, true);
  assert.equal(r2.value.kind, 'p');
});

test('trims label and visualMeaning', () => {
  const result = validateCardImageBody({ label: '  사과  ', kind: 'n', visualMeaning: '  좋아요  ' });
  assert.equal(result.ok, true);
  assert.equal(result.value.label, '사과');
  assert.equal(result.value.visualMeaning, '좋아요');
});

test('rejects missing label', () => {
  const result = validateCardImageBody({ kind: 'n' });
  assert.equal(result.ok, false);
});

test('rejects empty/whitespace-only label', () => {
  const result = validateCardImageBody({ label: '   ', kind: 'n' });
  assert.equal(result.ok, false);
});

test('rejects label over 80 chars', () => {
  const result = validateCardImageBody({ label: 'a'.repeat(81), kind: 'n' });
  assert.equal(result.ok, false);
});

test('accepts label at exactly 80 chars', () => {
  const result = validateCardImageBody({ label: 'a'.repeat(80), kind: 'n' });
  assert.equal(result.ok, true);
});

test('rejects missing kind', () => {
  const result = validateCardImageBody({ label: '사과' });
  assert.equal(result.ok, false);
});

test('rejects invalid kind value', () => {
  const result = validateCardImageBody({ label: '사과', kind: 'x' });
  assert.equal(result.ok, false);
});

test('rejects visualMeaning over 240 chars', () => {
  const result = validateCardImageBody({ label: '사과', kind: 'n', visualMeaning: 'a'.repeat(241) });
  assert.equal(result.ok, false);
});

test('accepts visualMeaning at exactly 240 chars', () => {
  const result = validateCardImageBody({ label: '사과', kind: 'n', visualMeaning: 'a'.repeat(240) });
  assert.equal(result.ok, true);
});

test('rejects non-string visualMeaning', () => {
  assert.equal(validateCardImageBody({ label: '사과', kind: 'n', visualMeaning: 123 }).ok, false);
});

test('rejects non-object body', () => {
  assert.equal(validateCardImageBody(null).ok, false);
  assert.equal(validateCardImageBody('foo').ok, false);
  assert.equal(validateCardImageBody([]).ok, false);
});

test('rejects non-string label', () => {
  assert.equal(validateCardImageBody({ label: 123, kind: 'n' }).ok, false);
});

test('ignores legacy sentence field entirely (not echoed, not rejected)', () => {
  const result = validateCardImageBody({
    label: '사과',
    kind: 'n',
    visualMeaning: '먹는 과일 사과',
    sentence: '사과를 먹고 싶어요',
  });
  assert.equal(result.ok, true);
  assert.equal('sentence' in result.value, false);
});

test('ignores unknown extra fields on the body', () => {
  const result = validateCardImageBody({ label: '사과', kind: 'n', foo: 'bar', extra: 1 });
  assert.equal(result.ok, true);
  assert.equal('foo' in result.value, false);
  assert.equal('extra' in result.value, false);
});
