'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');

const { loadConfig } = require('../src/config');

test('default promptVersion matches the v2-realistic template', () => {
  const config = loadConfig({});
  assert.equal(config.promptVersion, 'v2-realistic');
});

test('default imageQuality is medium', () => {
  const config = loadConfig({});
  assert.equal(config.imageQuality, 'medium');
});

test('env overrides promptVersion and imageQuality', () => {
  const config = loadConfig({ PROMPT_VERSION: 'v3-test', OPENAI_IMAGE_QUALITY: 'high' });
  assert.equal(config.promptVersion, 'v3-test');
  assert.equal(config.imageQuality, 'high');
});

test('hasApiKey is false when OPENAI_API_KEY is unset (no real key needed for tests)', () => {
  const config = loadConfig({});
  assert.equal(config.hasApiKey, false);
  assert.equal(config.apiKey, '');
});

test('hasApiKey is true only when OPENAI_API_KEY is a non-empty string', () => {
  const config = loadConfig({ OPENAI_API_KEY: 'sk-fake-for-shape-check-only' });
  assert.equal(config.hasApiKey, true);
});
