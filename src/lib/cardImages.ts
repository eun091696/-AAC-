import type { CardImage } from '../types';
import { BUILTIN_PLACES, CORE, OPTS } from '../data';
import { lookupSymbol } from './symbolCatalog';
import { storeCardImage } from './cardImageStore';
import { imagePayload, parseImageResponse } from './imageContract';
import { SYMBOL_ASSETS } from './symbolAssets';
import { findBundledByLabel } from './libraryImages';
const known = [...BUILTIN_PLACES.flatMap(p=>p.items), ...Object.values(CORE).flat(), ...Object.values(OPTS).flat()];
/** Legacy cards only. New guardian cards must go through AI generation and review. */
export function findCardImage(label: string): CardImage | undefined {
 // 검수된 그림이 앱에 있으면 우선 (다의어는 뜻을 모르면 쓰지 않음)
 const bundled = findBundledByLabel(label);
 if (bundled) return bundled;
 const symbol = lookupSymbol(label, known);
 return symbol && SYMBOL_ASSETS[symbol] ? { source: 'library', symbol } : undefined;
}
export function imageServerConfigured(): boolean { return !!process.env.EXPO_PUBLIC_IMAGE_API_URL?.trim(); }
export async function generateCardImage(label: string, kind: 'n'|'p', visualMeaning: string, signal?: AbortSignal): Promise<CardImage> {
 const base = process.env.EXPO_PUBLIC_IMAGE_API_URL?.trim().replace(/\/$/, '');
 if (!base) throw new Error('AI 이미지 서버가 연결되지 않았어요. 서버 주소와 API 키 설정이 필요합니다.');
 const controller = new AbortController();
 const abort = () => controller.abort();
 if (signal?.aborted) controller.abort();
 signal?.addEventListener('abort', abort, { once: true });
 const timer = setTimeout(abort, 100_000);
 try {
  const body = JSON.stringify(imagePayload(label, kind, visualMeaning));
  // Reviewed library is separate from the ordinary generation cache. No promotion on device review.
  const lookup = await fetch(`${base}/v1/card-images/lookup`, {
   method: 'POST', headers: { 'Content-Type': 'application/json' }, body, signal: controller.signal,
  });
  if (lookup.ok) {
   const match: unknown = await lookup.json();
   if (typeof match === 'object' && match !== null && 'found' in match && match.found === true) {
    const approved = parseImageResponse(match);
    if (visualMeaning.trim() && approved.visualMeaning.trim() !== visualMeaning.trim()) throw new Error('검수 그림의 뜻이 요청한 뜻과 달라요.');
    return { source: 'approved', uri: await storeCardImage(approved.uri), visualMeaning: approved.visualMeaning, reviewed: false };
   }
  } else if (lookup.status !== 404) {
   throw new Error(lookup.status === 422 ? '그림으로 보여줄 뜻이나 구체적인 장면을 입력해 주세요.' : '검수 그림 조회에 실패했어요. 잠시 후 다시 시도해 주세요.');
  }
  const response = await fetch(`${base}/v1/card-images`, {
   method: 'POST', headers: { 'Content-Type': 'application/json' },
   // Never send the speech sentence, name, PIN or place. Only the intended image meaning.
   body, signal: controller.signal,
  });
  if (!response.ok) throw new Error(response.status === 422 ? '그림으로 보여줄 뜻이나 구체적인 장면을 입력해 주세요.' : response.status === 503 ? 'AI 이미지 서버의 API 키 설정을 확인해 주세요.' : response.status === 429 ? '요청이 많아요. 잠시 후 다시 시도해 주세요.' : response.status === 504 ? '그림 생성 시간이 초과됐어요. 다시 시도해 주세요.' : '그림을 만들지 못했어요. 다시 시도해 주세요.');
  const image = parseImageResponse(await response.json());
  if (visualMeaning.trim() && image.visualMeaning.trim() !== visualMeaning.trim()) throw new Error('생성된 그림의 의미 정보가 요청과 달라요.');
  return { source: 'ai', uri: await storeCardImage(image.uri), visualMeaning: image.visualMeaning, reviewed: false };
 } catch (error) {
  if (controller.signal.aborted) throw new Error('그림 생성을 중단했거나 시간이 초과됐어요. 다시 시도해 주세요.');
  throw error instanceof Error ? error : new Error('이미지 서버에 연결하지 못했어요.');
 } finally { clearTimeout(timer); signal?.removeEventListener('abort', abort); }
}
