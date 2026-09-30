'use strict';

const http = require('node:http');

const { validateCardImageBody } = require('./validate');
const { buildPrompt } = require('./promptBuilder');
const { computeCacheKey } = require('./hash');
const { applyCors } = require('./cors');
const { OpenAITimeoutError } = require('./openaiClient');

function sendJson(res, status, body) {
  const payload = JSON.stringify(body);
  res.writeHead(status, {
    'Content-Type': 'application/json; charset=utf-8',
    'Content-Length': Buffer.byteLength(payload),
  });
  res.end(payload);
}

function readBody(req, maxBytes) {
  return new Promise((resolve, reject) => {
    let total = 0;
    let exceeded = false;
    const chunks = [];
    req.on('data', (chunk) => {
      if (exceeded) return;
      total += chunk.length;
      if (total > maxBytes) {
        exceeded = true;
        reject(Object.assign(new Error('Payload too large'), { code: 'PAYLOAD_TOO_LARGE' }));
        return;
      }
      chunks.push(chunk);
    });
    req.on('end', () => resolve(Buffer.concat(chunks)));
    req.on('error', reject);
  });
}

function clientIp(req) {
  return req.socket.remoteAddress || 'unknown';
}

/**
 * Builds the HTTP server with all dependencies injected, so tests can supply
 * mocks for the OpenAI client, cache, rate limiter, and concurrency limiter
 * without making real paid network calls.
 */
function createServer({ config, openaiClient, cache, rateLimiter, concurrencyLimiter, logger }) {
  const server = http.createServer(async (req, res) => {
    const start = Date.now();
    const url = new URL(req.url, `http://${req.headers.host || 'localhost'}`);

    if (applyCors(req, res, config.corsOrigins)) return;

    if (req.method === 'GET' && url.pathname === '/health') {
      sendJson(res, 200, { status: 'ok' });
      return;
    }

    if (req.method !== 'POST' || url.pathname !== '/v1/card-images') {
      sendJson(res, 404, { error: 'not_found', message: '경로를 찾을 수 없습니다.' });
      return;
    }

    const ip = clientIp(req);
    if (!rateLimiter.check(ip)) {
      sendJson(res, 429, {
        error: 'rate_limited',
        message: '요청이 너무 많습니다. 잠시 후 다시 시도하세요.',
      });
      return;
    }

    let bodyBuf;
    try {
      bodyBuf = await readBody(req, config.maxBodyBytes);
    } catch (err) {
      if (err.code === 'PAYLOAD_TOO_LARGE') {
        sendJson(res, 413, { error: 'payload_too_large', message: '요청 본문이 너무 큽니다.' });
      } else {
        sendJson(res, 400, { error: 'bad_request', message: '요청을 읽을 수 없습니다.' });
      }
      return;
    }

    let parsedBody;
    try {
      parsedBody = bodyBuf.length ? JSON.parse(bodyBuf.toString('utf8')) : {};
    } catch {
      sendJson(res, 400, { error: 'invalid_json', message: 'JSON 형식이 올바르지 않습니다.' });
      return;
    }

    const validation = validateCardImageBody(parsedBody);
    if (!validation.ok) {
      sendJson(res, 400, { error: 'invalid_request', message: validation.message });
      return;
    }
    const { label, sentence, kind } = validation.value;

    if (!config.hasApiKey) {
      sendJson(res, 503, {
        error: 'service_unavailable',
        message: 'AI 이미지 생성 기능이 설정되지 않았습니다.',
      });
      return;
    }

    const cacheKey = computeCacheKey({
      model: config.model,
      promptVersion: config.promptVersion,
      label,
      sentence,
      kind,
    });

    try {
      const cached = await cache.get(cacheKey);
      if (cached) {
        logger.log('card_image_cache_hit', { hash: cacheKey.slice(0, 12) });
        sendJson(res, 200, {
          uri: `data:image/png;base64,${cached.toString('base64')}`,
          source: 'ai',
        });
        return;
      }
    } catch (err) {
      logger.log('cache_read_error', { hash: cacheKey.slice(0, 12) });
      // fall through to generation; cache errors should not block the request
    }

    const release = concurrencyLimiter.tryAcquire();
    if (!release) {
      sendJson(res, 429, {
        error: 'too_many_requests',
        message: '서버가 혼잡합니다. 잠시 후 다시 시도하세요.',
      });
      return;
    }

    try {
      const prompt = buildPrompt({ label, sentence, kind });
      const imageBuffer = await openaiClient.generateImage({ prompt, size: config.imageSize });

      try {
        await cache.set(cacheKey, imageBuffer);
      } catch (err) {
        logger.log('cache_write_error', { hash: cacheKey.slice(0, 12) });
      }

      sendJson(res, 200, {
        uri: `data:image/png;base64,${imageBuffer.toString('base64')}`,
        source: 'ai',
      });
      logger.log('card_image_generated', {
        hash: cacheKey.slice(0, 12),
        durationMs: Date.now() - start,
      });
    } catch (err) {
      if (err instanceof OpenAITimeoutError) {
        sendJson(res, 504, { error: 'timeout', message: '이미지 생성 시간이 초과되었습니다.' });
      } else {
        sendJson(res, 502, {
          error: 'upstream_error',
          message: '이미지 생성 서비스에 문제가 발생했습니다.',
        });
      }
      logger.log('card_image_error', {
        hash: cacheKey.slice(0, 12),
        errorName: err && err.name,
        durationMs: Date.now() - start,
      });
    } finally {
      release();
    }
  });

  return server;
}

module.exports = { createServer };
