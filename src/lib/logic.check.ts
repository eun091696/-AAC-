/* 핵심 로직 점검 스크립트: npm run check:logic */
import { compose, iga } from './korean';
import { BUILTIN_PLACES, l1Items, N, nounExample, OPTS, P, suggestL1Sentence } from '../data';
import { applySelection, draftFromText, extractPlaceName, parseBoard } from './aiDraft';
import { mapHeard } from './heard';
import { mergePlace, visibleItems } from './cardEdits';

let fail = 0;
const eq = (name: string, got: unknown, want: unknown) => {
  const ok = JSON.stringify(got) === JSON.stringify(want);
  if (!ok) fail++;
  console.log(`${ok ? 'PASS' : 'FAIL'} ${name}${ok ? '' : ` -> got ${JSON.stringify(got)}, want ${JSON.stringify(want)}`}`);
};

const [hospital, restaurant] = BUILTIN_PLACES;
const find = (p: typeof hospital, w: string) => p.items.find((x) => x.w === w)!;

eq('iga 받침없음', iga('배'), '배가');
eq('iga 받침있음', iga('목'), '목이');
eq('조합 배+아파요', compose([find(hospital, '배'), find(hospital, '아파요')]), '배가 아파요');
eq('조합 명사2+아파요', compose([find(hospital, '배'), find(hospital, '머리'), find(hospital, '아파요')]), '배, 머리가 아파요');
eq('조합 물+주세요', compose([find(restaurant, '물'), find(restaurant, '주세요')]), '물 주세요');
{
  const dental = draftFromText('치과', 't');
  const f = (w: string) => dental.items.find((x) => x.w === w)!;
  eq('조합 치과1', compose([f('이'), f('아파요'), f('소리 무서워요'), f('무서워요')]), '이가 아파요, 소리가 무서워요, 무서워요');
  eq('조합 치과2(표현 뒤 명사)', compose([f('아파요'), f('이'), f('소리 무서워요'), f('물 주세요')]), '이가 아파요, 소리가 무서워요, 물 주세요');
  eq('조합 치과3', compose([f('잇몸'), f('아파요'), f('이'), f('시려요')]), '잇몸이 아파요, 이가 시려요');
}
eq('조합 무서워요+배+아파요', compose([find(hospital, '무서워요'), find(hospital, '배'), find(hospital, '아파요')]), '무서워요, 배가 아파요');
eq('조합 명사만', compose([find(hospital, '배')]), '배');
{
  const store = BUILTIN_PLACES[2];
  const g = (w: string) => store.items.find((x) => x.w === w)!;
  eq('조합 편의점 질문', compose([g('라면'), g('얼마예요?'), g('데워 주세요')]), '라면 얼마예요? 데워 주세요');
}
{
  const foot = { ...N('🦶', '발'), added: true };
  eq('추가 카드 발+아파요', compose([foot, find(hospital, '아파요')]), '발이 아파요');
  const dizzy = P('😵', '어지러워요', '어지러워요', 'iga');
  eq('추가 표현 머리+어지러워요', compose([find(hospital, '머리'), dizzy]), '머리가 어지러워요');
}
eq('신체 옵션 이', OPTS.body.find((o) => o.w === '이')!.s, '이가 아파요');
eq('L1 병원 6개', l1Items(hospital).length, 6);
eq('L1 태블릿 9칸', l1Items(hospital, 9).length, 9);
eq('L1 9칸 앞 6칸 유지', l1Items(hospital, 9).slice(0, 6).map((x) => x.w), l1Items(hospital).map((x) => x.w));
eq('L1 문장 추천 병원 발', suggestL1Sentence(N('🦶', '발'), hospital), '발이 아파요');
eq('L1 문장 추천 식당 물', suggestL1Sentence(N('💧', '물'), restaurant), '물 주세요');
eq('모든 장소 L1 인덱스 유효', BUILTIN_PLACES.every((p) => p.l1.every((i) => i < p.items.length)), true);
eq('장소명 추출', extractPlaceName('내일 치과 가요'), '치과');
eq('장소명 추출2', extractPlaceName('토요일 수영장에 가요'), '수영장');
eq('초안 치과', draftFromText('내일 치과 가요', 't').name, '치과');
eq('초안 소아과', draftFromText('모레 소아과 예약', 't').name, '소아과');
eq('초안 일반', draftFromText('토요일 수영장에 가요', 't').name, '수영장');
const d = draftFromText('카페 가요', 't');
const sel = applySelection(d, d.items.map((_, i) => i % 2 === 0));
eq('선택 적용 개수', sel.items.length, 6);
eq('선택 후 L1 유효', sel.l1.every((i) => i < sel.items.length) && sel.l1.length === 6, true);
eq('들은말 언제', mapHeard('언제부터 아팠어요?'), 'time');
eq('들은말 봉투', mapHeard('봉투 필요하세요?'), 'yesno');
eq('들은말 결제', mapHeard('결제는 어떻게 하세요?'), 'pay');

