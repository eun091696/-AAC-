'use strict';

const crypto = require('node:crypto');

/**
 * Deterministic cache key covering everything that affects the generated
 * image, so bumping model/prompt version/image size naturally busts stale
 * cache entries, and so the SAME label resolved to a DIFFERENT meaning
 * (e.g. an ambiguous word disambiguated two different ways, or two
 * different guardian-provided scenes for an unknown word) never collides on
 * the same cached image. `sentence`/speech text is never part of this key:
 * the new contract does not send or cache any speech sentence.
 */
function computeCacheKey({ model, promptVersion, label, kind, meaning, scene, imageSize, imageQuality, templateVersion }) {
  const payload = JSON.stringify({
    model: model || '',
    promptVersion: promptVersion || '',
    label: label || '',
    kind: kind || '',
    meaning: meaning || '',
    scene: scene || '',
    templateVersion: templateVersion || '',
    imageQuality: imageQuality || '',
    imageSize: imageSize || '',
  });
  return crypto.createHash('sha256').update(payload).digest('hex');
}

module.exports = { computeCacheKey };
