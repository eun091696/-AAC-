import React from 'react';
import { KeyboardAvoidingView, Modal, Platform, ScrollView, StyleSheet, Text } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useApp } from '../state/AppState';
import { CardForm } from './CardForm';
import { useL1Count } from '../lib/useL1Count';

/** 홈 화면에서 지금 장소 판에 카드를 바로 추가 (보호자 PIN 확인 후 열림) */
export function AddCardModal({ visible, onClose }: { visible: boolean; onClose: () => void }) {
  const { place, addCard, setL1Slot, l1For, showToast } = useApp();
  const l1Count = useL1Count();
  return (
    <Modal visible={visible} animationType="slide" onRequestClose={onClose}>
      <SafeAreaView style={{ flex: 1, backgroundColor: '#fff' }}>
        <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
          <ScrollView contentContainerStyle={{ padding: 16, gap: 8 }} keyboardShouldPersistTaps="handled">
            <Text style={s.t}>{`${place.icon} ${place.name} 판에 카드 추가`}</Text>
            <Text style={s.sub}>추가한 카드는 이 장소 판의 맨 뒤에 붙어요. 지우기는 보호자 모드의 카드 관리에서 할 수 있어요.</Text>
            <CardForm
              onCancel={onClose}
              l1={{ slots: l1For(place, l1Count), place }}
              onSubmit={(item, l1) => {
                addCard(place.id, item);
                if (l1) setL1Slot(place.id, l1.slot, l1.item);
                showToast(l1 ? `"${item.w}" 카드를 추가하고 L1 ${l1.slot + 1}번 칸에 넣었어요` : `"${item.w}" 카드를 추가했어요`);
                onClose();
              }}
            />
          </ScrollView>
        </KeyboardAvoidingView>
      </SafeAreaView>
    </Modal>
  );
}

const s = StyleSheet.create({
  t: { fontSize: 20, fontWeight: '800' },
  sub: { fontSize: 13, color: '#777', marginBottom: 6 },
});
