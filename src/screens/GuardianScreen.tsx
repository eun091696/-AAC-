import React, { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, Alert, BackHandler, KeyboardAvoidingView, Platform, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import type { Place } from '../types';
import { l1Indices, l1Items, LEVELS } from '../data';
import { useL1Count } from '../lib/useL1Count';
import { applySelection, generateBoardDraft } from '../lib/aiDraft';
import { useApp } from '../state/AppState';
import { CardSymbol } from '../components/CardSymbol';
import { CardForm, UNSAVED_MSG } from '../components/CardForm';
import { confirmAsync } from '../lib/confirm';
import { C } from '../theme';

export function GuardianScreen({ onClose }: { onClose: () => void }) {
  const { settings, update, places, custom, addPlace, removePlace, addCard, removeCard, updateCard, restoreCard, baseCount, setL1Slot, resetL1, l1Overrides, l1For, resetAll, speakWord, showToast } = useApp();
  const l1Count = useL1Count();
  const [draftAdding, setDraftAdding] = useState(false);
  const [cardPlaceId, setCardPlaceId] = useState(settings.placeId);
  const cardPlace = places.find((p) => p.id === cardPlaceId) ?? places[0];
  const showL1Options = settings.level === 'L1';
  const [editing, setEditing] = useState<number | null>(null);
  const [addDirty, setAddDirty] = useState(false);
  const [editDirty, setEditDirty] = useState(false);
  const [draftDirty, setDraftDirty] = useState(false);
  const [prompt, setPrompt] = useState('');
  const [loading, setLoading] = useState(false);
  const [draft, setDraft] = useState<Place | null>(null);
  const [keep, setKeep] = useState<boolean[]>([]);
  const [name, setName] = useState(settings.name);
  const [newPin, setNewPin] = useState('');

  // 저장하지 않은 입력이 있으면 나가기 전에 확인, 없으면 바로 이전 화면으로
  const dirty = addDirty || editDirty || draftDirty || !!prompt.trim() || !!draft || name.trim() !== settings.name || !!newPin;
  const leave = useCallback(async () => {
    if (dirty && !(await confirmAsync('저장하지 않은 내용이 있어요', UNSAVED_MSG, '나가기', '계속 작성'))) return;
    onClose();
  }, [dirty, onClose]);

  // 안드로이드 뒤로가기 버튼도 같은 확인을 거침
  useEffect(() => {
    const sub = BackHandler.addEventListener('hardwareBackPress', () => {
      void leave();
      return true;
    });
    return () => sub.remove();
  }, [leave]);

  const deleteCard = async (index: number) => {
    const it = cardPlace.items[index];
    const added = index >= baseCount(cardPlace.id);
    const ok = await confirmAsync(
      added ? `"${it.w}" 카드를 삭제할까요?` : `"${it.w}" 카드를 숨길까요?`,
      added ? '삭제하면 되돌릴 수 없어요.' : '기본 카드는 지워지지 않고 숨겨져요. 언제든 다시 보이게 할 수 있어요.',
      added ? '삭제' : '숨기기',
    );
    if (!ok) return;
    if (editing === index) setEditing(null);
    removeCard(cardPlace.id, index);
    showToast(added ? `"${it.w}" 카드를 삭제했어요` : `"${it.w}" 카드를 숨겼어요`);
  };

  const generate = async () => {
    const t = prompt.trim();
    if (!t) return;
    setLoading(true);
    setDraft(null);
    setDraftAdding(false);
    const d = await generateBoardDraft(t);
    setDraft(d);
    setKeep(d.items.map(() => true));
    setLoading(false);
  };

  const approve = () => {
    if (!draft) return;
    if (!keep.some(Boolean)) return showToast('버튼을 1개 이상 선택하세요');
    addPlace(applySelection(draft, keep));
    showToast(`${draft.name} 판을 추가했어요`);
    setDraft(null);
    setPrompt('');
  };

  const setRate = (r: number) => {
    const rate = Math.round(Math.min(1.4, Math.max(0.6, r)) * 10) / 10;
    update({ rate });
    speakWord('이 속도로 말할게요');
  };

  return (
    <KeyboardAvoidingView style={{ flex: 1, backgroundColor: '#f6f7f9' }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <View style={s.hdr}>
        <Pressable style={[s.btn, s.ghost]} onPress={() => void leave()} accessibilityRole="button" accessibilityLabel="뒤로가기" hitSlop={8}>
          <Text style={s.btnT}>‹ 뒤로</Text>
        </Pressable>
        <Text style={[s.hdrT, { flex: 1, textAlign: 'center' }]}>🔒 보호자 모드</Text>
        <Pressable style={[s.btn, s.ghost]} onPress={() => void leave()}>
          <Text style={s.btnT}>완료</Text>
        </Pressable>
      </View>

      <ScrollView contentContainerStyle={{ padding: 14, paddingTop: 0, gap: 10 }} keyboardShouldPersistTaps="handled">
        <Section title="소통 레벨">
          {LEVELS.map((l) => (
            <Pressable key={l.id} style={[s.lv, settings.level === l.id && s.lvOn]} onPress={() => update({ level: l.id })}>
              <Text style={s.lvT}>{`${l.id} · ${l.name}`}</Text>
              <Text style={s.lvD}>{l.desc}</Text>
            </Pressable>
          ))}
        </Section>

        <Section title="AI로 판 만들기">
          <TextInput value={prompt} onChangeText={setPrompt} placeholder="예: 내일 치과 가요 / 토요일 미용실 / 카페 가요" style={s.txt} multiline />
          <Text style={s.hint}>현재 데모: 실제 AI 대신 키워드 템플릿으로 초안을 만들어요. 승인해야 사용자 화면에 반영돼요.</Text>
          <Pressable style={[s.btn, s.pri]} onPress={generate} disabled={loading}>
            <Text style={[s.btnT, { color: '#fff' }]}>✨ 초안 만들기</Text>
          </Pressable>
          {loading && <ActivityIndicator style={{ marginTop: 10 }} />}
          {draft && (
            <View style={{ marginTop: 10 }}>
              <Text style={s.dHead}>{`${draft.icon} ${draft.name} 판 초안`}</Text>
              <Text style={s.dSub}>{`버튼 ${draft.items.length}개 · L3 문장 ${draft.l3.length}개 · 상대 질문 ${draft.asks.length}개`}</Text>
              <View style={s.dItems}>
                {draft.items.map((it, i) => (
                  <Pressable
                    key={i}
                    style={[s.dItem, !keep[i] && { opacity: 0.4 }]}
                    onPress={() => setKeep(keep.map((v, k) => (k === i ? !v : v)))}
                  >
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}><CardSymbol icon={it.i} label={it.w} image={it.image} size={36} /><Text style={{ fontSize: 13, flex: 1 }}>{`${keep[i] ? '✓' : '□'} ${it.w}`}</Text></View>
                  </Pressable>
                ))}
              </View>
              {draftAdding ? (
                <View style={s.addBox}>
                  <CardForm
                    submitLabel="초안에 추가"
                    onCancel={() => setDraftAdding(false)}
                    onDirtyChange={setDraftDirty}
                    l1={showL1Options ? { slots: l1Items(draft, l1Count), place: draft } : undefined}
                    onSubmit={(item, l1) => {
                      const newIndex = draft.items.length;
                      const idx = l1Indices(draft, l1Count);
                      if (l1) idx[l1.slot] = newIndex;
                      setDraft({ ...draft, items: [...draft.items, l1 ? { ...item, l1s: l1.item.l1s } : item], l1: l1 ? idx : draft.l1 });
                      setKeep([...keep, true]);
                      setDraftAdding(false);
                    }}
                  />
                </View>
              ) : (
                <Pressable style={[s.btn, s.dashed]} onPress={() => setDraftAdding(true)}>
                  <Text style={[s.btnT, { color: C.primary }]}>＋ 초안에 카드 추가</Text>
                </Pressable>
              )}
              <Text style={s.dL3}>{`L3 문장: ${draft.l3.slice(0, 3).join(' / ')}`}</Text>
              <View style={s.row}>
                <Pressable style={[s.btn, s.ghost, { flex: 1 }]} onPress={() => setDraft(null)}>
                  <Text style={s.btnT}>취소</Text>
                </Pressable>
                <Pressable style={[s.btn, s.pri, { flex: 1 }]} onPress={approve}>
                  <Text style={[s.btnT, { color: '#fff' }]}>승인하고 추가</Text>
                </Pressable>
              </View>
            </View>
          )}
        </Section>

        <Section title="카드 추가·관리">
          <Text style={s.lvD}>카드를 추가할 판을 고르세요</Text>
          <View style={s.wrapRow}>
            {places.map((p) => (
              <Pressable key={p.id} style={[s.pChip, cardPlace.id === p.id && s.pChipOn]} onPress={() => { setCardPlaceId(p.id); setEditing(null); }}>
                <Text style={[{ fontSize: 13 }, cardPlace.id === p.id && { color: '#fff' }]}>{`${p.icon} ${p.name}`}</Text>
              </Pressable>
            ))}
          </View>
          <View style={s.addBox}>
            <CardForm
              key={`add-${cardPlace.id}`}
              submitLabel={`${cardPlace.name} 판에 추가`}
              onDirtyChange={setAddDirty}
              l1={showL1Options ? { slots: l1For(cardPlace, l1Count), place: cardPlace } : undefined}
              onSubmit={(item, l1) => {
                addCard(cardPlace.id, item);
                if (l1) setL1Slot(cardPlace.id, l1.slot, l1.item);
                showToast(
                  l1
                    ? `"${item.w}" 카드를 ${cardPlace.name} 판에 추가하고 L1 ${l1.slot + 1}번 칸에 넣었어요`
                    : `"${item.w}" 카드를 ${cardPlace.name} 판에 추가했어요`,
                );
              }}
            />
          </View>
          <Text style={[s.secT, { marginTop: 6, marginBottom: 0 }]}>{`${cardPlace.name} 판 카드 (${cardPlace.items.length}개)`}</Text>
          <Text style={s.hint}>추가한 카드는 수정·삭제, 기본 카드는 수정·숨기기를 할 수 있어요.</Text>
          {cardPlace.items.map((it, i) => {
            const added = i >= baseCount(cardPlace.id);
            const tag = it.hidden ? '숨김' : added ? '추가함' : it.edited ? '수정함' : '';
            return (
              <View key={`card-${cardPlace.id}-${i}`}>
                <View style={[s.mine, it.hidden && { opacity: 0.5 }]}>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, flex: 1 }}>
                    <CardSymbol icon={it.i} label={it.w} image={it.image} size={36} />
                    <Text style={{ fontSize: 14, flex: 1 }}>{`${it.w}${it.t === 'n' ? ' (단어)' : ' (표현)'}${tag ? `  · ${tag}` : ''}`}</Text>
                  </View>
                  <View style={s.acts}>
                    {it.hidden ? (
                      <Pressable onPress={() => restoreCard(cardPlace.id, i)} hitSlop={8}>
                        <Text style={s.actT}>다시 보이기</Text>
                      </Pressable>
                    ) : (
                      <>
                        {!added && it.edited && (
                          <Pressable onPress={() => restoreCard(cardPlace.id, i)} hitSlop={8}>
                            <Text style={s.actT}>원래대로</Text>
                          </Pressable>
                        )}
                        <Pressable onPress={() => setEditing(editing === i ? null : i)} hitSlop={8} disabled={editing !== null && editing !== i}>
                          <Text style={[s.actT, editing !== null && editing !== i && { opacity: 0.3 }]}>{editing === i ? '닫기' : '수정'}</Text>
                        </Pressable>
                        <Pressable onPress={() => void deleteCard(i)} hitSlop={8}>
                          <Text style={[s.actT, { color: C.danger }]}>{added ? '삭제' : '숨기기'}</Text>
                        </Pressable>
                      </>
                    )}
                  </View>
                </View>
                {editing === i && (
                  <View style={[s.addBox, { marginTop: 4 }]}>
                    <CardForm
                      key={`edit-${cardPlace.id}-${i}`}
                      initial={it}
                      submitLabel="수정 저장"
                      onDirtyChange={setEditDirty}
                      onCancel={() => setEditing(null)}
                      onSubmit={(item) => {
                        updateCard(cardPlace.id, i, item);
                        setEditing(null);
                        showToast(`"${item.w}" 카드를 수정했어요`);
                      }}
                    />
                  </View>
                )}
              </View>
            );
          })}

          {showL1Options && (
            <>
          <Text style={[s.secT, { marginTop: 10, marginBottom: 0 }]}>{`${cardPlace.name} L1 칸 (${l1Count}칸, 위치 고정)`}</Text>
          {l1For(cardPlace, l1Count).map((it, i) => {
            const changed = !!l1Overrides[cardPlace.id]?.[String(i)];
            return (
              <View key={`l1-${i}`} style={s.mine}>
                <CardSymbol icon={it.i} label={it.w} image={it.image} size={36} />
                <Text style={[{ fontSize: 14, flex: 1, marginHorizontal: 6 }, changed && { color: C.primary, fontWeight: '700' }]}>
                  {`${i + 1}. ${it.l1s ?? it.w}${changed ? '  (바꿈)' : ''}`}
                </Text>
                {changed && (
                  <Pressable onPress={() => setL1Slot(cardPlace.id, i, null)} hitSlop={8}>
                    <Text style={{ color: C.primary, fontSize: 12 }}>기본값으로</Text>
                  </Pressable>
                )}
              </View>
            );
          })}
          {Object.keys(l1Overrides[cardPlace.id] ?? {}).length > 0 && (
            <Pressable style={[s.btn, s.ghost, { marginTop: 6 }]} onPress={() => resetL1(cardPlace.id)}>
              <Text style={s.btnT}>L1 칸 모두 기본값으로</Text>
            </Pressable>
          )}
            </>
          )}
        </Section>

        <Section title={showL1Options ? '지금 장소 (L1 화면에 표시)' : '지금 장소'}>
          <View style={s.wrapRow}>
            {places.map((p) => (
              <Pressable key={p.id} style={[s.pChip, settings.placeId === p.id && s.pChipOn]} onPress={() => update({ placeId: p.id })}>
                <Text style={[{ fontSize: 13 }, settings.placeId === p.id && { color: '#fff' }]}>{`${p.icon} ${p.name}`}</Text>
              </Pressable>
            ))}
          </View>
        </Section>

        <Section title="내가 만든 판">
          {custom.length === 0 ? (
            <Text style={{ fontSize: 13, color: C.sub }}>아직 없어요</Text>
          ) : (
            custom.map((p) => (
              <View key={p.id} style={s.mine}>
                <Text style={{ fontSize: 14 }}>{`${p.icon} ${p.name}`}</Text>
                <Pressable onPress={() => removePlace(p.id)} hitSlop={8}>
                  <Text style={{ color: C.danger, fontSize: 12 }}>삭제</Text>
                </Pressable>
              </View>
            ))
          )}
        </Section>

        <Section title="이름 (L3 문장에 사용, 기기에만 저장)">
          <TextInput value={name} onChangeText={setName} onEndEditing={() => update({ name: name.trim() })} placeholder="예: 김하늘" style={s.txt} />
        </Section>

        <Section title="말하기 속도">
          <View style={s.row}>
            <Pressable style={[s.btn, s.ghost]} onPress={() => setRate(settings.rate - 0.1)}>
              <Text style={s.btnT}>－ 느리게</Text>
            </Pressable>
            <Text style={{ fontSize: 16, fontWeight: '700', minWidth: 50, textAlign: 'center' }}>{`${settings.rate.toFixed(1)}x`}</Text>
            <Pressable style={[s.btn, s.ghost]} onPress={() => setRate(settings.rate + 0.1)}>
              <Text style={s.btnT}>＋ 빠르게</Text>
            </Pressable>
          </View>
        </Section>

        <Section title="보호자 PIN 변경">
          <View style={s.row}>
            <TextInput
              value={newPin}
              onChangeText={(v) => setNewPin(v.replace(/\D/g, '').slice(0, 4))}
              keyboardType="number-pad"
              secureTextEntry
              placeholder="새 PIN 4자리"
              style={[s.txt, { flex: 1 }]}
            />
            <Pressable
              style={[s.btn, s.pri]}
              onPress={() => {
                if (newPin.length !== 4) return showToast('PIN은 4자리 숫자예요');
                update({ pin: newPin });
                setNewPin('');
                showToast('PIN을 변경했어요');
              }}
            >
              <Text style={[s.btnT, { color: '#fff' }]}>변경</Text>
            </Pressable>
          </View>
        </Section>

        <Pressable
          style={[s.btn, s.ghost]}
          onPress={() =>
            Alert.alert('초기화', '설정과 만든 판을 모두 지울까요?', [
              { text: '취소', style: 'cancel' },
              { text: '초기화', style: 'destructive', onPress: () => resetAll().then(() => setName('')) },
            ])
          }
        >
          <Text style={s.btnT}>전체 초기화</Text>
        </Pressable>
        <Text style={s.lvD}>기본 그림: OpenMoji · CC BY-SA 4.0 · openmoji.org (원본 그대로 사용). 임상 검증된 AAC 상징 세트는 아니며, 사용자가 그림의 뜻을 이해하는지 확인해 주세요.</Text>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <View style={s.sec}>
      <Text style={s.secT}>{title}</Text>
      <View style={{ gap: 6 }}>{children}</View>
    </View>
  );
}

