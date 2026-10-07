'use strict';

const http = require('node:http');

const { validateCardImageBody } = require('./validate');
const { resolveVisualMeaning } = require('./visualConcepts');
const { buildPrompt, PROMPT_TEMPLATE_VERSION } = require('./promptBuilder');
const { computeCacheKey } = require('./hash');
const { applyCors } = require('./cors');
const { OpenAITimeoutError } = require('./openaiClient');
const defaultLibrary = require('./library');
const { validateBoardBody, BOARD_PROMPT_VERSION } = require('./boardGenerator');

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
function createServer({
  config,
  openaiClient,
  cache,
  rateLimiter,
  concurrencyLimiter,
  logger,
  library = defaultLibrary,
  boardGenerator = null,
  retriever = null,
}) {
  // 같은 상황 문장은 다시 LLM을 부르지 않음 (비용 절약)
  const boardCache = new Map();
  const server = http.createServer(async (req, res) => {
    const start = Date.now();
    const url = new URL(req.url, `http://${req.headers.host || 'localhost'}`);

    if (applyCors(req, res, config.corsOrigins)) return;

    if (req.method === 'GET' && url.pathname === '/health') {
      sendJson(res, 200, { status: 'ok' });
      return;
    }

    if (url.pathname === '/v1/boards' && req.method === 'POST') {
      await handleBoard(req, res, start);
      return;
    }

    const isLookup = url.pathname === '/v1/card-images/lookup';
    const isGenerate = url.pathname === '/v1/card-images';
    if (req.method !== 'POST' || (!isLookup && !isGenerate)) {
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
    // `sentence`/any legacy speech text on the body is discarded by
    // validateCardImageBody already; only label/kind/visualMeaning survive
    // past this point, so no speech sentence can reach the provider or cache.
    const { label, kind, visualMeaning } = validation.value;

    // Resolve to a concrete, unambiguous (meaning, scene) BEFORE checking the
    // API key, cache, or provider — a missing/ambiguous/insufficient meaning
    // must never trigger a paid request or a cache lookup/write.
    const resolved = resolveVisualMeaning({ label, kind, visualMeaning });
    if (!resolved.ok) {
      const status = resolved.error === 'invalid_request' ? 400 : 422;
      const payload = { error: resolved.error, message: resolved.message, label, kind };
      if (resolved.choices) payload.choices = resolved.choices;
      sendJson(res, status, payload);
      return;
    }
    const { meaning, scene } = resolved;

    if (isLookup) {
      // Manually-reviewed library lookup: NEVER checks hasApiKey, NEVER reads
      // or writes the generation cache, and NEVER calls the provider. A miss
      // here just means the caller should fall back to generation.
      try {
        const entry = library.findApprovedEntry({ label, kind, meaning });
        const imageBuffer = entry ? await library.readApprovedImage(entry) : null;
        if (!entry || !imageBuffer) {
          sendJson(res, 200, { found: false });
          return;
        }
        sendJson(res, 200, {
          found: true,
          uri: `data:image/png;base64,${imageBuffer.toString('base64')}`,
          source: 'approved',
          visualMeaning: meaning,
        });
      } catch (err) {
        logger.log('library_lookup_error', { errorName: err && err.name });
        sendJson(res, 200, { found: false });
      }
      return;
    }

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
      kind,
      meaning,
      scene,
      templateVersion: PROMPT_TEMPLATE_VERSION,
      imageQuality: config.imageQuality,
      imageSize: config.imageSize,
    });

    try {
      const cached = await cache.get(cacheKey);
      if (cached) {
        logger.log('card_image_cache_hit', { hash: cacheKey.slice(0, 12) });
        sendJson(res, 200, {
          uri: `data:image/png;base64,${cached.toString('base64')}`,
          source: 'ai',
          visualMeaning: meaning,
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
      const prompt = buildPrompt({ label, kind, meaning, scene });
      const imageBuffer = await openaiClient.generateImage({
        prompt,
        size: config.imageSize,
        quality: config.imageQuality,
      });

      try {
        await cache.set(cacheKey, imageBuffer);
      } catch (err) {
        logger.log('cache_write_error', { hash: cacheKey.slice(0, 12) });
      }

      sendJson(res, 200, {
        uri: `data:image/png;base64,${imageBuffer.toString('base64')}`,
        source: 'ai',
        visualMeaning: meaning,
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

  async function handleBoard(req, res, start) {
    if (!boardGenerator) {
      sendJson(res, 503, { error: 'board_disabled', message: 'AI 판 만들기가 아직 연결되지 않았어요.' });
      return;
    }
    if (!rateLimiter.check(clientIp(req))) {
      sendJson(res, 429, { error: 'rate_limited', message: '요청이 너무 많습니다. 잠시 후 다시 시도하세요.' });
      return;
    }
    let body;
    try {
      body = JSON.parse((await readBody(req, config.maxBodyBytes)).toString('utf8') || '{}');
    } catch {
      sendJson(res, 400, { error: 'invalid_json', message: '요청을 읽을 수 없습니다.' });
      return;
    }
    const v = validateBoardBody(body);
    if (!v.ok) {
      sendJson(res, 400, { error: 'invalid_request', message: v.message });
      return;
    }
    const key = v.situation.toLowerCase();
    const hit = boardCache.get(key);
    if (hit) {
      sendJson(res, 200, { board: hit, cached: true, promptVersion: BOARD_PROMPT_VERSION });
      return;
    }
    const release = concurrencyLimiter.tryAcquire();
    if (!release) {
      sendJson(res, 503, { error: 'busy', message: '지금 요청이 많아요. 잠시 후 다시 시도해 주세요.' });
      return;
    }
    try {
      // RAG: 1) 상황과 가까운 기존 카드 이름을 LLM에 참고로 2) 만든 버튼에 검수 그림 연결
      const related = retriever ? await retriever.related(v.situation).catch(() => []) : [];
      const { board, usage } = await boardGenerator.generate(v.situation, related);
      let linked = 0;
      if (retriever) {
        const matches = await retriever.match(board.items.map((it) => ({ label: it.w, say: it.s })), { onError: (e) => logger.log('image_match_failed', { error: String(e.message).slice(0, 120) }) }).catch(() => null);
        matches?.forEach((m, i) => {
          if (m.id) { board.items[i].image = { source: 'bundled', id: m.id, visualMeaning: m.meaning || m.label }; linked += 1; }
        });
      }
      boardCache.set(key, board);
      if (boardCache.size > 300) boardCache.delete(boardCache.keys().next().value);
      logger.log('board_generated', { ms: Date.now() - start, model: boardGenerator.model, inTokens: usage?.input_tokens, outTokens: usage?.output_tokens, items: board.items.length, linkedImages: linked });
      sendJson(res, 200, { board, cached: false, promptVersion: BOARD_PROMPT_VERSION });
    } catch (err) {
      logger.log('board_failed', { ms: Date.now() - start, error: String(err.message).slice(0, 200) });
      const status = err.code === 'TIMEOUT' ? 504 : err.code === 'REFUSED' ? 422 : 502;
      sendJson(res, status, { error: 'board_failed', message: '판을 만들지 못했어요. 잠시 후 다시 시도해 주세요.' });
    } finally {
      release();
    }
  }

  return server;
}

module.exports = { createServer };
