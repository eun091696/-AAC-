/** Exact matching only: do not turn '물 싫어요' into a picture meaning '물'. */
export const normalizeSymbolLabel = (text: string) => text.trim().replace(/\s+/g, '').replace(/[?!.,。？！]/g, '');
const GROUPS: [string, string[]][] = [
 ['🍎',['사과']], ['🍌',['바나나']], ['🍞',['빵','식빵']], ['🍚',['밥','쌀밥']], ['🚌',['버스']], ['🚗',['자동차','차']],
 ['🐶',['강아지','개']], ['🐱',['고양이']], ['⚽',['축구','축구공']], ['📚',['책']], ['💊',['약']], ['🛏️',['침대','잠']],
 ['🚿',['샤워']], ['🧼',['비누']], ['👕',['옷','티셔츠']], ['🥛',['우유']], ['🍪',['과자','쿠키']],
 ['🍓',['딸기']], ['🍊',['귤','오렌지']], ['🍉',['수박']], ['🧃',['주스']],
 ['🦶',['발']], ['👁',['눈']], ['👂',['귀']], ['👃',['코']], ['💪',['팔']], ['🦵',['다리']],
 ['💧',['물']], ['🍜',['라면']], ['🍙',['삼각김밥']], ['☕',['커피']], ['🥄',['숟가락']], ['🥢',['젓가락']],
 ['🤕',['아파요']], ['😵',['어지러워요']], ['😨',['무서워요']], ['👍',['네','좋아요','괜찮아요','알겠어요']],
 ['✋',['아니요']], ['🙋',['도와주세요','도와줘요']], ['🚻',['화장실']], ['🏠',['집','집에 가요']],
];
const aliases = new Map(GROUPS.flatMap(([icon, labels]) => labels.map(label => [normalizeSymbolLabel(label), icon] as const)));
export function lookupSymbol(label: string, builtins: ReadonlyArray<{ w: string; i: string }> = []): string | undefined {
 const key = normalizeSymbolLabel(label);
 return builtins.find(item => normalizeSymbolLabel(item.w) === key && !!item.i)?.i ?? aliases.get(key);
}
