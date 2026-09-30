import type { CardImage } from '../types';
import { BUILTIN_PLACES, CORE, OPTS } from '../data';
import { lookupSymbol } from './symbolCatalog';
import { SYMBOL_ASSETS } from './symbolAssets';
const known = [...BUILTIN_PLACES.flatMap(p=>p.items), ...Object.values(CORE).flat(), ...Object.values(OPTS).flat()];
export function findCardImage(label: string): CardImage | undefined {
 const symbol = lookupSymbol(label, known);
 return symbol && SYMBOL_ASSETS[symbol] ? { source: 'library', symbol } : undefined;
}
export function imageServerConfigured(): boolean { return !!process.env.EXPO_PUBLIC_IMAGE_API_URL?.trim(); }
export async function generateCardImage(label: string, kind: 'n'|'p', sentence: string, signal?: AbortSignal): Promise<CardImage> {
 const base = process.env.EXPO_PUBLIC_IMAGE_API_URL?.trim().replace(/\/$/, '');
 if (!base) throw new Error('이 표현의 그림은 아직 없어요. AI 이미지 서버 연결이 필요합니다.');
 const controller = new AbortController();
 const abort = () => controller.abort();
 if (signal?.aborted) controller.abort();
 signal?.addEventListener('abort', abort, { once: true });
 const timer = setTimeout(abort, 100_000);
 try {
  const response = await fetch(`${base}/v1/card-images`, {
   method: 'POST', headers: { 'Content-Type': 'application/json' },
   body: JSON.stringify({ label: label.trim(), kind, sentence: sentence.trim() || label.trim() }), signal: controller.signal,
  });
  if (!response.ok) throw new Error(response.status === 503 ? 'AI 이미지 서버 설정을 확인해 주세요.' : response.status === 429 ? '요청이 많아요. 잠시 후 다시 시도해 주세요.' : '그림을 만들지 못했어요. 다시 시도해 주세요.');
  const data: unknown = await response.json();
  const uri = typeof data === 'object' && data !== null && 'uri' in data ? data.uri : undefined;
  if (typeof uri !== 'string' || !/^data:image\/png;base64,[A-Za-z0-9+/=]+$/.test(uri) || uri.length > 3_000_000) throw new Error('올바른 그림 응답을 받지 못했어요.');
  return { source: 'ai', uri };
 } catch (error) {
  if (controller.signal.aborted) throw new Error('그림 생성을 중단했거나 시간이 초과됐어요. 다시 시도해 주세요.');
  throw error instanceof Error ? error : new Error('이미지 서버에 연결하지 못했어요.');
 } finally { clearTimeout(timer); signal?.removeEventListener('abort', abort); }
}
