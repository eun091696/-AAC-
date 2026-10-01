import type { Ask, Item, Level, Opt, OptKey, Place, Settings } from './types';
import { iga } from './lib/korean';

export const N = (i: string, w: string, s?: string): Item => ({ i, w, s: s || w, t: 'n' });
export const P = (i: string, w: string, s?: string, j?: 'iga' | 'obj'): Item => ({ i, w, s: s || w, t: 'p', j });

export const DEFAULT_SETTINGS: Settings = { level: 'L2', placeId: 'hospital', rate: 1, name: '', pin: '0000' };
export const DEFAULT_SHOW_TEXT = '말하기가 어려워서 화면으로 대화할게요.';

export const LEVELS: { id: Level; name: string; desc: string }[] = [
  { id: 'L1', name: '그림 중심', desc: '큰 그림 버튼, 누르면 바로 말해요' },
  { id: 'L2', name: '그림+단어', desc: '단어를 조합해 문장을 만들어요 (기본)' },
  { id: 'L3', name: '문장·입력', desc: '문장 목록 + 직접 입력 + 단어 예측' },
];

/** 모든 화면 상단 고정 핵심 버튼 (위치 불변) */
export const CORE: Record<Level, Item[]> = {
  L1: [{ ...P('👍', '네'), tone: 'yes' }, { ...P('✋', '아니요'), tone: 'no' }, P('🙋', '도와줘요', '도와주세요')],
  L2: [
    { ...P('👍', '네'), tone: 'yes' },
    { ...P('✋', '아니요'), tone: 'no' },
    P('🙋', '도와줘요', '도와주세요'),
    P('🚻', '화장실', '화장실 가고 싶어요'),
    P('🤕', '아파요', '아파요', 'iga'),
  ],
  L3: [{ ...P('', '네'), tone: 'yes' }, { ...P('', '아니요'), tone: 'no' }, P('', '잠시만요', '잠시만 기다려 주세요'), P('', '도와주세요')],
};

const BODY: Opt[] = (
  [['🤯', '머리'], ['👁', '눈'], ['👂', '귀'], ['👃', '코'], ['🦷', '이'], ['🗣', '목'],
    ['🫁', '가슴'], ['🫃', '배'], ['💪', '팔'], ['🦵', '다리'], ['🦶', '발'], ['🧍', '등']] as const
).map(([i, w]) => ({ i, w, s: iga(w) + ' 아파요' }));

export const OPTS: Record<OptKey, Opt[]> = {
  yesno: [{ i: '👍', w: '네', s: '네', tone: 'yes' }, { i: '✋', w: '아니요', s: '아니요', tone: 'no' }, { i: '🤔', w: '모르겠어요', s: '잘 모르겠어요' }],
  time: [{ i: '☀️', w: '오늘', s: '오늘부터요' }, { i: '🌙', w: '어제', s: '어제부터요' }, { i: '📅', w: '며칠 전', s: '며칠 전부터요' }, { i: '🗓', w: '오래됐어요', s: '오래됐어요' }],
  pain: [{ i: '🙂', w: '조금', s: '조금 아파요' }, { i: '😣', w: '많이', s: '많이 아파요' }, { i: '😭', w: '아주 많이', s: '아주 많이 아파요' }],
  body: BODY,
  pay: [{ i: '💳', w: '카드', s: '카드로 할게요' }, { i: '💵', w: '현금', s: '현금으로 할게요' }, { i: '📱', w: '휴대폰', s: '휴대폰으로 할게요' }],
  eat: [{ i: '🪑', w: '여기서 먹어요', s: '여기서 먹을게요' }, { i: '📦', w: '포장이요', s: '포장해 주세요' }],
  count: [{ i: '1️⃣', w: '1개', s: '한 개요' }, { i: '2️⃣', w: '2개', s: '두 개요' }, { i: '3️⃣', w: '3개', s: '세 개요' }, { i: '➕', w: '더 많이', s: '더 많이요' }],
  order: [{ i: '👉', w: '이거요', s: '이거요' }, { i: '⭐', w: '추천해 주세요', s: '추천해 주세요' }, { i: '⏳', w: '잠깐만요', s: '잠깐만 기다려 주세요' }],
  find: (
    [['✏️', '문구'], ['🧽', '청소용품'], ['🍳', '주방용품'], ['💄', '화장품'], ['🧸', '장난감'], ['🎁', '선물']] as const
  ).map(([i, w]) => ({ i, w, s: `${w} 찾고 있어요` })),
  ok: [{ i: '👍', w: '알겠어요', s: '알겠어요' }],
};

