'use strict';

/**
 * Bump this whenever the prompt template text changes meaningfully,
 * so cached images from the old wording are not served for new semantics.
 * (Also independently overridable via PROMPT_VERSION env for ops-side invalidation.)
 */
const PROMPT_TEMPLATE_VERSION = 'v1';

function kindHint(kind) {
  if (kind === 'p') return 'an expression or feeling/situation (표현)';
  if (kind === 'n') return 'a concrete noun or concept (명사)';
  return 'a concept';
}

/**
 * Builds a safe, simple, single-subject AAC illustration prompt.
 * No text/letters/words should appear in the image itself.
 */
function buildPrompt({ label, sentence, kind }) {
  const safeLabel = String(label).trim();
  const hint = kindHint(kind);
  const contextPart = sentence ? ` Context sentence in Korean: "${String(sentence).trim()}".` : '';

  return (
    `A single simple AAC (Augmentative and Alternative Communication) picture symbol ` +
    `representing the Korean word "${safeLabel}", which is ${hint}.${contextPart} ` +
    `Flat, minimal, friendly cartoon icon style. One clear centered subject only. ` +
    `Solid plain white background. No text, no letters, no numbers, no words, no captions, ` +
    `no watermark, no logo, no signature. Simple shapes, soft colors, high contrast, ` +
    `child-safe and appropriate for all ages. Designed for communication cards used by ` +
    `people with speech or developmental disabilities.`
  );
}

module.exports = { buildPrompt, PROMPT_TEMPLATE_VERSION };
