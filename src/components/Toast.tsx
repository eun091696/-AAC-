import React from 'react';
import { StyleSheet, Text, View } from 'react-native';

export function Toast({ text }: { text: string | null }) {
  if (!text) return null;
  return (
    <View pointerEvents="none" style={s.wrap} accessibilityLiveRegion="polite">
      <Text style={s.t}>{text}</Text>
    </View>
  );
}

const s = StyleSheet.create({
  wrap: {
    position: 'absolute',
    top: 70,
    left: 12,
    right: 12,
    backgroundColor: 'rgba(36,88,198,0.95)',
    borderRadius: 14,
    padding: 14,
    zIndex: 100,
    elevation: 10,
  },
  t: { color: '#fff', fontSize: 20, fontWeight: '800', textAlign: 'center' },
});
