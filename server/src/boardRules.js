'use strict';

// 판 규칙 채점 (코드, LLM 없음). 서버 정리(sanitizeBoard) 뒤 결과가 지켜야 할 조건
const SHORT_ANSWERS = new Set(['네', '아니요', '응', '좋아요']);
const ENDING = /(요|요\?|니다|니다\.|니까\?|세요|요\.|요!)$/;

function checkBoardRules(board) {
  const fails = [];
  const items = board.items || [];
  const has = (re) => items.some((x) => re.test(x.w) || re.test(x.s));
  if (items.length < 10 || items.length > 12) fails.push(`버튼 수 ${items.length}`);
  if (!has(/도와|도움/)) fails.push('도움 버튼 없음');
  if (!has(/멈춰|그만|잠깐|잠시/)) fails.push('멈춤 버튼 없음');
  if (!has(/화장실/)) fails.push('화장실 버튼 없음');
  if (new Set(items.map((x) => x.w)).size !== items.length) fails.push('중복 버튼');
  for (const x of items) {
    if (x.w.length > 10) fails.push(`긴 글자: ${x.w}`);
    if (x.t === 'p' && !ENDING.test(x.s.trim()) && !SHORT_ANSWERS.has(x.s.trim())) fails.push(`존댓말 아님: ${x.s}`);
    if (x.t === 'n' && x.j) fails.push(`명사에 조사: ${x.w}`);
  }
  const l1 = board.l1 || [];
  if (l1.length !== Math.min(6, items.length) || new Set(l1).size !== l1.length || l1.some((n) => n < 0 || n >= items.length)) fails.push('L1 번호 오류');
  return fails;
}

module.exports = { checkBoardRules };
