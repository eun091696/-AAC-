/** Web: persisted data URI survives reload; the browser's storage quota still applies. */
export async function storeCardImage(dataUri: string): Promise<string> { return dataUri; }

/** On web, preserve only picker data URLs, never an expiring blob URL or remote URL. */
export async function storeLocalPhoto(uri: string, base64?: string | null): Promise<string> {
 if (base64) {
  if (base64.length > 6_000_000) throw new Error('사진이 너무 커요. 더 작은 사진을 선택해 주세요.');
  const format = base64.startsWith('iVBOR') ? 'png' : base64.startsWith('UklGR') ? 'webp' : 'jpeg';
  return `data:image/${format};base64,${base64}`;
 }
 if (/^data:image\/(jpeg|png|webp);base64,/.test(uri) && uri.length <= 6_000_000) return uri;
 throw new Error('사진 데이터를 저장하지 못했어요. 다른 사진으로 다시 시도해 주세요.');
}