export const resolveOpts = (o: Ask['o']): Opt[] => (Array.isArray(o) ? o : OPTS[o]);
export const GEN_PRED = ['주세요', '있어요', '없어요', '괜찮아요', '아파요', '도와주세요'];

const hurt: Item = { ...P('🤕', '아파요', '아파요', 'iga'), body: true };

export const BUILTIN_PLACES: Place[] = [
  {
    id: 'hospital', name: '병원', icon: '🏥',
    items: [hurt, N('🫃', '배'), N('🤯', '머리'), N('🗣', '목'), P('😨', '무서워요'), P('💉', '주사 싫어요', '주사가 싫어요'),
      P('⏱', '얼마나 걸려요?'), P('🔁', '다시 말해줘요', '다시 말해 주세요'), P('🐢', '천천히요', '천천히 말해 주세요'),
      P('👨‍👩‍👧', '보호자 불러요', '보호자를 불러 주세요'), P('⏸️', '쉬고 싶어요'), P('🏠', '집에 가요', '집에 가고 싶어요'), P('🚻', '화장실', '화장실 가고 싶어요')],
    l1: [0, 4, 5, 12, 10, 11],
    l3: ['말하기가 어려워서 화면으로 대화해도 될까요?', '예약한 {name}입니다.', '어제부터 여기가 아픕니다.', '지난번 처방받은 약을 먹고 있어요.',
      '진료 내용을 글로 적어 주실 수 있나요?', '천천히 말씀해 주세요.', '보호자와 통화해 주실 수 있나요?'],
    pred: ['아픕니다', '부었어요', '열이 나요', '어지러워요', '어제부터', '약'],
    asks: [{ q: '어디가 아파요?', o: 'body' }, { q: '언제부터요?', o: 'time' }, { q: '얼마나 아파요?', o: 'pain' }],
  },
  {
    id: 'restaurant', name: '식당', icon: '🍽',
    items: [P('👉', '이거 주세요'), N('💧', '물', '물 주세요'), N('🥄', '숟가락'), N('🥢', '젓가락'), P('🙏', '주세요', '주세요', 'obj'), P('🌶', '안 매운 거', '안 매운 걸로 주세요'),
      P('❌', '빼 주세요', '이거 빼 주세요'), P('😋', '맛있어요'), P('📦', '포장해요', '포장해 주세요'), P('💳', '계산할게요'), P('🔊', '시끄러워요'), P('🚻', '화장실', '화장실 가고 싶어요')],
    l1: [0, 1, 5, 7, 10, 11],
    l3: ['말하기가 어려워서 화면으로 주문해도 될까요?', '이 메뉴로 하나 주세요.', '맵지 않게 해 주실 수 있나요?', '알레르기가 있어서 이 재료는 빼 주세요.',
      '남은 음식 포장해 주세요.', '계산은 카드로 할게요.'],
    pred: ['주세요', '빼 주세요', '하나', '두 개', '맵지 않게', '포장'],
    asks: [{ q: '뭐 드릴까요?', o: 'order' }, { q: '드시고 가세요?', o: 'eat' }, { q: '매운 거 괜찮아요?', o: 'yesno' }, { q: '결제는요?', o: 'pay' }],
  },
  {
    id: 'store', name: '편의점', icon: '🏪',
    items: [N('🥤', '음료수'), N('🍙', '삼각김밥'), N('🍜', '라면'), P('🙏', '주세요', '주세요', 'obj'), P('🔎', '찾고 있어요', '찾고 있어요', 'obj'), P('💰', '얼마예요?', '얼마예요?', 'obj'),
      P('🔥', '데워 주세요', '데워 주세요', 'obj'), P('🛍', '봉투 주세요'), P('💳', '카드로 할게요'), P('🧾', '영수증 주세요'), P('👉', '이거요'), P('🙋', '도와주세요')],
    l1: [10, 5, 6, 7, 8, 11],
    l3: ['말하기가 어려워서 화면으로 말씀드릴게요.', '이 상품 어디 있나요?', '이거 데워 주세요.', '봉투 하나 주세요.', '카드로 계산할게요.', '영수증은 괜찮아요.'],
    pred: ['주세요', '어디 있나요', '데워', '봉투', '카드로', '괜찮아요'],
    asks: [{ q: '봉투 필요하세요?', o: 'yesno' }, { q: '데워 드릴까요?', o: 'yesno' }, { q: '결제는요?', o: 'pay' }, { q: '영수증 드릴까요?', o: 'yesno' }],
  },
  {
    id: 'daiso', name: '다이소', icon: '🛍',
    items: [N('✏️', '문구'), N('🧽', '청소용품'), N('🍳', '주방용품'), N('🎁', '선물'), P('🔎', '찾고 있어요', '찾고 있어요', 'obj'), P('📍', '어디 있어요?', '어디 있어요?', 'iga'),
      P('💰', '얼마예요?', '얼마예요?', 'obj'), P('🎨', '다른 색 있어요?'), P('🛒', '이거 살래요'), P('🛍', '봉투 주세요'), P('💳', '계산할게요'), P('🙋', '도와주세요')],
    l1: [4, 5, 6, 8, 10, 11],
    l3: ['말하기가 어려워서 화면으로 말씀드릴게요.', '이 물건이 어디 있는지 알려 주세요.', '다른 색상도 있나요?', '이거 두 개 살게요.', '봉투 하나 주세요.'],
    pred: ['어디 있나요', '찾고 있어요', '있나요', '주세요', '살게요'],
    asks: [{ q: '어떤 거 찾으세요?', o: 'find' }, { q: '몇 개요?', o: 'count' }, { q: '봉투 필요하세요?', o: 'yesno' }],
  },
];

