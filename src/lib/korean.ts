import type { Item } from '../types';

export function hasBatchim(word: string): boolean {
  const c = word.charCodeAt(word.length - 1);
  if (c < 0xac00 || c > 0xd7a3) return false;
  return (c - 0xac00) % 28 !== 0;
}

export const iga = (w: string) => w + (hasBatchim(w) ? '이' : '가');

/**
 * L2 조합.
 * - 명사는 "명사를 받을 수 있는 표현"(j 있음: 아파요, 주세요 등)에만 붙는다.
 *   "소리 무서워요", "물 주세요"처럼 이미 주어/목적어가 있는 표현에는 붙지 않는다.
 * - 명사 뒤쪽에서 가장 가까운 표현을 먼저 찾고, 없으면 앞쪽에서 찾는다.
 * - 문장은 누른 표현 순서대로 쉼표로 잇는다.
 * 예) [아파요, 이, 소리 무서워요, 물 주세요] -> "이가 아파요, 소리가 무서워요, 물 주세요"
 */
export function compose(chips: Item[]): string {
  if (!chips.length) return '';

  // 연속된 명사는 한 묶음으로 (배, 머리 -> "배, 머리가 아파요")
  type Unit = { kind: 'noun'; words: string[] } | { kind: 'pred'; item: Item; noun?: string[] };
  const units: Unit[] = [];
  for (const c of chips) {
    const prev = units[units.length - 1];
    if (c.t === 'n' && prev?.kind === 'noun') prev.words.push(c.w);
    else if (c.t === 'n') units.push({ kind: 'noun', words: [c.w] });
    else units.push({ kind: 'pred', item: c });
  }

  const accepts = (u: Unit): u is Extract<Unit, { kind: 'pred' }> => u.kind === 'pred' && !!u.item.j && !u.noun;
  const leftover: string[][] = [];
  units.forEach((u, i) => {
    if (u.kind !== 'noun') return;
    const after = units.slice(i + 1).find(accepts);
    const before = [...units.slice(0, i)].reverse().find(accepts);
    const target = after ?? before;
    if (target && target.kind === 'pred') target.noun = u.words;
    else leftover.push(u.words);
  });

  const clauses: string[] = [];
  for (const u of units) {
    if (u.kind === 'pred') {
      if (u.noun) {
        const n = u.noun.join(', ');
        clauses.push(`${u.item.j === 'iga' ? iga(n) : n} ${u.item.s}`);
      } else clauses.push(u.item.s);
    } else if (leftover.includes(u.words)) {
      clauses.push(u.words.join(', '));
    }
  }

  return clauses.reduce((acc, x, i) => (i === 0 ? x : `${acc}${/[.?!]$/.test(acc) ? ' ' : ', '}${x}`), '');
}
