'use strict';

const LABEL_MAX = 80;
const SENTENCE_MAX = 160;
const VALID_KINDS = new Set(['n', 'p']);

/**
 * Validates POST /v1/card-images body.
 * Returns { ok: true, value: { label, sentence, kind } } or { ok: false, message }.
 */
function validateCardImageBody(body) {
  if (body === null || typeof body !== 'object' || Array.isArray(body)) {
    return { ok: false, message: '요청 본문이 올바르지 않습니다.' };
  }

  const { label, sentence, kind } = body;

  if (typeof label !== 'string' || label.trim().length === 0) {
    return { ok: false, message: 'label은 필수 문자열입니다.' };
  }
  const trimmedLabel = label.trim();
  if (trimmedLabel.length > LABEL_MAX) {
    return { ok: false, message: `label은 ${LABEL_MAX}자 이하여야 합니다.` };
  }

  let trimmedSentence;
  if (sentence !== undefined && sentence !== null) {
    if (typeof sentence !== 'string') {
      return { ok: false, message: 'sentence는 문자열이어야 합니다.' };
    }
    trimmedSentence = sentence.trim();
    if (trimmedSentence.length > SENTENCE_MAX) {
      return { ok: false, message: `sentence는 ${SENTENCE_MAX}자 이하여야 합니다.` };
    }
    if (trimmedSentence.length === 0) trimmedSentence = undefined;
  }

  let normalizedKind;
  if (kind !== undefined && kind !== null && kind !== '') {
    if (typeof kind !== 'string' || !VALID_KINDS.has(kind)) {
      return { ok: false, message: "kind는 'n' 또는 'p'만 허용됩니다." };
    }
    normalizedKind = kind;
  }

  return {
    ok: true,
    value: {
      label: trimmedLabel,
      sentence: trimmedSentence,
      kind: normalizedKind,
    },
  };
}

module.exports = { validateCardImageBody, LABEL_MAX, SENTENCE_MAX };
