import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

export type ToastAction = { label: string; onPress: () => void };
export type ToastState = { text: string; action?: ToastAction } | null;

export function Toast({ toast, onAction }: { toast: ToastState; onAction: () => void }) {
  if (!toast) return null;
  return (
    <View pointerEvents="box-none" style={s.wrap} accessibilityLiveRegion="polite">
      <View style={s.box}>
        <Text style={[s.t, toast.action && s.tSmall]}>{toast.text}</Text>
        {toast.action && (
          <Pressable onPress={onAction} style={s.btn} accessibilityRole="button" hitSlop={8}>
            <Text style={s.btnT}>{toast.action.label}</Text>
          </Pressable>
        )}
      </View>
    </View>
  );
}

const s = StyleSheet.create({
  wrap: { position: 'absolute', top: 70, left: 12, right: 12, zIndex: 100, elevation: 10 },
  box: {
    backgroundColor: 'rgba(36,88,198,0.95)',
    borderRadius: 14,
    padding: 14,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 12,
  },
  t: { color: '#fff', fontSize: 20, fontWeight: '800', textAlign: 'center', flexShrink: 1 },
  tSmall: { fontSize: 16 },
  btn: { backgroundColor: '#fff', borderRadius: 10, paddingHorizontal: 12, paddingVertical: 8 },
  btnT: { color: '#2458c6', fontSize: 15, fontWeight: '800' },
});
