'use strict';

/**
 * Caps the number of in-flight upstream (OpenAI) calls.
 * tryAcquire() returns a release() function on success, or null when at capacity.
 */
function createConcurrencyLimiter(max) {
  let active = 0;

  function tryAcquire() {
    if (active >= max) return null;
    active += 1;
    let released = false;
    return function release() {
      if (released) return;
      released = true;
      active -= 1;
    };
  }

  return {
    tryAcquire,
    get active() {
      return active;
    },
    get max() {
      return max;
    },
  };
}

module.exports = { createConcurrencyLimiter };
