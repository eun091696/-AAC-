'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');

const { buildPrompt } = require('../src/promptBuilder');

test('prompt includes label and forbids text/letters', () => {
  const prompt = buildPrompt({ label: '사과', sentence: undefined, kind: 'n' });
  assert.match(prompt, /사과/);
  assert.match(prompt, /no text/i);
  assert.match(prompt, /no letters/i);
  assert.match(prompt, /white background/i);
});

test('prompt includes sentence context when provided', () => {
  const prompt = buildPrompt({ label: '아파요', sentence: '배가 아파요', kind: 'p' });
  assert.match(prompt, /아파요/);
  assert.match(prompt, /배가 아파요/);
});

test('prompt omits context sentence phrase when sentence absent', () => {
  const prompt = buildPrompt({ label: '사과', kind: 'n' });
  assert.doesNotMatch(prompt, /Context sentence/);
});

test('prompt differs by kind hint text', () => {
  const nounPrompt = buildPrompt({ label: 'x', kind: 'n' });
  const phrasePrompt = buildPrompt({ label: 'x', kind: 'p' });
  assert.notEqual(nounPrompt, phrasePrompt);
});
