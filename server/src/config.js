'use strict';

function toInt(value, fallback) {
  if (value === undefined || value === null || value === '') return fallback;
  const n = Number.parseInt(value, 10);
  return Number.isFinite(n) ? n : fallback;
}

function toBool(value, fallback) {
  if (value === undefined || value === null || value === '') return fallback;
  return String(value).trim().toLowerCase() === 'true';
}

function parseOrigins(value) {
  if (!value) return [];
  return String(value)
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);
}

/**
 * Loads server configuration from an env-like object (defaults to process.env).
 * Never throws; missing API key just disables generation (surfaced as 503 at request time).
 */
function loadConfig(env = process.env) {
  const apiKey = env.OPENAI_API_KEY ? String(env.OPENAI_API_KEY) : '';
  return {
    host: env.HOST || '127.0.0.1',
    port: toInt(env.PORT, 8787),
    apiKey,
    hasApiKey: apiKey.length > 0,
    model: env.OPENAI_MODEL || 'gpt-image-1',
    imageSize: env.OPENAI_IMAGE_SIZE || '1024x1024',
    promptVersion: env.PROMPT_VERSION || 'v1',
    openaiTimeoutMs: toInt(env.OPENAI_TIMEOUT_MS, 85000),
    maxConcurrency: toInt(env.MAX_CONCURRENCY, 4),
    rateLimitWindowMs: toInt(env.RATE_LIMIT_WINDOW_MS, 60000),
    rateLimitMax: toInt(env.RATE_LIMIT_MAX, 30),
    maxBodyBytes: toInt(env.MAX_BODY_BYTES, 4096),
    cacheEnabled: toBool(env.CACHE_ENABLED, true),
    cacheDir: env.CACHE_DIR || './.cache',
    corsOrigins: parseOrigins(env.CORS_ORIGINS),
  };
}

module.exports = { loadConfig };
