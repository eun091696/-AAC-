import type { Item, Place } from '../types';

/** 장소 id → 원래 카드 순번 → 고친 카드(숨김이면 hidden: true). 원본 데이터는 그대로 둠 */
export type CardEdits = Record<string, Record<string, Item>>;

/** 원래 카드에 수정/숨김을 덮고, 보호자가 추가한 카드를 뒤에 붙임 */
export function mergePlace(p: Place, edits?: Record<string, Item>, extras?: Item[]): Place {
  if (!edits && !extras?.length) return p;
  const base = edits ? p.items.map((it, i) => edits[String(i)] ?? it) : p.items;
  return { ...p, items: extras?.length ? [...base, ...extras] : base };
}

/** L2에 보일 카드 (숨긴 카드 제외) */
export const visibleItems = (p: Place) => p.items.filter((it) => !it.hidden);
