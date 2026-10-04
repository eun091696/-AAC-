'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');

const { createServer } = require('../src/server');
const { createMemoryCache } = require('../src/cache');
const { createRateLimiter } = require('../src/rateLimiter');
const { createConcurrencyLimiter } = require('../src/concurrencyLimiter');
const { OpenAITimeoutError, OpenAIError } = require('../src/openaiClient');

const FAKE_PNG = Buffer.from('fake-png-bytes');
const APPLE_MEANING = '먹는 과일 사과';

function baseConfig(overrides = {}) {
  return {
    host: '127.0.0.1',
    port: 0,
    hasApiKey: true,
    model: 'gpt-image-1',
    imageSize: '1024x1024',
    imageQuality: 'medium',
    promptVersion: 'v2-realistic',
    maxBodyBytes: 4096,
    corsOrigins: [],
    ...overrides,
  };
}

function noopLogger() {
  return { log: () => {} };
}

function fakeLibrary(entries = []) {
  return {
    findApprovedEntry({ label, kind, meaning }) {
      return (
        entries.find(
          (e) => e.label === label && e.kind === kind && e.visualMeaning === meaning,
        ) || null
      );
    },
    async readApprovedImage(entry) {
      return entry && entry.bytes ? entry.bytes : null;
    },
  };
}

async function startTestServer({
  config = baseConfig(),
  generateImage = async () => FAKE_PNG,
  cache = createMemoryCache(),
  rateLimiter = createRateLimiter({ windowMs: 60000, max: 1000 }),
  concurrencyLimiter = createConcurrencyLimiter(4),
  library = fakeLibrary(),
} = {}) {
  const openaiClient = { generateImage };
  const server = createServer({
    config,
    openaiClient,
    cache,
    rateLimiter,
    concurrencyLimiter,
    logger: noopLogger(),
    library,
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

test('POST /v1/card-images rejects invalid body with 400 (missing kind)', async () => {
  const ctx = await startTestServer();
  try {
    const res = await fetch(ctx.url('/v1/card-images'), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ label: '사과' }),
    });
    assert.equal(res.status, 400);
    const body = await res.json();
    assert.equal(body.error, 'invalid_request');
  } finally {
    await ctx.close();
  }
});

test('POST /v1/card-images returns 422 meaning_required for ambiguous noun without visualMeaning, before hasApiKey/provider/cache', async () => {
  let calls = 0;
  const ctx = await startTestServer({
    config: baseConfig({ hasApiKey: false }), // would be 503 if we got that far
    generateImage: async () => {
      calls += 1;
      return FAKE_PNG;
    },
  });
  try {
    const res = await fetch(ctx.url('/v1/card-images'), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ label: '사과', kind: 'n' }),
    });
    assert.equal(res.status, 422);
    const body = await res.json();
    assert.equal(body.error, 'meaning_required');
    assert.ok(Array.isArray(body.choices));
    assert.ok(body.choices.includes(APPLE_MEANING));
    assert.equal(calls, 0, 'no provider call should happen before meaning is resolved');
  } finally {
    await ctx.close();
  }
});

test('POST /v1/card-images returns 422 meaning_required for unknown noun without visualMeaning', async () => {
  const ctx = await startTestServer();
  try {
    const res = await fetch(ctx.url('/v1/card-images'), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ label: '기린', kind: 'n' }),
    });
    assert.equal(res.status, 422);
    const body = await res.json();
    assert.equal(body.error, 'meaning_required');
  } finally {
    await ctx.close();
  }
});

test('POST /v1/card-images returns 422 meaning_required for expressions (kind=p) without visualMeaning (no default smiley)', async () => {
  const ctx = await startTestServer();
  try {
    const res = await fetch(ctx.url('/v1/card-images'), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ label: '아파요', kind: 'p' }),
    });
    assert.equal(res.status, 422);
    const body = await res.json();
    assert.equal(body.error, 'meaning_required');
  } finally {
    await ctx.close();
  }
});

test('POST /v1/card-images accepts an ambiguous-noun visualMeaning that does not exactly match a curated choice (choices are suggestions, not a whitelist)', async () => {
  const ctx = await startTestServer();
  try {
    const res = await fetch(ctx.url('/v1/card-images'), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ label: '배', kind: 'n', visualMeaning: '사람이 몸의 배를 손으로 가리키는 장면' }),
    });
    assert.equal(res.status, 200);
    const body = await res.json();
    assert.equal(body.visualMeaning, '사람이 몸의 배를 손으로 가리키는 장면');
  } finally {
    await ctx.close();
  }
});

