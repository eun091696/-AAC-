#!/usr/bin/env node
'use strict';

const path = require('node:path');

const { loadConfig } = require('../src/config');
const { createServer } = require('../src/server');
const { createOpenAIClient } = require('../src/openaiClient');
const { createDiskCache, createNullCache } = require('../src/cache');
const { createRateLimiter } = require('../src/rateLimiter');
const { createConcurrencyLimiter } = require('../src/concurrencyLimiter');
const { createLogger } = require('../src/logger');

const config = loadConfig(process.env);
const logger = createLogger(console);

const openaiClient = createOpenAIClient({
  apiKey: config.apiKey,
  model: config.model,
  timeoutMs: config.openaiTimeoutMs,
});

const cache = config.cacheEnabled
  ? createDiskCache(path.resolve(config.cacheDir))
  : createNullCache();

const rateLimiter = createRateLimiter({
  windowMs: config.rateLimitWindowMs,
  max: config.rateLimitMax,
});
setInterval(() => rateLimiter.sweep(), Math.min(config.rateLimitWindowMs, 60000)).unref();

const concurrencyLimiter = createConcurrencyLimiter(config.maxConcurrency);

const server = createServer({ config, openaiClient, cache, rateLimiter, concurrencyLimiter, logger });

server.listen(config.port, config.host, () => {
  logger.log('server_started', {
    host: config.host,
    port: config.port,
    hasApiKey: config.hasApiKey,
    cacheEnabled: config.cacheEnabled,
  });
  if (!config.hasApiKey) {
    // eslint-disable-next-line no-console
    console.warn(
      'OPENAI_API_KEY가 설정되지 않았습니다. /v1/card-images 요청은 503을 반환합니다.',
    );
  }
});

module.exports = { server, config };
