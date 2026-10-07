'use strict';

// OpenAI 임베딩 호출 + 벡터 계산 (외부 의존성 없음)
const EMBED_MODEL = 'text-embedding-3-large';
const EMBED_DIMS = 1024; // eval:match 측정: small(256) 1순위 적중 28/43 -> large(1024) 40/43. 3072와 차이 거의 없어 1024 사용

function createEmbedder({ apiKey, model = EMBED_MODEL, dims = EMBED_DIMS, timeoutMs = 15000, fetchImpl = fetch }) {
  return {
    model, dims,
    async embed(texts) {
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), timeoutMs);
      try {
        const res = await fetchImpl('https://api.openai.com/v1/embeddings', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${apiKey}` },
          body: JSON.stringify({ model, input: texts, dimensions: dims }),
          signal: controller.signal,
        });
        const json = await res.json().catch(() => ({}));
        if (!res.ok) throw Object.assign(new Error(`embed_error ${res.status}: ${json?.error?.message || ''}`), { status: res.status });
        return json.data.sort((a, b) => a.index - b.index).map((d) => normalize(d.embedding));
      } finally {
        clearTimeout(timer);
      }
    },
  };
}

function normalize(v) {
  let n = 0;
  for (const x of v) n += x * x;
  n = Math.sqrt(n) || 1;
  return v.map((x) => x / n);
}

/** 정규화된 벡터끼리의 코사인 유사도 = 내적 */
function cosine(a, b) {
  let s = 0;
  for (let i = 0; i < a.length; i++) s += a[i] * b[i];
  return s;
}

/** 그림 한 장을 설명하는 색인용 문장 */
const entryText = (e) => `${e.label} - ${e.visualMeaning}`;

module.exports = { createEmbedder, normalize, cosine, entryText, EMBED_MODEL, EMBED_DIMS };