test('POST /v1/card-images returns 503 when no API key configured (after meaning resolves)', async () => {
  const ctx = await startTestServer({ config: baseConfig({ hasApiKey: false }) });
  try {
    const res = await fetch(ctx.url('/v1/card-images'), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ label: '사과', kind: 'n', visualMeaning: APPLE_MEANING }),
    });
    assert.equal(res.status, 503);
    const body = await res.json();
    assert.equal(body.error, 'service_unavailable');
  } finally {
    await ctx.close();
  }
});

test('POST /v1/card-images returns generated image + visualMeaning, and uses cache on second call', async () => {
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
      body: JSON.stringify({ label: '사과', kind: 'n', visualMeaning: APPLE_MEANING }),
    });
    assert.equal(res1.status, 200);
    const body1 = await res1.json();
    assert.equal(body1.source, 'ai');
    assert.equal(body1.visualMeaning, APPLE_MEANING);
    assert.equal(body1.uri, `data:image/png;base64,${FAKE_PNG.toString('base64')}`);
    assert.equal(calls, 1);

    const res2 = await fetch(ctx.url('/v1/card-images'), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ label: '사과', kind: 'n', visualMeaning: APPLE_MEANING }),
    });
    assert.equal(res2.status, 200);
    const body2 = await res2.json();
    assert.equal(body2.visualMeaning, APPLE_MEANING);
    assert.equal(calls, 1, 'second identical request should be served from cache');
  } finally {
    await ctx.close();
  }
});

test('same label, different resolved meaning (ambiguous), does NOT share a cache entry', async () => {
  let calls = 0;
  const cache = createMemoryCache();
  const ctx = await startTestServer({
    cache,
    generateImage: async () => {
      calls += 1;
      return Buffer.from(`image-${calls}`);
    },
  });
  try {
    const resFruit = await fetch(ctx.url('/v1/card-images'), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ label: '사과', kind: 'n', visualMeaning: '먹는 과일 사과' }),
    });
    const resApology = await fetch(ctx.url('/v1/card-images'), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ label: '사과', kind: 'n', visualMeaning: '잘못에 대해 사과하기' }),
    });
    assert.equal(resFruit.status, 200);
    assert.equal(resApology.status, 200);
    assert.equal(calls, 2, 'two different meanings for the same label must both hit the provider');
    const bodyFruit = await resFruit.json();
    const bodyApology = await resApology.json();
    assert.notEqual(bodyFruit.uri, bodyApology.uri);
  } finally {
    await ctx.close();
  }
});

test('legacy sentence field is ignored: identical label/kind/visualMeaning hits the same cache entry regardless of sentence', async () => {
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
    await fetch(ctx.url('/v1/card-images'), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ label: '사과', kind: 'n', visualMeaning: APPLE_MEANING, sentence: '사과를 먹고 싶어요' }),
    });
    const res2 = await fetch(ctx.url('/v1/card-images'), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ label: '사과', kind: 'n', visualMeaning: APPLE_MEANING, sentence: '완전히 다른 문장입니다' }),
    });
    assert.equal(res2.status, 200);
    assert.equal(calls, 1, 'different sentence text must not bust the cache or trigger a second provider call');
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
      body: JSON.stringify({ label: '사과', kind: 'n', visualMeaning: APPLE_MEANING }),
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
      body: JSON.stringify({ label: '사과', kind: 'n', visualMeaning: APPLE_MEANING }),
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
      body: JSON.stringify({ label: '사과', kind: 'n', visualMeaning: APPLE_MEANING }),
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
      body: JSON.stringify({ label: '사과', kind: 'n', visualMeaning: APPLE_MEANING }),
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
      body: JSON.stringify({ label: '사과사과사과사과사과', kind: 'n' }),
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

// --- /v1/card-images/lookup -------------------------------------------------

