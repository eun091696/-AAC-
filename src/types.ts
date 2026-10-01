export type Level = 'L1' | 'L2' | 'L3';
export type Tone = 'yes' | 'no';

export type CardImage = { source: 'library'; symbol: string } | { source: 'ai'; uri: string };

/** 버튼 1개. t: 'n' = 명사(조합용), 'p' = 서술/문장 */
export type Item = {
  i: string; // 호환용 상징, 로컬 그림으로 자동 표시
  image?: CardImage;
  w: string; // 버튼 라벨
  s: string; // 말할 문장
  t: 'n' | 'p';
  j?: 'iga' | 'obj'; // 명사를 받는 표현. iga: 이/가 붙임(배가 아파요), obj: 그대로 붙임(물 주세요)
  body?: boolean; // L1에서 누르면 신체 부위 선택
  tone?: Tone;
  added?: boolean; // 보호자가 직접 추가한 카드
  hidden?: boolean; // 보호자가 숨긴 기본 카드 (L1/L2에 안 보임)
  edited?: boolean; // 보호자가 고친 기본 카드
  l1s?: string; // L1 칸에서 보여주고 말할 완성 문장 (예: 발이 아파요)
};

export type Opt = { image?: CardImage; i: string; w: string; s: string; tone?: Tone };
export type OptKey = 'yesno' | 'time' | 'pain' | 'body' | 'pay' | 'eat' | 'count' | 'order' | 'find' | 'ok';
export type Ask = { q: string; o: OptKey | Opt[] };

export type Place = {
  id: string;
  name: string;
  icon: string;
  items: Item[]; // L2 전체 버튼
  l1: number[]; // L1에 보여줄 items 인덱스(최대 6)
  l3: string[]; // L3 문장 목록 ({name} 치환)
  pred?: string[]; // L3 단어 예측 칩
  asks: Ask[]; // 보여주기 화면에서 상대방이 누르는 질문
  custom?: boolean;
};

export type Settings = {
  level: Level;
  placeId: string;
  rate: number;
  name: string;
  pin: string;
};
