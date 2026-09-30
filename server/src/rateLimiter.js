'use strict';

/**
 * Fixed-window per-key (e.g. IP) rate limiter. Good enough to blunt abuse
 * for a small internal service; not distributed-safe (single process, in-memory).
 */
function createRateLimiter({ windowMs, max }, now = () => Date.now()) {
  const hits = new Map(); // key -> { count, windowStart }

  function check(key) {
    const t = now();
    const entry = hits.get(key);
    if (!entry || t - entry.windowStart >= windowMs) {
      hits.set(key, { count: 1, windowStart: t });
      return 1 <= max;
    }
    entry.count += 1;
    return entry.count <= max;
  }

  function reset() {
    hits.clear();
  }

  // Periodically forget stale keys so the map doesn't grow unbounded.
  function sweep() {
    const t = now();
    for (const [key, entry] of hits.entries()) {
      if (t - entry.windowStart >= windowMs) hits.delete(key);
    }
  }

  return { check, reset, sweep };
}

module.exports = { createRateLimiter };
