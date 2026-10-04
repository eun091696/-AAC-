import React, { useState } from 'react';
import { LayoutChangeEvent, Pressable, StyleSheet, Text, View, ViewStyle, StyleProp } from 'react-native';
import { CardSymbol } from './CardSymbol';
import type { CardImage } from '../types';
import { C } from '../theme';

type Props = {
  icon?: string;
  image?: CardImage;
  label: string;
  onPress: () => void;
  variant?: 'yes' | 'no' | 'core' | 'wait' | 'add';
  iconSize?: number;
  labelSize?: number;
  style?: StyleProp<ViewStyle>;
};

export function SymbolButton({ icon, image, label, onPress, variant, iconSize = 28, labelSize = 13, style }: Props) {
  // 그림이 버튼 크기에 맞춰 커지도록: 버튼에서 글자 줄을 뺀 공간을 최대한 채움
  const [box, setBox] = useState<{ w: number; h: number } | null>(null);
  const onLayout = (e: LayoutChangeEvent) => {
    const { width, height } = e.nativeEvent.layout;
    if (!box || Math.abs(box.w - width) > 1 || Math.abs(box.h - height) > 1) setBox({ w: width, h: height });
  };
  const labelH = labelSize * 1.3 * (label.length > 7 ? 2 : 1) + 6;
  const fit = box ? Math.floor(Math.min(box.w - 12, box.h - labelH - 14)) : 0;
  const imgSize = Math.max(iconSize * 1.45, fit);
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      onPress={onPress}
      style={({ pressed }) => [s.b, variant ? s[variant] : null, pressed && s.pressed, style]}
      onLayout={onLayout}
    >
      {(icon || image) && variant !== 'add' ? <View style={s.pic}><CardSymbol icon={icon} label={label} image={image} size={imgSize} /></View> : icon ? <Text style={{ fontSize: iconSize }}>{icon}</Text> : null}
      <Text style={[s.w, { fontSize: labelSize }]} numberOfLines={2}>
        {label}
      </Text>
    </Pressable>
  );
}

const s = StyleSheet.create({
  b: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: C.btn,
    borderColor: C.btnLine,
    borderWidth: 2,
    borderRadius: 14,
    paddingHorizontal: 4,
    paddingVertical: 6,
  },
  w: { fontWeight: '700', color: C.text, textAlign: 'center', marginTop: 2 },
  pic: { borderRadius: 10, overflow: 'hidden' },
  pressed: { transform: [{ scale: 0.96 }], backgroundColor: '#e8eefc' },
  yes: { backgroundColor: C.yes, borderColor: C.yesLine },
  no: { backgroundColor: C.no, borderColor: C.noLine },
  core: { backgroundColor: '#fff', borderColor: C.coreLine },
  wait: { backgroundColor: C.core, borderColor: C.coreLine },
  add: { backgroundColor: '#fff', borderColor: '#9bb3e8', borderStyle: 'dashed' },
});
