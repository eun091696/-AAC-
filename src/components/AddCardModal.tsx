import React, { useState } from 'react';
import { IconText } from './IconText';
import { KeyboardAvoidingView, Modal, Platform, ScrollView, StyleSheet, Text } from 'react-native';
import { SafeAreaProvider, SafeAreaView } from 'react-native-safe-area-context';
import { useApp } from '../state/AppState';
import { CardForm, UNSAVED_MSG } from './CardForm';
import { confirmAsync } from '../lib/confirm';
import { useL1Count } from '../lib/useL1Count';

/** 홈 화면에서 지금 장소 판에 카드를 바로 추가 (보호자 PIN 확인 후 열림) */
export function AddCardModal({ visible, onClose }: { visible: boolean; onClose: () => void }) {
  const { settings, place, addCard, setL1Slot, l1For, showToast } = useApp();
  const l1Count = useL1Count();
  const [dirty, setDirty] = useState(false);
  // 안드로이드 뒤로가기: 입력 중이면 확인
  const requestClose = async () => {
    if (dirty && !(await confirmAsync('저장하지 않은 내용이 있어요', UNSAVED_MSG, '취소하기', '계속 작성'))) return;
    onClose();
  };
  return (
    <Modal visible={visible} animationType="slide" onRequestClose={() => void requestClose()}>
      {/* Modal은 별도 화면이라 안전 영역 정보를 다시 받아야 상단(상태바)에 안 가려짐 */}
      <SafeAreaProvider>
      <SafeAreaView style={{ flex: 1, backgroundColor: '#fff' }} edges={['top', 'bottom']}>
        <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
          <ScrollView contentContainerStyle={{ padding: 16, gap: 8 }} keyboardShouldPersistTaps="handled">
            <IconText icon={place.icon} text={`${place.name} 판에 카드 추가`} style={s.t} />
            <Text style={s.sub}>추가한 카드는 이 장소 판의 맨 뒤에 붙어요. 수정·삭제는 보호자 모드의 카드 관리에서 할 수 있어요.</Text>
            <CardForm
              onCancel={onClose}
              onDirtyChange={setDirty}
              place={place}
              l1={settings.level === 'L1' ? { slots: l1For(place, l1Count), place } : undefined}
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
      </SafeAreaProvider>
    </Modal>
  );
}

const s = StyleSheet.create({
  t: { fontSize: 20, fontWeight: '800' },
  sub: { fontSize: 13, color: '#777', marginBottom: 6 },
});
