import React, { useState } from 'react';
import { Image, Text, View } from 'react-native';
import type { CardImage } from '../types';
import { SYMBOL_ASSETS } from '../lib/symbolAssets';
import { findCardImage } from '../lib/cardImages';
import { bundledAsset, findBundledByLabel } from '../lib/libraryImages';
/** Pending cards never masquerade as an accurate picture or an arbitrary emoji. */
export function CardSymbol({ icon, label, image, size = 48 }: { icon?: string; label: string; image?: CardImage; size?: number }) {
 const [failed, setFailed] = useState<string | null>(null);
 const resolved = image ?? findBundledByLabel(label) ?? (icon && SYMBOL_ASSETS[icon] ? { source: 'library' as const, symbol: icon } : findCardImage(label));
 if (resolved?.source === 'pending') return <View style={{ width: size, height: size, borderWidth: 1, borderStyle: 'dashed', borderColor: '#a0a0a0', borderRadius: 6, backgroundColor: '#f4f4f4', alignItems: 'center', justifyContent: 'center' }} accessible={false}><Text style={{ fontSize: Math.min(13, size / 4), color: '#555', textAlign: 'center' }}>그림{ '\n' }준비 중</Text></View>;
 const key = resolved?.source === 'library' ? resolved.symbol : resolved?.source === 'bundled' ? resolved.id : resolved?.uri;
 const source = resolved?.source === 'library' ? SYMBOL_ASSETS[resolved.symbol] : resolved?.source === 'bundled' ? bundledAsset(resolved.id) : resolved?.uri ? { uri: resolved.uri } : undefined;
 if (source && failed !== key) return <Image source={source} style={{ width: size, height: size }} resizeMode="contain" accessible={false} onError={() => setFailed(key ?? null)} />;
 // A lost generated image is not silently replaced by an unrelated icon.
 if (resolved && resolved.source !== 'library') return <Text style={{ fontSize: Math.min(13, size / 4), width: size, color: '#555', textAlign: 'center' }}>그림을{ '\n' }불러올 수 없어요</Text>;
 return <Text style={{ fontSize: size * .7, lineHeight: size }} accessible={false}>{icon || '▧'}</Text>;
}
