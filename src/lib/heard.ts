import type { OptKey } from '../types';

/** 상대방 말(음성인식/입력) -> 사용자에게 보여줄 선택지 종류. 키워드 규칙 기반. */
const RULES: [RegExp, OptKey][] = [
  [/어디/, 'body'],
  [/언제/, 'time'],
  [/얼마나|많이 아/, 'pain'],
  [/결제|계산|카드|현금/, 'pay'],
  [/드시고|포장/, 'eat'],
  [/몇\s?개/, 'count'],
  [/찾으/, 'find'],
  [/뭐|무엇|어떤|주문/, 'order'],
];

export function mapHeard(text: string): OptKey {
  for (const [re, key] of RULES) if (re.test(text)) return key;
  return 'yesno';
}
