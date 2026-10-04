import type { ImageSourcePropType } from 'react-native';
import type { CardImage } from '../types';
import concepts from '../../shared/visualConcepts.json';
import { BUNDLED_IMAGES } from './libraryImages.generated';

const ambiguous = concepts.ambiguous as Record<string, string[]>;
const norm = (s: string) => s.trim().replace(/\s+/g, ' ');
const byId = new Map(BUNDLED_IMAGES.map((b) => [b.id, b]));

/** 앱에 포함된 검수 그림 찾기. 단어·종류·뜻이 모두 같아야 함 (뜻이 다르면 다른 그림) */
export function findBundledImage(label: string, kind: 'n' | 'p', meaning: string): CardImage | undefined {
  const m = norm(meaning);
  if (!m) return undefined;
  const hit = BUNDLED_IMAGES.find((b) => b.label === norm(label) && b.kind === kind && b.visualMeaning === m);
  return hit && { source: 'bundled', id: hit.id, visualMeaning: hit.visualMeaning };
}

/**
 * 뜻 정보가 없는 기본 카드 표시용: 라벨로 찾되, 같은 라벨에 그림이 여러 개면 추측하지 않음.
 * 다의어(배·눈 등)는 앱 기본 카드용으로 지정된 뜻(builtin) 하나가 있을 때만 사용.
 */
export function findBundledByLabel(label: string): CardImage | undefined {
  const l = norm(label);
  const all = BUNDLED_IMAGES.filter((b) => b.label === l);
  const hits = ambiguous[l.replace(/\s+/g, '')] ? all.filter((b) => b.builtin) : all;
  return hits.length === 1 ? { source: 'bundled', id: hits[0].id, visualMeaning: hits[0].visualMeaning } : undefined;
}

export const bundledAsset = (id: string): ImageSourcePropType | undefined => byId.get(id)?.asset;
