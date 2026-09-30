'use strict';

const fs = require('node:fs');
const path = require('node:path');

/**
 * Disk-backed cache keyed by hash -> PNG bytes.
 * Filenames are opaque hashes only; no label/sentence text is stored on disk.
 */
function createDiskCache(dir) {
  fs.mkdirSync(dir, { recursive: true });

  function filePath(hash) {
    return path.join(dir, `${hash}.png`);
  }

  return {
    async get(hash) {
      try {
        return await fs.promises.readFile(filePath(hash));
      } catch (err) {
        if (err && err.code === 'ENOENT') return null;
        throw err;
      }
    },
    async set(hash, buffer) {
      const tmp = `${filePath(hash)}.${process.pid}.${Date.now()}.tmp`;
      await fs.promises.writeFile(tmp, buffer);
      await fs.promises.rename(tmp, filePath(hash));
    },
  };
}

/** Simple in-memory cache, used in tests and as a fallback when disk cache is disabled. */
function createMemoryCache() {
  const store = new Map();
  return {
    async get(hash) {
      return store.has(hash) ? store.get(hash) : null;
    },
    async set(hash, buffer) {
      store.set(hash, buffer);
    },
  };
}

/** No-op cache: always misses, never stores. */
function createNullCache() {
  return {
    async get() {
      return null;
    },
    async set() {},
  };
}

module.exports = { createDiskCache, createMemoryCache, createNullCache };