test('POST /v1/card-images/lookup returns found:false when nothing is approved, with no provider/API key needed', async () => {
  let calls = 0;
  const ctx = await startTestServer({
    config: baseConfig({ hasApiKey: false }),
    generateImage: async () => {
      calls += 1;
      return FAKE_PNG;
    },
    library: fakeLibrary([]),
  });
  try {
    const res = await fetch(ctx.url('/v1/card-images/lookup'), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ label: '사과', kind: 'n', visualMeaning: APPLE_MEANING }),
    });
    assert.equal(res.status, 200);
    const body = await res.json();
    assert.equal(body.found, false);
    assert.equal(calls, 0, 'lookup must never call the provider');
  } finally {
    await ctx.close();
  }
});

test('POST /v1/card-images/lookup returns found:true with the approved image for an exact label+kind+meaning match', async () => {
  const approvedBytes = Buffer.from('approved-png-bytes');
  const ctx = await startTestServer({
    config: baseConfig({ hasApiKey: false }),
    library: fakeLibrary([
      { label: '사과', kind: 'n', visualMeaning: APPLE_MEANING, bytes: approvedBytes },
    ]),
  });
  try {
    const res = await fetch(ctx.url('/v1/card-images/lookup'), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ label: '사과', kind: 'n', visualMeaning: APPLE_MEANING }),
    });
    assert.equal(res.status, 200);
    const body = await res.json();
    assert.equal(body.found, true);
    assert.equal(body.source, 'approved');
    assert.equal(body.visualMeaning, APPLE_MEANING);
    assert.equal(body.uri, `data:image/png;base64,${approvedBytes.toString('base64')}`);
  } finally {
    await ctx.close();
  }
});

test('POST /v1/card-images/lookup only matches the exact resolved meaning (different ambiguous sense -> found:false)', async () => {
  const approvedBytes = Buffer.from('approved-png-bytes');
  const ctx = await startTestServer({
    config: baseConfig({ hasApiKey: false }),
    library: fakeLibrary([
      { label: '사과', kind: 'n', visualMeaning: '먹는 과일 사과', bytes: approvedBytes },
    ]),
  });
  try {
    const res = await fetch(ctx.url('/v1/card-images/lookup'), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ label: '사과', kind: 'n', visualMeaning: '잘못에 대해 사과하기' }),
    });
    assert.equal(res.status, 200);
    const body = await res.json();
    assert.equal(body.found, false);
  } finally {
    await ctx.close();
  }
});

test('POST /v1/card-images/lookup still returns 422 meaning_required for ambiguous/unknown words without visualMeaning', async () => {
  const ctx = await startTestServer({ config: baseConfig({ hasApiKey: false }) });
  try {
    const res = await fetch(ctx.url('/v1/card-images/lookup'), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ label: '사과', kind: 'n' }),
    });
    assert.equal(res.status, 422);
    const body = await res.json();
    assert.equal(body.error, 'meaning_required');
  } finally {
    await ctx.close();
  }
});

test('POST /v1/card-images/lookup for a curated unambiguous noun works without visualMeaning', async () => {
  const approvedBytes = Buffer.from('water-png-bytes');
  const ctx = await startTestServer({
    config: baseConfig({ hasApiKey: false }),
    library: fakeLibrary([
      { label: '물', kind: 'n', visualMeaning: '마시는 물(음료)', bytes: approvedBytes },
    ]),
  });
  try {
    const res = await fetch(ctx.url('/v1/card-images/lookup'), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ label: '물', kind: 'n' }),
    });
    assert.equal(res.status, 200);
    const body = await res.json();
    assert.equal(body.found, true);
    assert.equal(body.visualMeaning, '마시는 물(음료)');
  } finally {
    await ctx.close();
  }
});

test('POST /v1/card-images/lookup never touches the generation cache', async () => {
  let getCalls = 0;
  let setCalls = 0;
  const cache = {
    async get() {
      getCalls += 1;
      return null;
    },
    async set() {
      setCalls += 1;
    },
  };
  const ctx = await startTestServer({
    config: baseConfig({ hasApiKey: false }),
    cache,
    library: fakeLibrary([]),
  });
  try {
    await fetch(ctx.url('/v1/card-images/lookup'), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ label: '사과', kind: 'n', visualMeaning: APPLE_MEANING }),
    });
    assert.equal(getCalls, 0);
    assert.equal(setCalls, 0);
  } finally {
    await ctx.close();
  }
});
