'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { createDailyQuota } = require('../src/dailyQuota');
const { createServer } = require('../src/server');
const { createMemoryCache } = require('../src/cache');
const { createRateLimiter } = require('../src/rateLimiter');
const { createConcurrencyLimiter } = require('../src/concurrencyLimiter');

test('하루 상한: 사용자별·전체 상한, 한국 시간 자정에 초기화', () => {
  let t = Date.parse('2026-10-07T14:00:00Z'); // KST 23:00
  const q = createDailyQuota({ perKey: 2, total: 3 }, () => t);
  assert.equal(q.tryUse('a').ok, true);
  assert.equal(q.tryUse('a').ok, true);
  assert.deepEqual(q.tryUse('a'), { ok: false, reason: 'user' });
  assert.equal(q.tryUse('b').ok, true);
  assert.deepEqual(q.tryUse('c'), { ok: false, reason: 'total' });
  t = Date.parse('2026-10-07T15:00:01Z'); // KST 다음날 00:00
  assert.equal(q.tryUse('a').ok, true);
});

async function start(config) {
  const server = createServer({
    config: { hasApiKey: true, maxBodyBytes: 4096, corsOrigins: [], dailyBoardsPerUser: 1, dailyBoardsTotal: 10, ...config },
    openaiClient: {}, cache: createMemoryCache(), logger: { log: () => {} },
    rateLimiter: createRateLimiter({ windowMs: 60000, max: 100 }), concurrencyLimiter: createConcurrencyLimiter(2),
    boardGenerator: { model: 'm', generate: async () => ({ board: { name: 'x', icon: '📍', items: [], l1: [], l3: [], pred: [], asks: [] }, usage: null }) },
  });
  await new Promise((r) => server.listen(0, '127.0.0.1', r));
  const post = (situation, ip) => fetch(`http://127.0.0.1:${server.address().port}/v1/boards`, { method: 'POST', headers: { 'Content-Type': 'application/json', ...(ip ? { 'X-Forwarded-For': ip } : {}) }, body: JSON.stringify({ situation }) });
  return { server, post };
}

test('판 만들기: 하루 상한을 넘으면 429, 같은 상황(캐시)은 상한에 안 셈', async () => {
  const { server, post } = await start({});
  try {
    assert.equal((await post('치과')).status, 200);
    assert.equal((await post('치과')).status, 200, '캐시 응답은 비용이 없으니 통과');
    const r = await post('미용실');
    assert.equal(r.status, 429);
    assert.equal((await r.json()).error, 'daily_limit');
  } finally { server.close(); }
});

test('TRUST_PROXY: 로드밸런서 뒤에서는 X-Forwarded-For로 사용자를 구분', async () => {
  const a = await start({ trustProxy: true });
  try {
    assert.equal((await a.post('치과', '1.1.1.1')).status, 200);
    assert.equal((await a.post('미용실', '2.2.2.2')).status, 200, '다른 사용자는 각자 상한');
    assert.equal((await a.post('카페', '1.1.1.1, 10.0.0.1')).status, 429);
  } finally { a.server.close(); }
  const b = await start({ trustProxy: false });
  try {
    assert.equal((await b.post('치과', '1.1.1.1')).status, 200);
    assert.equal((await b.post('미용실', '2.2.2.2')).status, 429, '설정을 안 켜면 헤더를 믿지 않음(위조 방지)');
  } finally { b.server.close(); }
});