/** L1 칸에 들어갈 items 인덱스. 판의 l1 순서를 먼저 쓰고, 칸이 남으면(태블릿 9칸) 나머지 카드로 채움 */
export function l1Indices(place: Place, count = 6): number[] {
  const len = place.items.length;
  const ok = (i: number) => i >= 0 && i < len && !place.items[i].hidden;
  const base = place.l1.filter((i) => i >= 0 && i < len).slice(0, count);
  const used = new Set(base.filter(ok));
  const next = () => {
    for (let i = 0; i < len; i++) if (ok(i) && !used.has(i)) { used.add(i); return i; }
    return -1;
  };
  // 숨긴 카드 자리는 같은 칸에서 다른 카드로 채움 (나머지 칸 위치는 그대로)
  const idx = base.map((i) => (ok(i) ? i : next())).filter((i) => i >= 0);
  while (idx.length < count) {
    const n = next();
    if (n < 0) break;
    idx.push(n);
  }
  return idx;
}

export function l1Items(place: Place, count = 6): Item[] {
  return l1Indices(place, count).map((i) => place.items[i]);
}

/** L1 칸에 넣을 때 말할 완성 문장 추천 (단어 카드는 문장으로 만들어 줌) */
// 신체 부위 (예시 문장에서 "~이/가 아파요"를 붙여도 되는 단어)
const BODY_WORDS = new Set([...BODY.map((b) => b.w), '손', '손가락', '발가락', '입', '혀', '잇몸', '어깨', '허리', '무릎', '엉덩이', '얼굴', '피부', '목구멍']);
export const isBodyWord = (w: string) => BODY_WORDS.has(w.trim());

/**
 * 단어 카드를 이 판에서 자연스럽게 쓰는 예시 문장. 말이 안 되는 조합은 만들지 않음.
 * - 신체 부위 + 판에 "아파요"가 있음 → "발이 아파요"
 * - 판에 "주세요"가 있음 → "물 주세요"
 * - 그 외 → null (단어만 말함)
 */
export function nounExample(w: string, place?: Place): string | null {
  const word = w.trim();
  if (!word || !place) return null;
  const preds = place.items.filter((x) => x.t === 'p' && !x.hidden);
  if (isBodyWord(word) && (preds.some((x) => x.body) || place.asks.some((a) => a.o === 'body'))) return `${iga(word)} 아파요`;
  if (preds.some((x) => x.w === '주세요' && x.j === 'obj')) return `${word} 주세요`;
  return null;
}

/** L1 칸에 넣을 때 말할 완성 문장 추천 (단어 카드는 자연스러운 문장이 있을 때만 문장으로) */
export function suggestL1Sentence(item: Item, place: Place): string {
  if (item.t === 'p') return item.s;
  return nounExample(item.w, place) ?? item.s;
}

export function asksWithDefaults(place: Place): Ask[] {
  const asks = [...place.asks];
  if (!asks.some((a) => a.o === 'yesno')) asks.push({ q: '네/아니요로 물어볼게요', o: 'yesno' });
  return asks;
}
