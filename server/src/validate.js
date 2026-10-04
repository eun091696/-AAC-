'use strict';

const { VISUAL_MEANING_MAX } = require('./visualConcepts');

const LABEL_MAX = 80;
const VALID_KINDS = new Set(['n', 'p']);

/**
 * Validates POST /v1/card-images body against the current contract:
 *   { label: string, kind: 'n' | 'p', visualMeaning?: string }
 *
 * Legacy/unknown fields (including any leftover `sentence`) are accepted on
 * the wire but fully ignored here and everywhere downstream: no speech
 * sentence is ever read, used in a prompt, sent to the provider, or folded
 * into the cache key. This function only checks shape/length; whether a
 * given visualMeaning is *required* (e.g. for ambiguous words or
 * expressions) is decided afterward by resolveVisualMeaning, which can
 * return 422.
 *
 * Returns { ok: true, value: { label, kind, visualMeaning } } or
 * { ok: false, message }.
 */
function validateCardImageBody(body) {
  if (body === null || typeof body !== 'object' || Array.isArray(body)) {
    return { ok: false, message: '요청 본문이 올바르지 않습니다.' };
  }

  const { label, kind, visualMeaning } = body;
  // `sentence` and any other field on `body` are intentionally never read.

  if (typeof label !== 'string' || label.trim().length === 0) {
    return { ok: false, message: 'label은 필수 문자열입니다.' };
  }
  const trimmedLabel = label.trim();
  if (trimmedLabel.length > LABEL_MAX) {
    return { ok: false, message: `label은 ${LABEL_MAX}자 이하여야 합니다.` };
  }

  if (typeof kind !== 'string' || !VALID_KINDS.has(kind)) {
    return { ok: false, message: "kind는 'n' 또는 'p'가 필수입니다." };
  }

  let trimmedVisualMeaning;
  if (visualMeaning !== undefined && visualMeaning !== null) {
    if (typeof visualMeaning !== 'string') {
      return { ok: false, message: 'visualMeaning은 문자열이어야 합니다.' };
    }
    trimmedVisualMeaning = visualMeaning.trim();
    if (trimmedVisualMeaning.length > VISUAL_MEANING_MAX) {
      return { ok: false, message: `visualMeaning은 ${VISUAL_MEANING_MAX}자 이하여야 합니다.` };
    }
    if (trimmedVisualMeaning.length === 0) trimmedVisualMeaning = undefined;
  }

  return {
    ok: true,
    value: {
      label: trimmedLabel,
      kind,
      visualMeaning: trimmedVisualMeaning,
    },
  };
}

module.exports = { validateCardImageBody, LABEL_MAX, VISUAL_MEANING_MAX };
