import { getImageMeaning, imageRequestKey } from './imageMeaning';
import { imagePayload, parseImageResponse } from './imageContract';
let checks = 0;
function check(value: unknown, message: string) { if (!value) throw new Error(message); checks++; }
check(getImageMeaning('바나나', 'n').automatic, 'concrete noun has a defined meaning');
check(getImageMeaning('물', 'n').meaning.includes('물'), 'water is explicitly drinking water');
for (const label of ['배', '눈', '사과', '차']) {
 const value = getImageMeaning(label, 'n');
 check(value.needsClarification && value.choices.length > 1, `must not invent ${label}`);
}
check(getImageMeaning('배', 'n', '사람 몸의 배').meaning === '사람 몸의 배', 'guardian explicit meaning preserved');
check(getImageMeaning('아파요', 'p').needsClarification, 'do not invent a body part for pain');
check(getImageMeaning('싫어요', 'p').needsClarification, 'do not reduce refusal to a smiley');
check(getImageMeaning('모르는 단어', 'n').needsClarification, 'unknown noun is not guessed');
check(!getImageMeaning('물 싫어요', 'p').automatic, 'negation is not discarded');
check(getImageMeaning('싫어요', 'p', '음식이 담긴 접시를 손으로 밀어 거절하는 사람').meaning.includes('거절'), 'explicit refusal retained');
check(imageRequestKey('배', 'n', '먹는 과일 배') !== imageRequestKey('배', 'n', '몸의 배'), 'cache/view identity separates meanings');
const payload = imagePayload(' 물 ', 'n', ' 마시는 물 ');
check(payload.label === '물' && payload.visualMeaning === '마시는 물', 'payload trimmed');
check(Object.keys(payload).join(',') === 'label,kind,visualMeaning', 'only label kind and meaning transmitted');
const parsed = parseImageResponse({ uri: 'data:image/png;base64,aGVsbG8=', visualMeaning: '먹는 과일 바나나' });
check(parsed.visualMeaning === '먹는 과일 바나나', 'response requires explicit meaning');
for (const bad of [{ uri: 'https://example.com/image.png', visualMeaning: '물' }, { uri: 'data:image/png;base64,aGVsbG8=' }, { uri: 'data:image/png;base64,aGVsbG8=', visualMeaning: '' }]) {
 let rejected = false; try { parseImageResponse(bad); } catch { rejected = true; }
 check(rejected, 'malformed/remote/unexplained image rejected');
}
console.log(`image meaning/contract: ${checks} checks passed`);
