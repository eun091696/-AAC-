'use strict';

const crypto = require('node:crypto');

/**
 * Deterministic cache key covering everything that affects the generated image,
 * so bumping model or prompt version naturally busts stale cache entries.
 */
function computeCacheKey({ model, promptVersion, label, sentence, kind }) {
  const payload = JSON.stringify({
    model,
    promptVersion,
    label: label || '',
    sentence: sentence || '',
    kind: kind || '',
  });
  return crypto.createHash('sha256').update(payload).digest('hex');
}

module.exports = { computeCacheKey };
