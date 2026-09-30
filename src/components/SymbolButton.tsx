import React from 'react';
import { Pressable, StyleSheet, Text, ViewStyle, StyleProp } from 'react-native';
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
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      onPress={onPress}
      style={({ pressed }) => [s.b, variant ? s[variant] : null, pressed && s.pressed, style]}
    >
      {(icon || image) && variant !== 'add' ? <CardSymbol icon={icon} label={label} image={image} size={iconSize * 1.45} /> : icon ? <Text style={{ fontSize: iconSize }}>{icon}</Text> : null}
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
  w: { fontWeight: '700', color: C.text, textAlign: 'center' },
  pressed: { transform: [{ scale: 0.96 }], backgroundColor: '#e8eefc' },
  yes: { backgroundColor: C.yes, borderColor: C.yesLine },
  no: { backgroundColor: C.no, borderColor: C.noLine },
  core: { backgroundColor: '#fff', borderColor: C.coreLine },
  wait: { backgroundColor: C.core, borderColor: C.coreLine },
  add: { backgroundColor: '#fff', borderColor: '#9bb3e8', borderStyle: 'dashed' },
});
