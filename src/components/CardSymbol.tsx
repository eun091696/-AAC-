import React, { useState } from 'react';
import { Image, Text } from 'react-native';
import type { CardImage } from '../types';
import { SYMBOL_ASSETS } from '../lib/symbolAssets';
import { findCardImage } from '../lib/cardImages';
/** Existing saved cards without image metadata are resolved at render time. No destructive migration. */
export function CardSymbol({ icon, label, image, size = 48 }: { icon?: string; label: string; image?: CardImage; size?: number }) {
 const [failed, setFailed] = useState<string | null>(null);
 const resolved = image ?? (icon && SYMBOL_ASSETS[icon] ? { source: 'library' as const, symbol: icon } : findCardImage(label));
 const key = resolved?.source === 'ai' ? resolved.uri : resolved?.symbol;
 const source = resolved?.source === 'ai' ? { uri: resolved.uri } : resolved?.symbol ? SYMBOL_ASSETS[resolved.symbol] : undefined;
 return source && failed !== key
  ? <Image source={source} style={{ width: size, height: size }} resizeMode="contain" accessible={false} onError={() => setFailed(key ?? null)} />
  : <Text style={{ fontSize: size * .7, lineHeight: size }} accessible={false}>{icon || '▧'}</Text>;
}
