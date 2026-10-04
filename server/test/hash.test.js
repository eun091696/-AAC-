'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');

const { computeCacheKey } = require('../src/hash');

test('same inputs produce same hash', () => {
  const a = computeCacheKey({ model: 'gpt-image-1', promptVersion: 'v2-realistic', label: '사과', kind: 'n', meaning: '먹는 과일 사과', imageSize: '1024x1024' });
  const b = computeCacheKey({ model: 'gpt-image-1', promptVersion: 'v2-realistic', label: '사과', kind: 'n', meaning: '먹는 과일 사과', imageSize: '1024x1024' });
  assert.equal(a, b);
});

test('different label produces different hash', () => {
  const base = { model: 'gpt-image-1', promptVersion: 'v2-realistic', kind: 'n', meaning: 'x', imageSize: '1024x1024' };
  const a = computeCacheKey({ ...base, label: '사과' });
  const b = computeCacheKey({ ...base, label: '바나나' });
  assert.notEqual(a, b);
});

test('different model, promptVersion, or imageSize busts cache key', () => {
  const base = { promptVersion: 'v2-realistic', label: '사과', kind: 'n', meaning: 'x', imageSize: '1024x1024' };
  const a = computeCacheKey({ ...base, model: 'gpt-image-1' });
  const b = computeCacheKey({ ...base, model: 'gpt-image-2' });
  assert.notEqual(a, b);

  const c = computeCacheKey({ model: 'gpt-image-1', promptVersion: 'v2-realistic', label: '사과', kind: 'n', meaning: 'x', imageSize: '1024x1024' });
  const d = computeCacheKey({ model: 'gpt-image-1', promptVersion: 'v3', label: '사과', kind: 'n', meaning: 'x', imageSize: '1024x1024' });
  assert.notEqual(c, d);

  const e = computeCacheKey({ model: 'gpt-image-1', promptVersion: 'v2-realistic', label: '사과', kind: 'n', meaning: 'x', imageSize: '1024x1024' });
  const f = computeCacheKey({ model: 'gpt-image-1', promptVersion: 'v2-realistic', label: '사과', kind: 'n', meaning: 'x', imageSize: '1536x1024' });
  assert.notEqual(e, f);
});

test('kind participates in the hash', () => {
  const base = { model: 'gpt-image-1', promptVersion: 'v2-realistic', label: '사과', meaning: 'x', imageSize: '1024x1024' };
  const a = computeCacheKey({ ...base, kind: 'n' });
  const b = computeCacheKey({ ...base, kind: 'p' });
  assert.notEqual(a, b);
});

test('same label with different resolved meaning produces different cache keys (ambiguous/unknown nouns)', () => {
  const base = { model: 'gpt-image-1', promptVersion: 'v2-realistic', label: '배', kind: 'n', imageSize: '1024x1024' };
  const fruit = computeCacheKey({ ...base, meaning: '먹는 과일 배' });
  const body = computeCacheKey({ ...base, meaning: '몸의 배(복부)' });
  const ship = computeCacheKey({ ...base, meaning: '타는 배(선박)' });
  assert.notEqual(fruit, body);
  assert.notEqual(body, ship);
  assert.notEqual(fruit, ship);
});

test('sentence is never part of the cache key signature (no such param)', () => {
  const a = computeCacheKey({ model: 'gpt-image-1', promptVersion: 'v2-realistic', label: '사과', kind: 'n', meaning: 'x', imageSize: '1024x1024' });
  const b = computeCacheKey({ model: 'gpt-image-1', promptVersion: 'v2-realistic', label: '사과', kind: 'n', meaning: 'x', imageSize: '1024x1024', sentence: 'ignored anyway' });
  assert.equal(a, b);
});

test('hash is a 64-char hex sha256 digest', () => {
  const a = computeCacheKey({ model: 'm', promptVersion: 'v2-realistic', label: 'x', kind: 'n', meaning: 'x', imageSize: '1024x1024' });
  assert.match(a, /^[0-9a-f]{64}$/);
});

test('scene, quality and actual template version invalidate stale image cache', () => {
  const base = { model: 'test-model', promptVersion: 'ops-v1', label: '물', kind: 'n', meaning: '마시는 물', scene: 'clear glass', imageSize: '1024x1024', imageQuality: 'medium', templateVersion: 'v2-realistic' };
  for (const [field, changed] of [['scene', 'water bottle'], ['imageQuality', 'high'], ['templateVersion', 'v3']]) {
    assert.notEqual(computeCacheKey(base), computeCacheKey({ ...base, [field]: changed }));
  }
});
