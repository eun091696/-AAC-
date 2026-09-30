import React, { useState } from 'react';
import { Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import type { Opt } from '../types';
import { asksWithDefaults, OPTS, resolveOpts } from '../data';
import { mapHeard } from '../lib/heard';
import { useApp } from '../state/AppState';
import { C } from '../theme';

type Props = {
  text: string;
  onAsk: (q: string, opts: Opt[], fromShow: boolean) => void;
  onClose: () => void;
};

/** 상대방에게 보여주는 화면 + 상대방이 누르는 질문 버튼 */
export function ShowScreen({ text, onAsk, onClose }: Props) {
  const { place } = useApp();
  const [rotated, setRotated] = useState(false);
  const [typing, setTyping] = useState(false);
  const [heard, setHeard] = useState('');
  const asks = asksWithDefaults(place);

  const submitHeard = () => {
    const t = heard.trim();
    if (!t) return;
    onAsk(`“${t}”`, OPTS[mapHeard(t)], true);
    setHeard('');
    setTyping(false);
  };

  return (
    <View style={s.wrap}>
      <View style={[s.top, rotated && { transform: [{ rotate: '180deg' }] }]}>
        <Text style={s.text} adjustsFontSizeToFit numberOfLines={4}>
          {text}
        </Text>
        <Text style={s.sub}>{'저는 말로 대답하기 어려워요.\n아래 버튼으로 물어봐 주세요.'}</Text>
      </View>

      <View style={s.bottom}>
        <Text style={s.sec}>👇 상대방이 눌러 주세요</Text>
        <View style={s.resp}>
          {asks.map((a) => (
            <Pressable key={a.q} style={({ pressed }) => [s.rb, pressed && s.pressed]} onPress={() => onAsk(a.q, resolveOpts(a.o), true)}>
              <Text style={s.rbT}>{a.q}</Text>
            </Pressable>
          ))}
          <Pressable style={({ pressed }) => [s.rb, s.wait, pressed && s.pressed]} onPress={() => onAsk('잠시 기다려 주세요', OPTS.ok, true)}>
            <Text style={s.rbT}>⏳ 잠시 기다려 주세요</Text>
          </Pressable>
        </View>

        {typing && (
          <View style={s.heardRow}>
            <TextInput
              value={heard}
              onChangeText={setHeard}
              onSubmitEditing={submitHeard}
              placeholder="상대방이 한 말 (예: 언제부터 아팠어요?)"
              autoFocus
              style={s.heardIn}
            />
            <Pressable style={s.heardBtn} onPress={submitHeard}>
              <Text style={{ color: '#fff', fontWeight: '700' }}>변환</Text>
            </Pressable>
          </View>
        )}

        <View style={s.actions}>
          <Pressable style={s.act} onPress={() => setTyping((v) => !v)}>
            <Text style={s.actT}>✍️ 상대 말 입력</Text>
          </Pressable>
          <Pressable style={s.act} onPress={() => setRotated((v) => !v)}>
            <Text style={s.actT}>🔄 화면 돌리기</Text>
          </Pressable>
          <Pressable style={s.act} onPress={onClose}>
            <Text style={s.actT}>✕ 닫기</Text>
          </Pressable>
        </View>
      </View>
    </View>
  );
}

const s = StyleSheet.create({
  wrap: { flex: 1, backgroundColor: '#fff' },
  top: { flex: 1, backgroundColor: C.dark, alignItems: 'center', justifyContent: 'center', padding: 24 },
  text: { color: '#fff', fontSize: 40, fontWeight: '800', textAlign: 'center', lineHeight: 52 },
  sub: { color: '#aaa', fontSize: 14, marginTop: 14, textAlign: 'center' },
  bottom: { padding: 10 },
  sec: { fontSize: 12, color: C.sub, paddingHorizontal: 2 },
  resp: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginVertical: 8 },
  rb: { width: '48.5%', paddingVertical: 14, paddingHorizontal: 6, borderRadius: 14, borderWidth: 2, borderColor: C.btnLine, backgroundColor: C.btn, alignItems: 'center' },
  wait: { backgroundColor: C.core, borderColor: C.coreLine },
  pressed: { backgroundColor: '#e8eefc' },
  rbT: { fontSize: 15, fontWeight: '700', textAlign: 'center', color: C.text },
  heardRow: { flexDirection: 'row', gap: 6, marginBottom: 8 },
  heardIn: { flex: 1, borderWidth: 1.5, borderColor: '#bbb', borderRadius: 10, paddingHorizontal: 10, paddingVertical: 10, fontSize: 15 },
  heardBtn: { backgroundColor: C.primary, borderRadius: 10, paddingHorizontal: 14, justifyContent: 'center' },
  actions: { flexDirection: 'row', gap: 6 },
  act: { flex: 1, paddingVertical: 12, borderRadius: 12, backgroundColor: C.gray, alignItems: 'center' },
  actT: { fontSize: 13, fontWeight: '700', color: C.text },
});