const s = StyleSheet.create({
  acts: { flexDirection: 'row', gap: 14, alignItems: 'center' },
  actT: { color: C.primary, fontSize: 13, fontWeight: '600' },
  hdr: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', padding: 14 },
  hdrT: { fontSize: 18, fontWeight: '800' },
  sec: { backgroundColor: '#fff', borderRadius: 14, padding: 12 },
  secT: { fontSize: 13, color: '#555', fontWeight: '700', marginBottom: 8 },
  lv: { borderWidth: 1.5, borderColor: '#ddd', borderRadius: 12, padding: 10 },
  lvOn: { borderColor: C.primary, backgroundColor: C.primarySoft },
  lvT: { fontWeight: '700', fontSize: 15 },
  lvD: { fontSize: 12, color: '#777', marginTop: 2 },
  txt: { borderWidth: 1.5, borderColor: '#ddd', borderRadius: 10, padding: 10, fontSize: 15, backgroundColor: '#fff' },
  hint: { fontSize: 11, color: '#a06a00', backgroundColor: C.core, borderRadius: 8, padding: 8 },
  btn: { paddingVertical: 11, paddingHorizontal: 14, borderRadius: 10, alignItems: 'center' },
  pri: { backgroundColor: C.primary },
  ghost: { backgroundColor: '#eceef1' },
  btnT: { fontWeight: '700', fontSize: 14, color: C.text },
  row: { flexDirection: 'row', gap: 8, alignItems: 'center' },
  wrapRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  pChip: { backgroundColor: C.gray, borderRadius: 14, paddingHorizontal: 10, paddingVertical: 7 },
  pChipOn: { backgroundColor: C.primary },
  dHead: { fontWeight: '800', fontSize: 16 },
  dSub: { fontSize: 12, color: '#777', marginVertical: 4 },
  dItems: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginVertical: 6 },
  dItem: { width: '48.5%', borderWidth: 1, borderColor: '#e3e3e3', borderRadius: 8, padding: 7 },
  dL3: { fontSize: 12, color: '#555', backgroundColor: '#f6f7f9', borderRadius: 8, padding: 8, marginBottom: 8 },
  addBox: { borderWidth: 1, borderColor: '#e3e3e3', borderRadius: 12, padding: 10, backgroundColor: '#fafbfc', marginBottom: 8 },
  dashed: { borderWidth: 1.5, borderStyle: 'dashed', borderColor: '#9bb3e8', backgroundColor: '#fff', marginBottom: 8 },
  mine: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 8, borderBottomWidth: 1, borderColor: '#f0f0f0' },
});