{
  // 카드 수정·숨김 (원본은 그대로, 덮어쓰기만)
  const h = BUILTIN_PLACES[0];
  const n = h.items.length;
  const foot = { ...N('🦶', '발'), added: true };
  const edited = mergePlace(h, { '1': { ...h.items[1], w: '배꼽', edited: true } }, [foot]);
  eq('수정: 원래 카드 덮어쓰기', edited.items[1].w, '배꼽');
  eq('수정: 원본 데이터 유지', h.items[1].w !== '배꼽', true);
  eq('수정: 추가 카드는 뒤에', edited.items[n].w, '발');
  const hidden = mergePlace(h, { '0': { ...h.items[0], hidden: true } });
  eq('숨김: L2 목록에서 제외', visibleItems(hidden).length, n - 1);
  const before = l1Items(h).map((x) => x.w);
  const firstL1 = h.items.indexOf(l1Items(h)[0]);
  const hid2 = mergePlace(h, { [String(firstL1)]: { ...h.items[firstL1], hidden: true } });
  const after = l1Items(hid2).map((x) => x.w);
  eq('숨김: L1 6칸 유지', after.length, 6);
  eq('숨김: L1 숨긴 카드 없음', after.includes(before[0]), false);
  eq('숨김: L1 나머지 칸 위치 그대로', after.slice(1), before.slice(1));
}

eq('예시: 병원 화장실은 아파요 안 붙임', nounExample('화장실', BUILTIN_PLACES[0]), null);
eq('예시: 병원 손은 아파요', nounExample('손', BUILTIN_PLACES[0]), '손이 아파요');
eq('예시: 식당 수저는 주세요', nounExample('숟가락', BUILTIN_PLACES[1]), '숟가락 주세요');
// AI 판 응답 파싱: 이상한 항목은 버리고, 너무 적으면 null
const it6 = ['물', '아파요', '무서워요', '도와주세요', '화장실', '괜찮아요'].map((w, k) => ({ i: '🙂', w, s: w, t: k ? 'p' : 'n', j: k === 1 ? 'iga' : undefined }));
const pb = parseBoard({ board: { name: '치과', icon: '🦷', items: [...it6, { w: 1 }], l1: [0, 9, 2], l3: ['안녕하세요', 3], asks: [{ q: '언제?', o: 'time' }, { x: 1 }] } }, 'z');
eq('AI 판 파싱: 잘못된 버튼 제거', pb?.items.length, 6);
eq('AI 판 파싱: 범위 밖 L1 제거', JSON.stringify(pb?.l1), '[0,2]');
eq('AI 판 파싱: 문자열 문장만', JSON.stringify(pb?.l3), '["안녕하세요"]');
eq('AI 판 파싱: 질문 형식 확인', pb?.asks.length, 1);
eq('AI 판 파싱: 명사에는 j 없음', pb?.items[0].j, undefined);
const pi = parseBoard({ board: { name: '치과', items: [{ ...it6[0], image: { source: 'bundled', id: 'n_x', visualMeaning: '마시는 물' } }, { ...it6[1], image: { source: 'remote', uri: 'http://x' } }, ...it6.slice(2)] } }, 'z');
eq('AI 판 파싱: 검수 그림 유지', JSON.stringify(pi?.items[0].image), JSON.stringify({ source: 'bundled', id: 'n_x', visualMeaning: '마시는 물' }));
eq('AI 판 파싱: 다른 출처 그림은 버림', pi?.items[1].image, undefined);
eq('AI 판 파싱: 버튼 부족하면 버림', parseBoard({ board: { name: 'x', items: it6.slice(0, 3) } }, 'z'), null);
eq('L1 추천: 병원 화장실 단어는 단어 그대로', suggestL1Sentence(N('🚻', '화장실'), BUILTIN_PLACES[0]), '화장실');

if (fail) {
  console.log(`\n${fail} failed`);
  throw new Error('logic check failed');
}
console.log('\nall passed');
