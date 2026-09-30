'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');

const { createServer } = require('../src/server');
const { createMemoryCache } = require('../src/cache');
const { createRateLimiter } = require('../src/rateLimiter');
const { createConcurrencyLimiter } = require('../src/concurrencyLimiter');
const { OpenAITimeoutError, OpenAIError } = require('../src/openaiClient');

const FAKE_PNG = Buffer.from('fake-png-bytes');

function baseConfig(overrides = {}) {
  return {
    host: '127.0.0.1',
    port: 0,
    hasApiKey: true,
    model: 'gpt-image-1',
    imageSize: '1024x1024',
    promptVersion: 'v1',
    maxBodyBytes: 4096,
    corsOrigins: [],
    ...overrides,
  };
}

function noopLogger() {
  return { log: () => {} };
}

async function startTestServer({
  config = baseConfig(),
  generateImage = async () => FAKE_PNG,
  cache = createMemoryCache(),
  rateLimiter = createRateLimiter({ windowMs: 60000, max: 1000 }),
  concurrencyLimiter = createConcurrencyLimiter(4),
} = {}) {
  const openaiClient = { generateImage };
  const server = createServer({
    config,
    openaiClient,
    cache,
    rateLimiter,
    concurrencyLimiter,
    logger: noopLogger(),
  });
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  const { port } = server.address();
  return {
    server,
    port,
    url: (p) => `http://127.0.0.1:${port}${p}`,
    close: () => new Promise((resolve) => server.close(resolve)),
  };
}

test('GET /health returns ok with no secrets', async () => {
  const ctx = await startTestServer();
  try {
    const res = await fetch(ctx.url('/health'));
    assert.equal(res.status, 200);
    const body = await res.json();
    assert.equal(body.status, 'ok');
    assert.equal(JSON.stringify(body).includes('sk-'), false);
    assert.equal('apiKey' in body, false);
  } finally {
    await ctx.close();
  }
});

test('unknown route returns 404', async () => {
  const ctx = await startTestServer();
  try {
    const res = await fetch(ctx.url('/nope'));
    assert.equal(res.status, 404);
  } finally {
    await ctx.close();
  }
});

test('POST /v1/card-images rejects invalid body with 400', async () => {
  const ctx = await startTestServer();
  try {
    const res = await fetch(ctx.url('/v1/card-images'), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({}),
    });
    assert.equal(res.status, 400);
    const body = await res.json();
    assert.equal(body.error, 'invalid_request');
  } finally {
    await ctx.close();
  }
});

test('POST /v1/card-images returns 503 when no API key configured', async () => {
  const ctx = await startTestServer({ config: baseConfig({ hasApiKey: false }) });
  try {
    const res = await fetch(ctx.url('/v1/card-images'), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ label: '사과' }),
    });
    assert.equal(res.status, 503);
    const body = await res.json();
    assert.equal(body.error, 'service_unavailable');
  } finally {
    await ctx.close();
  }
});

test('POST /v1/card-images returns generated image and uses cache on second call', async () => {
  let calls = 0;
  const cache = createMemoryCache();
  const ctx = await startTestServer({
    cache,
    generateImage: async () => {
      calls += 1;
      return FAKE_PNG;
    },
  });
  try {
    const res1 = await fetch(ctx.url('/v1/card-images'), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ label: '사과', kind: 'n' }),
    });
    assert.equal(res1.status, 200);
    const body1 = await res1.json();
    assert.equal(body1.source, 'ai');
    assert.equal(body1.uri, `data:image/png;base64,${FAKE_PNG.toString('base64')}`);
    assert.equal(calls, 1);

    const res2 = await fetch(ctx.url('/v1/card-images'), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ label: '사과', kind: 'n' }),
    });
    assert.equal(res2.status, 200);
    assert.equal(calls, 1, 'second identical request should be served from cache');
  } finally {
    await ctx.close();
  }
});

test('POST /v1/card-images returns 504 on upstream timeout', async () => {
  const ctx = await startTestServer({
    generateImage: async () => {
      throw new OpenAITimeoutError();
    },
  });
  try {
    const res = await fetch(ctx.url('/v1/card-images'), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ label: '사과' }),
    });
    assert.equal(res.status, 504);
    const body = await res.json();
    assert.equal(body.error, 'timeout');
  } finally {
    await ctx.close();
  }
});

test('POST /v1/card-images returns 502 on generic upstream error', async () => {
  const ctx = await startTestServer({
    generateImage: async () => {
      throw new OpenAIError('boom', { status: 500 });
    },
  });
  try {
    const res = await fetch(ctx.url('/v1/card-images'), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ label: '사과' }),
    });
    assert.equal(res.status, 502);
    const body = await res.json();
    assert.equal(body.error, 'upstream_error');
    assert.equal(JSON.stringify(body).includes('boom'), false, 'should not leak raw upstream error');
  } finally {
    await ctx.close();
  }
});

test('POST /v1/card-images returns 429 when rate limited', async () => {
  const rateLimiter = createRateLimiter({ windowMs: 60000, max: 0 });
  const ctx = await startTestServer({ rateLimiter });
  try {
    const res = await fetch(ctx.url('/v1/card-images'), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ label: '사과' }),
    });
    assert.equal(res.status, 429);
    const body = await res.json();
    assert.equal(body.error, 'rate_limited');
  } finally {
    await ctx.close();
  }
});

test('POST /v1/card-images returns 429 when concurrency limit exhausted', async () => {
  const concurrencyLimiter = createConcurrencyLimiter(1);
  concurrencyLimiter.tryAcquire(); // occupy the only slot
  const ctx = await startTestServer({ concurrencyLimiter });
  try {
    const res = await fetch(ctx.url('/v1/card-images'), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ label: '사과' }),
    });
    assert.equal(res.status, 429);
    const body = await res.json();
    assert.equal(body.error, 'too_many_requests');
  } finally {
    await ctx.close();
  }
});

test('POST /v1/card-images returns 413 for oversized body', async () => {
  const ctx = await startTestServer({ config: baseConfig({ maxBodyBytes: 10 }) });
  try {
    const res = await fetch(ctx.url('/v1/card-images'), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ label: '사과사과사과사과사과' }),
    });
    assert.equal(res.status, 413);
  } finally {
    await ctx.close();
  }
});

test('CORS: allowed origin gets Access-Control-Allow-Origin header', async () => {
  const ctx = await startTestServer({
    config: baseConfig({ corsOrigins: ['http://localhost:19006'] }),
  });
  try {
    const res = await fetch(ctx.url('/health'), {
      headers: { Origin: 'http://localhost:19006' },
    });
    assert.equal(res.headers.get('access-control-allow-origin'), 'http://localhost:19006');
  } finally {
    await ctx.close();
  }
});

test('CORS: disallowed origin gets no CORS header', async () => {
  const ctx = await startTestServer({
    config: baseConfig({ corsOrigins: ['http://localhost:19006'] }),
  });
  try {
    const res = await fetch(ctx.url('/health'), {
      headers: { Origin: 'http://evil.example.com' },
    });
    assert.equal(res.headers.get('access-control-allow-origin'), null);
  } finally {
    await ctx.close();
  }
});

test('CORS: OPTIONS preflight handled with 204', async () => {
  const ctx = await startTestServer({
    config: baseConfig({ corsOrigins: ['http://localhost:19006'] }),
  });
  try {
    const res = await fetch(ctx.url('/v1/card-images'), {
      method: 'OPTIONS',
      headers: { Origin: 'http://localhost:19006' },
    });
    assert.equal(res.status, 204);
  } finally {
    await ctx.close();
  }
});
