/**
 * 판(보드) 초안 생성.
 * 현재: 키워드 템플릿 목업 (실제 AI 미연동).
 * 교체 지점: generateBoardDraft() 내부를 서버 API 호출로 바꾸고, 반환 타입(Place)과
 * "보호자 승인 후 반영" 흐름은 그대로 유지할 것. 의료 문장은 검수 세트 우선.
 */
import type { Item, Place } from '../types';
import { BUILTIN_PLACES, N, P } from '../data';

type Template = Omit<Place, 'id'> & { k: RegExp };

const TEMPLATES: Template[] = [
  {
    k: /치과/, name: '치과', icon: '🦷',
    items: [N('🦷', '이'), N('👄', '잇몸'), { ...P('🤕', '아파요', '아파요', 'iga'), body: true }, P('🥶', '시려요', '시려요', 'iga'), P('😨', '무서워요'),
      P('✋', '잠깐 멈춰요', '잠깐 멈춰 주세요'), P('😮', '입 벌리기 힘들어요', '입 벌리기가 힘들어요'), P('🔊', '소리 무서워요', '소리가 무서워요'),
      P('💧', '물 주세요'), P('🚻', '화장실', '화장실 가고 싶어요'), P('👨‍👩‍👧', '보호자 불러요', '보호자를 불러 주세요'), P('👍', '괜찮아요')],
    l1: [2, 4, 5, 7, 9, 11],
    l3: ['말하기가 어려워서 화면으로 대화해도 될까요?', '아래쪽 이가 아픕니다.', '찬 것을 먹으면 시립니다.', '치료 중에 아프면 손을 들겠습니다.',
      '잠시 쉬었다가 해 주세요.', '치료 비용을 미리 알려 주세요.'],
    pred: ['아픕니다', '시려요', '왼쪽', '오른쪽', '위', '아래'],
    asks: [{ q: '어디가 아파요?', o: 'body' }, { q: '언제부터요?', o: 'time' }, { q: '많이 아파요?', o: 'pain' }],
  },
  {
    k: /미용실|헤어|머리\s?자르/, name: '미용실', icon: '✂️',
    items: [N('💇', '앞머리'), N('💇‍♂️', '옆머리'), N('🧑', '뒷머리'), P('✂️', '조금만 잘라요', '조금만 잘라 주세요'), P('📏', '짧게 잘라요', '짧게 잘라 주세요'),
      P('🔥', '물 뜨거워요', '물이 뜨거워요'), P('😣', '따가워요'), P('⏸️', '쉬고 싶어요', '잠깐 쉬고 싶어요'), P('🪞', '거울 보여줘요', '거울 보여 주세요'),
      P('😨', '무서워요'), P('❓', '끝났어요?'), P('👍', '좋아요')],
    l1: [3, 5, 7, 8, 9, 11],
    l3: ['말하기가 어려워서 화면으로 설명드릴게요.', '이 사진처럼 잘라 주세요.', '길이는 조금만 다듬어 주세요.', '물이 조금 뜨거워요.', '중간에 잠깐 쉬고 싶어요.'],
    pred: ['잘라 주세요', '조금만', '짧게', '뜨거워요', '괜찮아요'],
    asks: [
      { q: '어떻게 잘라 드릴까요?', o: [{ i: '✂️', w: '조금만', s: '조금만 잘라 주세요' }, { i: '📏', w: '짧게', s: '짧게 잘라 주세요' }, { i: '📷', w: '사진처럼', s: '사진처럼 해 주세요' }] },
      { q: '물 온도 괜찮아요?', o: 'yesno' },
    ],
  },
  {
    k: /카페|커피/, name: '카페', icon: '☕',
    items: [N('☕', '커피'), N('🥛', '우유'), N('🧃', '주스'), P('🙏', '주세요', '주세요', 'obj'), P('🔥', '따뜻한 거', '따뜻한 걸로 주세요'), P('🧊', '차가운 거', '차가운 걸로 주세요'),
      P('🥤', '빨대 주세요'), P('🪑', '여기서 먹어요'), P('📦', '포장이요', '포장해 주세요'), P('💰', '얼마예요?', '얼마예요?', 'obj'), P('💳', '카드로 할게요'), P('🚻', '화장실', '화장실이 어디예요?')],
    l1: [4, 5, 7, 8, 10, 11],
    l3: ['말하기가 어려워서 화면으로 주문할게요.', '아이스 아메리카노 한 잔 주세요.', '시럽은 빼 주세요.', '여기서 마시고 갈게요.', '카드로 계산할게요.'],
    pred: ['주세요', '한 잔', '아이스', '따뜻한', '빼 주세요'],
    asks: [
      { q: '따뜻한 거요, 차가운 거요?', o: [{ i: '🔥', w: '따뜻한 거', s: '따뜻한 걸로 주세요' }, { i: '🧊', w: '차가운 거', s: '차가운 걸로 주세요' }] },
      { q: '드시고 가세요?', o: 'eat' },
      { q: '결제는요?', o: 'pay' },
    ],
  },
];

