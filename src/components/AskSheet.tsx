import React from 'react';
import { Modal, Pressable, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import type { Opt } from '../types';
import { Grid } from './Grid';
import { SymbolButton } from './SymbolButton';
import { C } from '../theme';

export type AskState = { q: string; opts: Opt[]; fromShow: boolean };

type Props = { state: AskState | null; onPick: (o: Opt) => void; onClose: () => void };

/** 사용자에게 질문 + 큰 선택지를 보여주는 화면 (상대방 질문 응답 / 신체 부위 선택) */
export function AskSheet({ state, onPick, onClose }: Props) {
  const cols = state && state.opts.length > 4 ? 3 : 2;
  return (
    <Modal visible={!!state} animationType="slide" onRequestClose={onClose}>
      <SafeAreaView style={s.wrap}>
        {state ? (
          <>
            <View style={s.q}>
              <Text style={s.label}>{state.fromShow ? '상대방 질문' : '골라 주세요'}</Text>
              <Text style={s.qText}>{state.q}</Text>
            </View>
            <Grid
              data={state.opts}
              cols={cols}
              fill
              renderItem={(o) => (
                <SymbolButton icon={o.i} image={o.image} label={o.w} variant={o.tone} iconSize={40} labelSize={17} onPress={() => onPick(o)} />
              )}
            />
            <Pressable style={s.close} onPress={onClose} accessibilityRole="button">
              <Text style={s.closeT}>✕ 닫기</Text>
            </Pressable>
          </>
        ) : null}
      </SafeAreaView>
    </Modal>
  );
}

const s = StyleSheet.create({
  wrap: { flex: 1, backgroundColor: C.bg, padding: 12 },
  q: { backgroundColor: C.primarySoft, borderRadius: 16, padding: 16, alignItems: 'center' },
  label: { fontSize: 12, color: C.primary, fontWeight: '700' },
  qText: { fontSize: 26, fontWeight: '800', marginTop: 4, textAlign: 'center', color: C.text },
  close: { margin: 10, padding: 14, borderRadius: 12, backgroundColor: C.gray, alignItems: 'center' },
  closeT: { fontWeight: '700', fontSize: 15 },
});
