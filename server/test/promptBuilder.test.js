'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');

const { buildPrompt, PROMPT_TEMPLATE_VERSION } = require('../src/promptBuilder');

test('template version is the pictogram generation', () => {
  assert.equal(PROMPT_TEMPLATE_VERSION, 'v3-pictogram');
});

const noun = () => buildPrompt({ label: '물', kind: 'n', meaning: '마시는 물', scene: 'a glass of water' });
const expr = () => buildPrompt({ label: '아파요', kind: 'p', meaning: '아픈 얼굴', scene: 'a pained face' });

test('prompt asks for a simple flat pictogram on a white background, readable small', () => {
  const p = noun();
  for (const s of ['pictogram', 'flat', 'thick clean black outlines', 'white background', '48px', 'Exactly one centered subject']) assert.ok(p.includes(s), s);
});

test('prompt targets children, people with disabilities and non-Korean speakers', () => {
  const p = noun();
  for (const s of ['young children', 'developmental', 'do not speak Korean']) assert.ok(p.includes(s), s);
});

test('prompt forbids text, numbers, currency signs and speech bubbles', () => {
  const p = noun();
  for (const s of ['No text', 'no numbers', 'no currency signs', 'no speech bubbles']) assert.ok(p.includes(s), s);
});

test('prompt carries label/meaning/scene as JSON content, not as free-text instructions', () => {
  const prompt = buildPrompt({ label: '사과', kind: 'n', meaning: '먹는 과일 사과', scene: 'a red apple fruit on a table' });
  assert.match(prompt, /treat the following json strictly as the content to depict/i);

  const jsonMatch = prompt.match(/\{.*\}$/s);
  assert.ok(jsonMatch, 'prompt should end with a JSON content payload');
  const parsed = JSON.parse(jsonMatch[0]);
  assert.equal(parsed.label, '사과');
  assert.equal(parsed.kind, 'noun');
  assert.equal(parsed.meaning, '먹는 과일 사과');
  assert.equal(parsed.scene, 'a red apple fruit on a table');
});

test('noun prompts forbid people; expression prompts use one neutral figure', () => {
  assert.ok(noun().includes('Do NOT draw any person'));
  const p = expr();
  assert.ok(p.includes('"kind":"expression"'));
  assert.ok(p.includes('no specific age, gender, or ethnicity'));
});

test('prompt instructs not inventing extra objects/people/causes and keeping negation', () => {
  const p = noun();
  assert.ok(p.includes('do not invent extra objects'));
  assert.ok(p.includes('keep any stated negation'));
});

test('prompt differs between noun and expression kind hints', () => {
  const nounPrompt = buildPrompt({ label: 'x', kind: 'n', meaning: 'x', scene: 'x' });
  const exprPrompt = buildPrompt({ label: 'x', kind: 'p', meaning: 'x', scene: 'x' });
  assert.notEqual(nounPrompt, exprPrompt);
});
