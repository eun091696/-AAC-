'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const os = require('node:os');

const { createDiskCache, createMemoryCache, createNullCache } = require('../src/cache');

test('memory cache miss then hit', async () => {
  const cache = createMemoryCache();
  assert.equal(await cache.get('abc'), null);
  await cache.set('abc', Buffer.from('hello'));
  const got = await cache.get('abc');
  assert.equal(got.toString(), 'hello');
});

test('null cache always misses and never stores', async () => {
  const cache = createNullCache();
  await cache.set('abc', Buffer.from('hello'));
  assert.equal(await cache.get('abc'), null);
});

test('disk cache persists bytes to files named by hash only', async () => {
  const dir = await fs.promises.mkdtemp(path.join(os.tmpdir(), 'aac-cache-'));
  try {
    const cache = createDiskCache(dir);
    assert.equal(await cache.get('deadbeef'), null);

    const png = Buffer.from([0x89, 0x50, 0x4e, 0x47]);
    await cache.set('deadbeef', png);

    const got = await cache.get('deadbeef');
    assert.ok(Buffer.isBuffer(got));
    assert.equal(got.compare(png), 0);

    const files = await fs.promises.readdir(dir);
    assert.deepEqual(files, ['deadbeef.png']);
  } finally {
    await fs.promises.rm(dir, { recursive: true, force: true });
  }
});

test('disk cache creates directory if missing', async () => {
  const base = await fs.promises.mkdtemp(path.join(os.tmpdir(), 'aac-cache-base-'));
  const nested = path.join(base, 'nested', 'dir');
  try {
    const cache = createDiskCache(nested);
    await cache.set('h1', Buffer.from('x'));
    assert.ok(fs.existsSync(nested));
  } finally {
    await fs.promises.rm(base, { recursive: true, force: true });
  }
});
