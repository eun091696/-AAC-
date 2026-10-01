import React, { useEffect, useRef, useState } from 'react';
import { Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import type { CardImage, Item, Place } from '../types';
import { N, P, suggestL1Sentence } from '../data';
import { compose } from '../lib/korean';
import { CardSymbol } from './CardSymbol';
import { findCardImage, generateCardImage, imageServerConfigured } from '../lib/cardImages';
import { C } from '../theme';
import { confirmAsync } from '../lib/confirm';

type Kind = 'n' | 'p';
type Join = 'none' | 'iga' | 'obj';

type Props = {
  /** l1: L1 칸에도 넣었을 때 { 바꿀 칸 번호, L1용 카드(l1s 포함) } */
  onSubmit: (item: Item, l1?: { slot: number; item: Item }) => void;
  onCancel?: () => void;
  submitLabel?: string;
  /** 주면 "L1 화면에도 보이기" 옵션이 나타남. slots: 지금 L1 칸 목록 */
  l1?: { slots: Item[]; place: Place };
  /** 주면 수정 모드: 이 카드 값으로 채워서 시작 */
  initial?: Item;
  /** 저장 안 한 입력이 있는지 부모에게 알림 (뒤로가기 확인용) */
  onDirtyChange?: (dirty: boolean) => void;
};

const UNSAVED_TITLE = '저장하지 않은 내용이 있어요';
export const UNSAVED_MSG = '입력한 내용이 저장되지 않았어요. 정말 취소할까요?';

const SAMPLE_NOUN = N('', '배');
const SAMPLE_PRED = P('', '아파요', '아파요', 'iga');

/** 카드(버튼) 1개를 만드는 입력 폼. 홈 화면, 보호자 모드, 판 초안에서 공통 사용 */
export function CardForm({ onSubmit, onCancel, submitLabel = '카드 추가', l1, initial, onDirtyChange }: Props) {
  const initSentence = initial?.t === 'p' && initial.s !== initial.w ? initial.s : '';
  const initJoin: Join = initial?.j ?? 'none';
  const [generated, setGenerated] = useState<{ key: string; image: CardImage } | null>(
    initial?.image ? { key: JSON.stringify([initial.w.trim(), initial.t, initSentence.trim()]), image: initial.image } : null,
  );
  const [generating, setGenerating] = useState(false);
  const [imageError, setImageError] = useState('');
  const [allowAI, setAllowAI] = useState(false);
  const generation = useRef(0);
  const controller = useRef<AbortController | null>(null);
  const [label, setLabel] = useState(initial?.w ?? '');
  const [kind, setKind] = useState<Kind>(initial?.t ?? 'n');
  const [sentence, setSentence] = useState(initSentence);
  const [join, setJoin] = useState<Join>(initJoin);
  const [error, setError] = useState('');
  const [showL1, setShowL1] = useState(false);
  const [l1Text, setL1Text] = useState('');
  const [slot, setSlot] = useState<number | null>(null);

  const imageKey = JSON.stringify([label.trim(), kind, sentence.trim()]);
  const libraryImage = findCardImage(label);
  const cardImage = generated?.key === imageKey ? generated.image : libraryImage;
  // 입력이 바뀌면 진행 중이던 그림 생성 상태를 렌더 중에 초기화 (effect 안 setState 대신)
  const [prevImageKey, setPrevImageKey] = useState(imageKey);
  if (prevImageKey !== imageKey) {
    setPrevImageKey(imageKey);
    setGenerating(false);
    setImageError('');
  }
  // 이전 요청은 무효화하고 네트워크 요청은 취소
  useEffect(() => {
    const gen = generation;
    const ctrl = controller;
    gen.current++;
    ctrl.current?.abort();
    return () => { gen.current++; ctrl.current?.abort(); };
  }, [imageKey]);

  const makeImage = async () => {
    if (!label.trim() || generating) return;
    if (!allowAI) { setImageError('AI 생성을 사용하려면 아래 전송 동의를 선택해 주세요.'); return; }
    const requestId = ++generation.current;
    controller.current?.abort();
    controller.current = new AbortController();
    setGenerating(true);
    setImageError('');
    try {
      const image = await generateCardImage(label, kind, sentence, controller.current.signal);
      if (requestId === generation.current) setGenerated({ key: imageKey, image });
    } catch (e) {
      if (requestId === generation.current) setImageError(e instanceof Error ? e.message : '그림을 만들지 못했어요.');
    } finally { if (requestId === generation.current) setGenerating(false); }
  };
  const autoImage = () => { if (!cardImage && allowAI) void makeImage(); };

  const build = (): Item | null => {
    const w = label.trim();
    if (!w) return null;
    const i = cardImage?.source === 'library' ? cardImage.symbol : '💬';
    // 수정 모드에서 종류가 같으면 원래 카드의 다른 속성(신체 선택 등)은 유지
    const keepFrom = initial && initial.t === kind ? initial : {};
    if (kind === 'n') return { ...keepFrom, ...N(i, w), image: cardImage, added: true };
    return { ...keepFrom, ...P(i, w, sentence.trim() || w, join === 'none' ? undefined : join), image: cardImage, added: true };
  };

  const dirty = initial
    ? label !== initial.w || kind !== initial.t || sentence !== initSentence || join !== initJoin
    : !!(label.trim() || sentence.trim() || l1Text.trim());
  useEffect(() => {
    onDirtyChange?.(dirty);
  }, [dirty, onDirtyChange]);
  useEffect(() => () => onDirtyChange?.(false), [onDirtyChange]);

  const cancel = async () => {
    if (!onCancel) return;
    if (dirty && !(await confirmAsync(UNSAVED_TITLE, UNSAVED_MSG, '취소하기', '계속 작성'))) return;
    onCancel();
  };
  const item = build();
  const preview = !item ? '' : item.t === 'n' ? compose([item, SAMPLE_PRED]) : item.j ? compose([SAMPLE_NOUN, item]) : item.s;
  const l1Suggest = item && l1 ? suggestL1Sentence(item, l1.place) : '';
  const l1Sentence = l1Text.trim() || l1Suggest;

  const submit = () => {
    if (!item) {
      setError('카드 이름을 입력하세요');
      return;
    }
    if (l1 && showL1 && slot === null) {
      setError('L1에서 바꿀 칸을 골라 주세요');
      return;
    }
    if (generating) return;
    if (!cardImage) {
      if (allowAI && imageServerConfigured()) { void makeImage(); setError('그림이 만들어지면 확인한 뒤 다시 추가해 주세요.'); }
      else setError(initial ? '그림을 만들거나, 그림 없이 저장을 선택해 주세요.' : '그림을 만들거나, 그림 없이 추가를 선택해 주세요.');
      return;
    }
    save(item);
  };

  const save = (item: Item) => {
    onSubmit(item, l1 && showL1 && slot !== null ? { slot, item: { ...item, l1s: l1Sentence } } : undefined);
    if (initial) return; // 수정 모드는 부모가 폼을 닫음
    setShowL1(false);
    setL1Text('');
    setSlot(null);
    setGenerated(null);
    setImageError('');
    setLabel('');
    setSentence('');
    setJoin('none');
    setError('');
  };

  return (
    <View style={s.wrap}>
      <Text style={s.label}>종류</Text>
      <Seg
        value={kind}
        onChange={(v) => setKind(v as Kind)}
        options={[
          { v: 'n', t: '단어', d: '예: 발, 물, 라면' },
          { v: 'p', t: '표현', d: '예: 어지러워요' },
        ]}
      />

      <Text style={s.label}>카드 이름</Text>
      <TextInput value={label} maxLength={80} onBlur={autoImage} onChangeText={(v) => { setLabel(v); setError(''); }} placeholder={kind === 'n' ? '발' : '어지러워요'} style={s.txt} />
      <View style={[s.preview, { flexDirection: 'row', alignItems: 'center', gap: 12 }]}>
        <CardSymbol label={label} image={cardImage} size={72} />
        <View style={{ flex: 1 }}>
          <Text style={s.label}>{generating ? '그림을 만드는 중…' : cardImage ? cardImage.source === 'library' ? '기본 그림 자동 선택' : 'AI가 만든 그림' : '카드 이름으로 그림을 준비해요'}</Text>
          <Text style={s.hint}>사진을 찍거나 이모지를 입력할 필요가 없어요. 저장 전에 뜻이 맞는지 확인해 주세요.</Text>
        </View>
      </View>
      {!imageServerConfigured() && !cardImage && <Text style={s.hint}>이 표현은 기본 그림 사전에 없어요. AI 이미지 서버를 연결하면 자동 생성할 수 있어요.</Text>}
      {imageServerConfigured() && (
        <>
          <Pressable style={s.check} accessibilityRole="checkbox" accessibilityState={{ checked: allowAI }} onPress={() => setAllowAI(v => !v)}>
            <Text style={s.checkT}>{allowAI ? '✓ ' : ''}AI 자동 그림 생성 사용</Text>
            <Text style={s.hint}>카드 이름과 말할 문장이 이미지 서버 및 OpenAI로 전송됩니다. 개인정보는 입력하지 마세요. 기본 그림 선택은 전송하지 않습니다.</Text>
          </Pressable>
          <Pressable style={s.check} disabled={generating || !label.trim() || !allowAI} onPress={() => void makeImage()} accessibilityRole="button">
            <Text style={s.checkT}>{generating ? '그림 생성 중…' : cardImage ? '다른 그림 AI로 만들기' : '그림 만들기 / 다시 시도'}</Text>
          </Pressable>
        </>
      )}
      {imageError ? <Text style={s.error}>{imageError}</Text> : null}

      {kind === 'p' && (
        <>
          <Text style={s.label}>말할 문장 (비우면 카드 이름 그대로)</Text>
          <TextInput value={sentence} maxLength={160} onBlur={autoImage} onChangeText={setSentence} placeholder="예: 머리가 어지러워요" style={s.txt} />
          <Text style={s.label}>앞에 누른 단어와 이어 붙이기</Text>
          <Seg
            value={join}
            onChange={(v) => setJoin(v as Join)}
            options={[
              { v: 'none', t: '안 붙임', d: '무서워요' },
              { v: 'iga', t: '이/가 붙임', d: '배가 아파요' },
              { v: 'obj', t: '그대로', d: '물 주세요' },
            ]}
          />
        </>
      )}

      {l1 && (
        <>
          <Pressable style={s.check} onPress={() => setShowL1((v) => !v)}>
            <Text style={s.checkT}>{`${showL1 ? '☑️' : '⬜️'} L1 화면에도 보이기`}</Text>
            <Text style={s.hint}>L1은 칸 수가 고정이라, 기존 칸 하나와 바꿔요. 나머지 칸은 그대로예요.</Text>
          </Pressable>
          {showL1 && (
            <>
              <Text style={s.label}>L1에서 누르면 말할 문장</Text>
              <TextInput value={l1Text} onChangeText={setL1Text} placeholder={l1Suggest || '예: 발이 아파요'} style={s.txt} />
              <Text style={s.label}>바꿀 칸 선택</Text>
              <View style={s.slots}>
                {l1.slots.map((it, i) => (
                  <Pressable
                    key={i}
                    style={[s.slot, slot === i && s.slotOn]}
                    onPress={() => {
                      setSlot(i);
                      setError('');
                    }}
                  >
                    <CardSymbol icon={it.i} label={it.w} image={it.image} size={32} />
                    <Text style={s.slotT} numberOfLines={1}>{`${i + 1}. ${it.l1s ?? it.w}`}</Text>
                  </Pressable>
                ))}
              </View>
            </>
          )}
        </>
      )}

      {preview ? <Text style={s.preview}>{`말하는 예: "${preview}"${showL1 && l1Sentence ? `\nL1에서: "${l1Sentence}"` : ''}`}</Text> : null}
      {error ? <Text style={s.error}>{error}</Text> : null}

      <View style={s.row}>
        {onCancel && (
          <Pressable style={[s.btn, s.ghost, { flex: 1 }]} onPress={() => void cancel()}>
            <Text style={s.btnT}>취소</Text>
          </Pressable>
        )}
        <Pressable style={[s.btn, s.pri, { flex: 1 }, generating && { opacity: 0.5 }]} disabled={generating} onPress={submit}>
          <Text style={[s.btnT, { color: '#fff' }]}>{initial ? submitLabel : `＋ ${submitLabel}`}</Text>
        </Pressable>
      </View>
      {!cardImage && !generating && item && <Pressable style={s.check} onPress={() => {
        if (l1 && showL1 && slot === null) { setError('L1에서 바꿀 칸을 골라 주세요'); return; }
        save(item);
      }} accessibilityRole="button"><Text style={s.hint}>{initial ? '그림 없이 저장' : '지금은 그림 없이 추가 (나중에 카드를 수정할 수 있어요)'}</Text></Pressable>}
    </View>
  );
}

function Seg({ value, onChange, options }: { value: string; onChange: (v: string) => void; options: { v: string; t: string; d: string }[] }) {
  return (
    <View style={s.seg}>
      {options.map((o) => (
        <Pressable key={o.v} style={[s.segItem, value === o.v && s.segOn]} onPress={() => onChange(o.v)}>
          <Text style={[s.segT, value === o.v && { color: C.primary }]}>{o.t}</Text>
          <Text style={s.segD}>{o.d}</Text>
        </Pressable>
      ))}
    </View>
  );
}

const s = StyleSheet.create({
  wrap: { gap: 6 },
  row: { flexDirection: 'row', gap: 8, alignItems: 'flex-end' },
  label: { fontSize: 12, color: '#555', fontWeight: '700', marginTop: 4, marginBottom: 2 },
  txt: { borderWidth: 1.5, borderColor: '#ddd', borderRadius: 10, padding: 10, fontSize: 16, backgroundColor: '#fff' },
  hint: { fontSize: 11, color: C.sub },
  seg: { flexDirection: 'row', gap: 6 },
  segItem: { flex: 1, borderWidth: 1.5, borderColor: '#ddd', borderRadius: 10, paddingVertical: 8, alignItems: 'center', backgroundColor: '#fff' },
  segOn: { borderColor: C.primary, backgroundColor: C.primarySoft },
  segT: { fontSize: 14, fontWeight: '700', color: C.text },
  segD: { fontSize: 11, color: C.sub, marginTop: 2 },
  preview: { fontSize: 14, color: C.primary, fontWeight: '700', backgroundColor: C.primarySoft, borderRadius: 8, padding: 8, marginTop: 4 },
  error: { fontSize: 12, color: C.danger },
  check: { borderWidth: 1, borderColor: '#e3e3e3', borderRadius: 10, padding: 10, backgroundColor: '#fff', marginTop: 6, gap: 2 },
  checkT: { fontSize: 14, fontWeight: '700', color: C.text },
  slots: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  slot: { width: '31.5%', borderWidth: 1.5, borderColor: '#ddd', borderRadius: 10, padding: 6, alignItems: 'center', backgroundColor: '#fff' },
  slotOn: { borderColor: C.primary, backgroundColor: C.primarySoft },
  slotT: { fontSize: 11, color: C.text, marginTop: 2 },
  btn: { paddingVertical: 12, paddingHorizontal: 14, borderRadius: 10, alignItems: 'center', marginTop: 6 },
  pri: { backgroundColor: C.primary },
  ghost: { backgroundColor: '#eceef1' },
  btnT: { fontWeight: '700', fontSize: 14, color: C.text },
});
