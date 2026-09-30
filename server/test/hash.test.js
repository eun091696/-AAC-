'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');

const { computeCacheKey } = require('../src/hash');

test('same inputs produce same hash', () => {
  const a = computeCacheKey({ model: 'gpt-image-1', promptVersion: 'v1', label: '사과' });
  const b = computeCacheKey({ model: 'gpt-image-1', promptVersion: 'v1', label: '사과' });
  assert.equal(a, b);
});

test('different label produces different hash', () => {
  const a = computeCacheKey({ model: 'gpt-image-1', promptVersion: 'v1', label: '사과' });
  const b = computeCacheKey({ model: 'gpt-image-1', promptVersion: 'v1', label: '바나나' });
  assert.notEqual(a, b);
});

test('different model or promptVersion busts cache key', () => {
  const base = { promptVersion: 'v1', label: '사과' };
  const a = computeCacheKey({ ...base, model: 'gpt-image-1' });
  const b = computeCacheKey({ ...base, model: 'gpt-image-2' });
  assert.notEqual(a, b);

  const c = computeCacheKey({ model: 'gpt-image-1', promptVersion: 'v1', label: '사과' });
  const d = computeCacheKey({ model: 'gpt-image-1', promptVersion: 'v2', label: '사과' });
  assert.notEqual(c, d);
});

test('sentence and kind participate in the hash', () => {
  const base = { model: 'gpt-image-1', promptVersion: 'v1', label: '사과' };
  const a = computeCacheKey(base);
  const b = computeCacheKey({ ...base, sentence: '사과를 먹어요' });
  const c = computeCacheKey({ ...base, kind: 'n' });
  assert.notEqual(a, b);
  assert.notEqual(a, c);
  assert.notEqual(b, c);
});

test('hash is a 64-char hex sha256 digest', () => {
  const a = computeCacheKey({ model: 'm', promptVersion: 'v1', label: 'x' });
  assert.match(a, /^[0-9a-f]{64}$/);
});
