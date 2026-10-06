// 앱이 소리 내 읽는 고정 문장 목록 (미리 녹음 대상)
import { BUILTIN_PLACES, CORE, GEN_PRED, OPTS } from '../../src/data';
import { compose } from '../../src/lib/korean';
import type { Item } from '../../src/types';

export const voiceKey = (t: string) => t.replace(/\s+/g, ' ').trim();

const out = new Set<string>();
const add = (t?: string) => { if (t && !t.includes('{name}')) out.add(voiceKey(t)); };

add('이 속도로 말할게요');
add('안녕하세요. 이 목소리로 말할게요.');
const cores = Object.values(CORE).flat();
cores.forEach((c) => { add(c.w); add(c.s); });
Object.values(OPTS).flat().forEach((o) => { add(o.w); add(o.s); });
GEN_PRED.forEach(add);
for (const p of BUILTIN_PLACES) {
  const items: Item[] = [...p.items, ...cores];
  items.forEach((it) => { add(it.w); add(it.s); add((it as Item & { l1s?: string }).l1s); });
  p.l3.forEach(add);
  (p.pred ?? []).forEach(add);
  // L2: 명사 1개 + 표현 1개 조합 (예: 물 주세요, 배가 아파요)
  const nouns = items.filter((i) => i.t === 'n');
  const preds = items.filter((i) => i.t === 'p');
  for (const n of nouns) for (const pr of preds) add(compose([n, pr]));
}
console.log(JSON.stringify([...out]));