const HOSPITAL_RE = /병원|소아과|내과|이비인후과|정형외과|피부과|안과|한의원/;

export function extractPlaceName(text: string): string {
  const s = text.replace(/(내일|오늘|모레|이번\s?주|다음\s?주|주말|[월화수목금토일]요일|오전|오후|\d+시)/g, ' ').trim();
  const m = s.match(/([가-힣A-Za-z0-9]+?)(에서|에|으로|로)?\s*(가요|가|갈|간다|가기|방문|예약)/);
  return (m ? m[1] : s.split(/\s+/)[0]) || '새 장소';
}

const clone = <T,>(v: T): T => JSON.parse(JSON.stringify(v));

/** 동기 버전 (테스트용) */
export function draftFromText(text: string, id = 'c' + Date.now()): Place {
  const tpl = TEMPLATES.find((t) => t.k.test(text));
  if (tpl) {
    const { k: _k, ...rest } = tpl;
    return { ...clone(rest), id, custom: true };
  }
  if (HOSPITAL_RE.test(text)) {
    const name = (text.match(/[가-힣]*(소아과|내과|이비인후과|정형외과|피부과|안과|한의원|병원)/) || [])[0] || '병원';
    const base = clone(BUILTIN_PLACES[0]);
    return { ...base, id, name, custom: true };
  }
  const name = extractPlaceName(text);
  const items: Item[] = [P('🙋', '도와주세요'), P('👉', '이거 주세요'), P('💰', '얼마예요?'), P('⏳', '기다릴게요'), P('🚻', '화장실', '화장실 가고 싶어요'),
    P('🔊', '시끄러워요'), P('😨', '무서워요'), P('⏸️', '쉬고 싶어요'), P('🏠', '집에 가요', '집에 가고 싶어요'),
    P('🔁', '다시 말해줘요', '다시 말해 주세요'), P('🐢', '천천히요', '천천히 말해 주세요'), P('👍', '괜찮아요')];
  return {
    id, name, icon: '📍', custom: true, items,
    l1: [0, 4, 5, 6, 7, 8],
    l3: ['말하기가 어려워서 화면으로 대화해도 될까요?', `${name}에 처음 왔어요. 도와주실 수 있나요?`, '이것이 얼마인지 알려 주세요.', '천천히 말씀해 주세요.', '글로 적어 주실 수 있나요?'],
    asks: [],
  };
}

export async function generateBoardDraft(text: string): Promise<Place> {
  await new Promise((r) => setTimeout(r, 600));
  return draftFromText(text);
}

/** 보호자가 체크한 버튼만 남기고 L1 인덱스 재계산 */
export function applySelection(draft: Place, keep: boolean[]): Place {
  const items = draft.items.filter((_, i) => keep[i]);
  const l1 = draft.l1.map((i) => items.indexOf(draft.items[i])).filter((i) => i >= 0);
  for (let i = 0; l1.length < Math.min(6, items.length); i++) if (!l1.includes(i)) l1.push(i);
  return { ...draft, items, l1 };
}
