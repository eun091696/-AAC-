import React, { useState } from 'react';
import { Modal, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { useApp } from '../state/AppState';
import { C } from '../theme';

type Props = { visible: boolean; onCancel: () => void; onSuccess: () => void };

export function PinModal({ visible, onCancel, onSuccess }: Props) {
  const { settings } = useApp();
  const [pin, setPin] = useState('');
  const [error, setError] = useState(false);

  const close = () => {
    setPin('');
    setError(false);
    onCancel();
  };
  const submit = () => {
    if (pin === settings.pin) {
      setPin('');
      setError(false);
      onSuccess();
    } else {
      setPin('');
      setError(true);
    }
  };

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={close}>
      <View style={s.dim}>
        <View style={s.box}>
          <Text style={s.t}>보호자 모드</Text>
          <Text style={[s.sub, error && { color: C.danger }]}>
            {error ? 'PIN이 맞지 않아요' : `PIN 4자리${settings.pin === '0000' ? ' (초기값 0000)' : ''}`}
          </Text>
          <TextInput
            value={pin}
            onChangeText={(v) => setPin(v.replace(/\D/g, '').slice(0, 4))}
            onSubmitEditing={submit}
            keyboardType="number-pad"
            secureTextEntry
            maxLength={4}
            autoFocus
            style={s.input}
            placeholder="••••"
          />
          <View style={s.row}>
            <Pressable style={[s.btn, s.ghost]} onPress={close}>
              <Text style={s.btnT}>취소</Text>
            </Pressable>
            <Pressable style={[s.btn, s.pri]} onPress={submit}>
              <Text style={[s.btnT, { color: '#fff' }]}>확인</Text>
            </Pressable>
          </View>
        </View>
      </View>
    </Modal>
  );
}

const s = StyleSheet.create({
  dim: { flex: 1, backgroundColor: 'rgba(0,0,0,0.45)', alignItems: 'center', justifyContent: 'center' },
  box: { width: '82%', backgroundColor: '#fff', borderRadius: 18, padding: 22, alignItems: 'center' },
  t: { fontSize: 18, fontWeight: '800' },
  sub: { fontSize: 12, color: C.sub, marginTop: 4, marginBottom: 12 },
  input: { width: '100%', fontSize: 26, letterSpacing: 10, textAlign: 'center', padding: 10, borderWidth: 1.5, borderColor: '#ccc', borderRadius: 12, marginBottom: 12 },
  row: { flexDirection: 'row', gap: 8, width: '100%' },
  btn: { flex: 1, padding: 12, borderRadius: 10, alignItems: 'center' },
  ghost: { backgroundColor: '#eceef1' },
  pri: { backgroundColor: C.primary },
  btnT: { fontWeight: '700', fontSize: 15 },
});
