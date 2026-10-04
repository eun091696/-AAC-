export function imagePayload(label: string, kind: 'n'|'p', visualMeaning: string) {
 return { label: label.trim(), kind, visualMeaning: visualMeaning.trim() || undefined };
}
export function parseImageResponse(data: unknown): { uri: string; visualMeaning: string } {
 if (typeof data !== 'object' || data === null || !('uri' in data) || !('visualMeaning' in data)) throw new Error('올바른 그림 응답을 받지 못했어요.');
 const { uri, visualMeaning } = data;
 if (typeof uri !== 'string' || !/^data:image\/png;base64,[A-Za-z0-9+/=]+$/.test(uri) || uri.length > 6_000_000 || typeof visualMeaning !== 'string' || !visualMeaning.trim() || visualMeaning.length > 240) throw new Error('올바른 그림과 의미 응답을 받지 못했어요.');
 return { uri, visualMeaning };
}
