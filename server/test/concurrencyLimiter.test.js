'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');

const { createConcurrencyLimiter } = require('../src/concurrencyLimiter');

test('allows up to max concurrent acquisitions', () => {
  const limiter = createConcurrencyLimiter(2);
  const r1 = limiter.tryAcquire();
  const r2 = limiter.tryAcquire();
  const r3 = limiter.tryAcquire();
  assert.ok(r1);
  assert.ok(r2);
  assert.equal(r3, null);
  assert.equal(limiter.active, 2);
});

test('release frees a slot for reuse', () => {
  const limiter = createConcurrencyLimiter(1);
  const release1 = limiter.tryAcquire();
  assert.ok(release1);
  assert.equal(limiter.tryAcquire(), null);
  release1();
  assert.equal(limiter.active, 0);
  const release2 = limiter.tryAcquire();
  assert.ok(release2);
  release2();
});

test('release is idempotent', () => {
  const limiter = createConcurrencyLimiter(1);
  const release = limiter.tryAcquire();
  release();
  release();
  assert.equal(limiter.active, 0);
});
