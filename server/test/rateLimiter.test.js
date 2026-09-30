'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');

const { createRateLimiter } = require('../src/rateLimiter');

test('allows up to max requests within window', () => {
  let t = 0;
  const limiter = createRateLimiter({ windowMs: 1000, max: 3 }, () => t);
  assert.equal(limiter.check('ip1'), true);
  assert.equal(limiter.check('ip1'), true);
  assert.equal(limiter.check('ip1'), true);
  assert.equal(limiter.check('ip1'), false);
});

test('resets after window elapses', () => {
  let t = 0;
  const limiter = createRateLimiter({ windowMs: 1000, max: 2 }, () => t);
  assert.equal(limiter.check('ip1'), true);
  assert.equal(limiter.check('ip1'), true);
  assert.equal(limiter.check('ip1'), false);
  t += 1001;
  assert.equal(limiter.check('ip1'), true);
});

test('tracks separate keys independently', () => {
  let t = 0;
  const limiter = createRateLimiter({ windowMs: 1000, max: 1 }, () => t);
  assert.equal(limiter.check('ip1'), true);
  assert.equal(limiter.check('ip2'), true);
  assert.equal(limiter.check('ip1'), false);
  assert.equal(limiter.check('ip2'), false);
});

test('sweep removes stale entries', () => {
  let t = 0;
  const limiter = createRateLimiter({ windowMs: 1000, max: 1 }, () => t);
  limiter.check('ip1');
  t += 2000;
  limiter.sweep();
  // after sweep + window elapsed, key should behave as fresh
  assert.equal(limiter.check('ip1'), true);
});
