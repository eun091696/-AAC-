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
    // gpt-image-1 is scheduled for OpenAI shutdown on 2026-10-23; default to
    // its recommended successor. OPENAI_MODEL still overrides this for any
    // deployment that needs a different model.
    model: env.OPENAI_MODEL || 'gpt-image-2.5-flare',
    // 판 만들기용 텍스트 모델 (OPENAI_TEXT_MODEL)
    textModel: env.OPENAI_TEXT_MODEL || 'gpt-5-mini',
    imageSize: env.OPENAI_IMAGE_SIZE || '1024x1024',
    imageQuality: env.OPENAI_IMAGE_QUALITY || 'medium',
    promptVersion: env.PROMPT_VERSION || 'v2-realistic',
    openaiTimeoutMs: toInt(env.OPENAI_TIMEOUT_MS, 85000),
    maxConcurrency: toInt(env.MAX_CONCURRENCY, 4),
    rateLimitWindowMs: toInt(env.RATE_LIMIT_WINDOW_MS, 60000),
    rateLimitMax: toInt(env.RATE_LIMIT_MAX, 30),
    maxBodyBytes: toInt(env.MAX_BODY_BYTES, 4096),
    cacheEnabled: toBool(env.CACHE_ENABLED, true),
    cacheDir: env.CACHE_DIR || './.cache',
    corsOrigins: parseOrigins(env.CORS_ORIGINS),
    // 로드밸런서 뒤에서 실제 사용자 IP를 X-Forwarded-For에서 읽음 (AWS 배포 시 true)
    trustProxy: toBool(env.TRUST_PROXY, false),
    // 하루 사용량 상한 (OpenAI 비용 보호)
    dailyBoardsPerUser: toInt(env.DAILY_BOARDS_PER_USER, 20),
    dailyBoardsTotal: toInt(env.DAILY_BOARDS_TOTAL, 300),
    dailyImagesPerUser: toInt(env.DAILY_IMAGES_PER_USER, 10),
    dailyImagesTotal: toInt(env.DAILY_IMAGES_TOTAL, 100),
  };
}

module.exports = { loadConfig };
