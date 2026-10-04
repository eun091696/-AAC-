'use strict';

/**
 * Minimal structured logger. Only logs operational metadata (method, path,
 * status, duration, cache hit/miss, truncated hash). Never logs request
 * bodies (label/sentence text), API keys, or raw upstream error payloads.
 */
function createLogger(sink = console) {
  function log(event, fields = {}) {
    const safeFields = { ...fields };
    delete safeFields.apiKey;
    delete safeFields.label;
    delete safeFields.sentence;
    delete safeFields.visualMeaning;
    delete safeFields.meaning;
    delete safeFields.scene;
    delete safeFields.authorization;
    sink.log(JSON.stringify({ ts: new Date().toISOString(), event, ...safeFields }));
  }
  return { log };
}

module.exports = { createLogger };
