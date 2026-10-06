'use strict';

// 검수 그림 의미 검색 (RAG)
// - 벡터는 메모리에 두고 내적으로 비교 (수백 개 규모에서는 벡터 DB보다 단순·빠름)
const fs = require('node:fs');
const path = require('node:path');
const { cosine } = require('./embeddings');

// eval/image-match.json 으로 측정해서 정한 값 (npm run eval:match)
const DEFAULT_THRESHOLD = 0.65; // LLM 판단 없이 쓸 때: large(1024) 기준 정확도 1.00 지점
const K = 5; // 후보 수 (large 상위 5개 적중 42/43)
const FLOOR = 0.3;
// 같은 글자에 다른 뜻이 있는 그림 이름: 이름이 같아도 LLM 판단을 거침 (배=몸/과일/탈것, 눈=신체/날씨 ...)
const POLYSEMOUS = new Set(['배', '눈', '이', '다리', '등', '목', '팔', '발', '말', '차', '밤', '병']);

const norm = (s) => String(s || '').replace(/[\s?!.]/g, '');
const queryText = (label, say) => (say && norm(say) !== norm(label) ? `${label} - ${say}` : label);

function loadIndex(file = path.join(__dirname, '..', 'library', 'embeddings.json')) {
  try {
    return JSON.parse(fs.readFileSync(file, 'utf8'));
  } catch {
    return null;
  }
}

function createRetriever({ index, embedder, judge: defaultJudge = null, threshold = DEFAULT_THRESHOLD }) {
  const entries = index?.entries || [];
  const byLabel = new Map(entries.map((e) => [norm(e.label), e]));

  const rank = (vec, k) => entries.map((e) => ({ e, score: cosine(vec, e.vector) })).sort((a, b) => b.score - a.score).slice(0, k);

  return {
    size: entries.length,
    threshold,
    /** 상황 문장과 가까운 기존 카드 이름 (LLM에 참고로 전달) */
    async related(situation, k = 20) {
      if (!entries.length) return [];
      const [vec] = await embedder.embed([situation]);
      return rank(vec, k).map((r) => r.e.label);
    },
    /**
     * 버튼마다 그림 찾기
     * 1) 임베딩으로 후보 K개 (점수 floor 이상)
     * 2) judge(LLM)가 있으면 후보 중 정확한 것만 고름. 없거나 실패하면 이름 정확 일치 + 높은 기준점수만 사용
     */
    async match(items, opts = {}) {
      const t = opts.threshold ?? threshold;
      const judge = opts.judge === undefined ? defaultJudge : opts.judge;
      if (!entries.length || !items.length) return items.map(() => ({ id: null, label: null, score: 0, how: 'none' }));
      const vecs = await embedder.embed(items.map((it) => queryText(it.label, it.say)));
      const cands = vecs.map((v, i) => {
        const exact = byLabel.get(norm(items[i].label));
        const ranked = rank(v, K).filter((r) => r.score >= FLOOR);
        if (exact && !ranked.some((r) => r.e === exact)) ranked.unshift({ e: exact, score: 1 });
        return ranked;
      });
      const pick = (i, r, how) => (r ? { id: r.e.id, label: r.e.label, meaning: r.e.meaning, score: r.score, how } : { id: null, label: cands[i][0]?.e.label ?? null, score: cands[i][0]?.score ?? 0, how: 'none' });
      if (judge) {
        try {
          // 속도: 이름이 정확히 같고 뜻이 하나뿐인 그림은 판단 없이 바로 연결
          const sure = items.map((it) => { const e = byLabel.get(norm(it.label)); return e && !POLYSEMOUS.has(norm(it.label)) ? e : null; });
          const need = cands.map((c, i) => (c.length && !sure[i] ? i : -1)).filter((i) => i >= 0);
          const picks = need.length ? await judge.judge(need.map((i) => ({ label: items[i].label, say: items[i].say, candidates: cands[i].map((r) => ({ id: r.e.id, label: r.e.label, meaning: r.e.meaning ?? r.e.text.split(' - ').slice(1).join(' - ') })) }))) : [];
          return items.map((_, i) => {
            if (sure[i]) return pick(i, { e: sure[i], score: 1 }, 'exact');
            const k = need.indexOf(i);
            return pick(i, k >= 0 && picks[k] >= 0 ? cands[i][picks[k]] : null, 'judged');
          });
        } catch (err) {
          // LLM 실패 -> 보수적 규칙으로
          opts.onError?.(err);
        }
      }
      return items.map((it, i) => {
        const exact = byLabel.get(norm(it.label));
        if (exact) return pick(i, { e: exact, score: 1 }, 'exact');
        const top = cands[i][0];
        return pick(i, top && top.score >= t ? top : null, 'semantic');
      });
    },
  };
}

module.exports = { createRetriever, loadIndex, queryText, DEFAULT_THRESHOLD };
