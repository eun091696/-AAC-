'use strict';

const fs = require('node:fs');
const path = require('node:path');

const DATA_PATH = path.join(__dirname, '..', '..', 'shared', 'visualConcepts.json');
const VISUAL_MEANING_MAX = 240;

let cachedData = null;

/**
 * Loads shared/visualConcepts.json (the single curated dictionary shared
 * with the app). Cached in memory after first read; tests can bypass the
 * cache entirely by passing their own `data` object to resolveVisualMeaning.
 */
function loadData() {
  if (cachedData) return cachedData;
  const raw = fs.readFileSync(DATA_PATH, 'utf8');
  const parsed = JSON.parse(raw);
  cachedData = {
    nouns: parsed.nouns || {},
    ambiguous: parsed.ambiguous || {},
  };
  return cachedData;
}

function normalizeVisualMeaning(visualMeaning) {
  if (visualMeaning === undefined || visualMeaning === null) {
    return { ok: true, value: undefined };
  }
  if (typeof visualMeaning !== 'string') {
    return { ok: false, message: 'visualMeaning은 문자열이어야 합니다.' };
  }
  const trimmed = visualMeaning.trim();
  if (trimmed.length === 0) return { ok: true, value: undefined };
  if (trimmed.length > VISUAL_MEANING_MAX) {
    return { ok: false, message: `visualMeaning은 ${VISUAL_MEANING_MAX}자 이하여야 합니다.` };
  }
  return { ok: true, value: trimmed };
}

/**
 * Resolves (label, kind, guardian-supplied visualMeaning) into a concrete,
 * unambiguous { meaning, scene } pair used for both the image prompt and the
 * cache key.
 *
 * Design intent (AAC clarity for users with language/developmental
 * disabilities and non-native speakers): never substitute an abstract
 * symbol, emoji, metaphor, or invented default for a word that has more than
 * one common concrete real-world sense, and never auto-generate a feeling
 * illustration (no generic smiley) without the guardian's own description of
 * the actual situation/action. For ambiguous words, curated choices are UI
 * suggestions, not a strict whitelist: an exact match reuses that curated
 * (meaning, scene) pair, and any other non-empty explicit description is
 * still accepted verbatim — a meaning is only ever rejected for being
 * missing, not for failing to match a suggestion. This function cannot and
 * does not judge whether free-text guardian input is semantically good;
 * that remains the guardian's/a reviewer's responsibility.
 *
 * Returns one of:
 *   { ok: true, meaning, scene }
 *   { ok: false, error: 'invalid_request', message }          // bad shape/length
 *   { ok: false, error: 'meaning_required', message, choices? } // missing/ambiguous
 */
function resolveVisualMeaning({ label, kind, visualMeaning }, data = loadData()) {
  const normalized = normalizeVisualMeaning(visualMeaning);
  if (!normalized.ok) {
    return { ok: false, error: 'invalid_request', message: normalized.message };
  }
  const guardianMeaning = normalized.value;

  if (kind === 'p') {
    // Expressions / feelings / situations: always require the guardian's own
    // concrete description of what is actually happening. No default happy
    // or sad face is ever synthesized.
    if (!guardianMeaning) {
      return {
        ok: false,
        error: 'meaning_required',
        message:
          '표현(kind=p)은 실제 상황/행동을 구체적으로 설명한 visualMeaning이 반드시 필요합니다. 단순한 표정 아이콘으로 대체할 수 없습니다.',
      };
    }
    return { ok: true, meaning: guardianMeaning, scene: guardianMeaning };
  }

  // kind === 'n'
  if (Object.prototype.hasOwnProperty.call(data.ambiguous, label)) {
    const choices = data.ambiguous[label] || [];
    if (!guardianMeaning) {
      // Never auto-pick a sense for a word with more than one common
      // concrete meaning. `choices` are curated UI suggestions, NOT a
      // strict whitelist: a guardian may also type a more specific literal
      // scene description instead of picking one verbatim. Either way, an
      // explicit non-empty description is always required here.
      return {
        ok: false,
        error: 'meaning_required',
        message: `"${label}"은 여러 가지 구체적인 뜻을 가진 단어입니다. 보호자가 의미나 구체적인 장면을 설명해야 합니다.`,
        choices,
      };
    }
    // If the text matches a curated choice exactly, keep using that choice
    // as-is. Otherwise, trust the guardian's own explicit literal
    // description verbatim (never rewritten) — we only require that
    // *some* non-empty description was given, not that it matches a
    // suggestion. This function cannot verify that free text is
    // semantically correct; that remains the guardian's/a reviewer's call.
    return { ok: true, meaning: guardianMeaning, scene: guardianMeaning };
  }

  if (Object.prototype.hasOwnProperty.call(data.nouns, label)) {
    const entry = data.nouns[label];
    // A curated unambiguous noun defaults to the dictionary's own
    // (meaning, scene). A guardian MAY override it with a more specific
    // explicit description; when they do, that description is used
    // verbatim for both meaning and scene (never merged/rewritten). If the
    // guardian's text happens to equal the curated meaning exactly, that's
    // just the default case.
    if (guardianMeaning && guardianMeaning !== entry.meaning) {
      return { ok: true, meaning: guardianMeaning, scene: guardianMeaning };
    }
    return { ok: true, meaning: entry.meaning, scene: entry.scene };
  }

  // Unknown noun: not in the curated dictionary. We refuse to invent a
  // meaning/scene for it ourselves.
  if (!guardianMeaning) {
    return {
      ok: false,
      error: 'meaning_required',
      message: `"${label}"은 사전에 없는 단어입니다. 보호자가 구체적인 장면(visualMeaning)을 입력해야 합니다.`,
    };
  }
  return { ok: true, meaning: guardianMeaning, scene: guardianMeaning };
}

module.exports = {
  resolveVisualMeaning,
  loadData,
  normalizeVisualMeaning,
  VISUAL_MEANING_MAX,
  DATA_PATH,
};
