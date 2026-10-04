import React, { useEffect, useRef, useState } from 'react';
import { Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import type { CardImage, Item, Place } from '../types';
import { N, nounExample, P, suggestL1Sentence } from '../data';
import { iga } from '../lib/korean';
import { CardSymbol } from './CardSymbol';
import { findCardImage, generateCardImage, imageServerConfigured } from '../lib/cardImages';
import { getImageMeaning, imageRequestKey } from '../lib/imageMeaning';
import { findBundledImage } from '../lib/libraryImages';
import { pickLocalCardPhoto } from '../lib/localCardPhoto';
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
  /** 예시 문장을 만들 때 쓰는 판 (이 판에 있는 표현과 자연스럽게 이어지는 예만 보여줌) */
  place?: Place;
  /** 주면 수정 모드: 이 카드 값으로 채워서 시작 */
  initial?: Item;
  /** 저장 안 한 입력이 있는지 부모에게 알림 (뒤로가기 확인용) */
  onDirtyChange?: (dirty: boolean) => void;
};

const UNSAVED_TITLE = '저장하지 않은 내용이 있어요';
export const UNSAVED_MSG = '입력한 내용이 저장되지 않았어요. 정말 취소할까요?';

/** 카드(버튼) 1개를 만드는 입력 폼. 홈 화면, 보호자 모드, 판 초안에서 공통 사용 */
export function CardForm({ onSubmit, onCancel, submitLabel = '카드 추가', l1, place, initial, onDirtyChange }: Props) {
  const initSentence = initial?.t === 'p' && initial.s !== initial.w ? initial.s : '';
  const initJoin: Join = initial?.j ?? 'none';
  const initMeaning = initial?.image && initial.image.source !== 'library' ? initial.image.visualMeaning ?? '' : '';
  const [visualMeaning, setVisualMeaning] = useState(initMeaning);
  const [generated, setGenerated] = useState<{ key: string; image: CardImage; photoIdentity?: string } | null>(null);
  const [approvedKey, setApprovedKey] = useState<string | null>(null);
  const [generating, setGenerating] = useState(false);
  const [photoPicking, setPhotoPicking] = useState(false);
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

  const meaningHint = getImageMeaning(label, kind, visualMeaning);
  // Speech affects local review validity, but is never transmitted to the image server.
  const imageKey = JSON.stringify([imageRequestKey(label, kind, meaningHint.meaning), sentence.trim()]);
  const canKeepExisting = !!initial && label === initial.w && kind === initial.t && sentence === initSentence && visualMeaning === initMeaning;
  const photoIdentity = JSON.stringify([label.trim(), kind]);
  const keepInitialPhoto = initial?.image?.source === 'photo' && label === initial.w && kind === initial.t;
  // 앱에 포함된 검수 그림이 있으면 서버 없이 바로 사용 (단어·종류·뜻이 정확히 같을 때만)
  const bundledImage = meaningHint.meaning ? findBundledImage(label, kind, meaningHint.meaning) : undefined;
  const inheritedImage = keepInitialPhoto ? initial.image : canKeepExisting ? initial?.image ?? findCardImage(initial?.w ?? '') : bundledImage;
  const cardImage = generated?.key === imageKey || (generated?.image.source === 'photo' && generated.photoIdentity === photoIdentity) ? generated.image : inheritedImage;
  const readyImage = cardImage && cardImage.source !== 'pending' ? cardImage : undefined;
  const imageApproved = !!readyImage && approvedKey === imageKey;

  // 입력이 바뀌면 진행 중이던 그림 생성 상태를 렌더 중에 초기화 (effect 안 setState 대신)
  const [prevImageKey, setPrevImageKey] = useState(imageKey);
  if (prevImageKey !== imageKey) {
    setPrevImageKey(imageKey);
    setGenerating(false);
    setPhotoPicking(false);
    setImageError('');
    setApprovedKey(null);
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
    if (!label.trim() || generating || photoPicking) return;
    if (!allowAI) { setImageError('AI 생성을 사용하려면 아래 전송 동의를 선택해 주세요.'); return; }
    if (meaningHint.needsClarification) { setImageError('임의로 뜻을 정하지 않아요. 그림으로 보여줄 뜻이나 장면을 먼저 입력해 주세요.'); return; }
    if (!imageServerConfigured()) { setImageError('AI 이미지 서버 연결이 필요합니다. 연결 전에는 임시 카드로 저장하고 나중에 다시 만들 수 있어요.'); return; }

    const requestId = ++generation.current;
    controller.current?.abort();
    controller.current = new AbortController();
    setGenerating(true);
    setApprovedKey(null);
    setImageError('');
    setError('');
    try {
      const image = await generateCardImage(label, kind, meaningHint.meaning, controller.current.signal);
      if (requestId === generation.current) setGenerated({ key: imageKey, image });
    } catch (e) {
      if (requestId === generation.current) setImageError(e instanceof Error ? e.message : '그림을 만들지 못했어요.');
    } finally { if (requestId === generation.current) setGenerating(false); }
  };
  const autoImage = () => { if (!readyImage && allowAI && !meaningHint.needsClarification && imageServerConfigured()) void makeImage(); };

  const choosePhoto = async (mode: 'camera' | 'album') => {
    if (!label.trim()) { setError('먼저 카드 이름을 입력해 주세요.'); return; }
    if (generating || photoPicking) return;
    const requestId = ++generation.current;
    controller.current?.abort();
    setPhotoPicking(true);
    setImageError('');
    try {
      const uri = await pickLocalCardPhoto(mode);
      if (uri && requestId === generation.current) {
        setGenerated({ key: imageKey, photoIdentity, image: { source: 'photo', uri, visualMeaning: meaningHint.meaning || undefined, reviewed: false } });
        setApprovedKey(null);
      }
    } catch (e) { if (requestId === generation.current) setImageError(e instanceof Error ? e.message : '사진을 선택하지 못했어요.'); }
    finally { if (requestId === generation.current) setPhotoPicking(false); }
  };

  const build = (): Item | null => {
    const w = label.trim();
    if (!w) return null;
    const i = cardImage?.source === 'library' ? cardImage.symbol : '';
    const imageWithMeaning = cardImage?.source === 'photo' ? { ...cardImage, visualMeaning: meaningHint.meaning || undefined } : cardImage;
    const approvedImage = imageWithMeaning && (imageWithMeaning.source === 'ai' || imageWithMeaning.source === 'approved' || imageWithMeaning.source === 'photo') ? { ...imageWithMeaning, reviewed: imageApproved } : imageWithMeaning;
    // 수정 모드에서 종류가 같으면 원래 카드의 다른 속성(신체 선택 등)은 유지
    const keepFrom = initial && initial.t === kind ? initial : {};
    if (kind === 'n') return { ...keepFrom, ...N(i, w), image: approvedImage, added: true };
    return { ...keepFrom, ...P(i, w, sentence.trim() || w, join === 'none' ? undefined : join), image: approvedImage, added: true };
  };

  const dirty = initial
    ? label !== initial.w || kind !== initial.t || sentence !== initSentence || join !== initJoin || visualMeaning !== initMeaning || !!generated
    : !!(label.trim() || sentence.trim() || l1Text.trim() || visualMeaning.trim() || generated);
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
  // 말하는 예: 실제로 누르면 나오는 말 + (자연스러운 경우만) 이어 붙인 예
  const ctxPlace = place ?? l1?.place;
  const preview = !item
    ? ''
    : item.t === 'n'
      ? (() => {
          const ex = meaningHint.choices.length ? undefined : nounExample(item.w, ctxPlace);
          return ex ? `"${item.s}"\n이어서 쓰면: "${ex}"` : `"${item.s}"\n(뒤에 표현 카드를 누르면 이어서 문장이 돼요)`;
        })()
      : item.j
        ? `"${item.s}"\n앞에 단어를 누르면: "${item.j === 'iga' ? iga('○○') : '○○'} ${item.s}"`
        : `"${item.s}"`;
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
    if (generating || photoPicking) return;
    if (!readyImage || (!canKeepExisting && readyImage.source !== 'ai' && readyImage.source !== 'approved' && readyImage.source !== 'photo')) {
      if (meaningHint.needsClarification) setError('그림으로 보여줄 뜻이나 장면을 먼저 입력해 주세요.');
      else if (allowAI && imageServerConfigured()) { void makeImage(); setError('AI 그림을 만든 뒤, 뜻이 맞는지 확인하고 저장해 주세요.'); }
      else setError('그림 생성 동의 또는 서버 연결이 필요해요. 원하면 아래에서 임시 카드로 저장할 수 있어요.');
      return;
    }
    if (!canKeepExisting && meaningHint.needsClarification) { setError('이 그림이 보여줄 구체적인 뜻이나 장면을 입력해 주세요.'); return; }
    if (!imageApproved) { setError('그림의 대상과 행동이 맞고 사용자가 이해하는지 확인해 주세요.'); return; }
    save(item);
  };

  const save = (item: Item) => {
    onSubmit(item, l1 && showL1 && slot !== null ? { slot, item: { ...item, l1s: l1Sentence } } : undefined);
    if (initial) return; // 수정 모드는 부모가 폼을 닫음
    setShowL1(false);
    setL1Text('');
    setSlot(null);
    setGenerated(null);
    setVisualMeaning('');
    setApprovedKey(null);
    setImageError('');
    setLabel('');
    setSentence('');
    setJoin('none');
    setError('');
  };

  const savePending = () => {
    if (!item || generating || photoPicking) return;
    if (l1 && showL1 && slot === null) { setError('L1에서 바꿀 칸을 골라 주세요'); return; }
    const reason = meaningHint.needsClarification ? 'meaning-needed' : !imageServerConfigured() ? 'not-configured' : !allowAI ? 'declined' : imageError ? 'failed' : 'unreviewed';
    save({ ...item, i: '', image: { source: 'pending', visualMeaning: meaningHint.meaning || undefined, reason } });
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
      <Text style={s.label}>그림으로 보여줄 뜻·장면{meaningHint.needsClarification ? ' (필수)' : ''}</Text>
      {meaningHint.choices.length > 0 && (
        <View style={s.wrapChoices}>
          {meaningHint.choices.map(choice => <Pressable key={choice} accessibilityRole="button" onPress={() => { setVisualMeaning(choice); setError(''); }} style={s.check}><Text style={s.checkT}>{choice}</Text></Pressable>)}
        </View>
      )}
      <TextInput value={visualMeaning} maxLength={240} multiline onBlur={autoImage} onChangeText={v => { setVisualMeaning(v); setError(''); }} placeholder={kind === 'n' ? '예: 몸의 배, 먹는 과일 배, 사람이 타는 배' : '예: 사람이 배를 움켜쥐고 아픈 표정을 짓는 장면'} style={s.txt} />
      {meaningHint.automatic && <Text style={s.hint}>확인된 기본 뜻: {meaningHint.meaning}. 다른 뜻이면 위에 직접 입력해 주세요.</Text>}
      <Text style={s.hint}>구체적인 대상·행동·상황만 적어 주세요. 모호한 단어나 감정은 제가 추측하지 않아요. 싫어요/안 해요 같은 부정 표현이면 거절하는 행동도 설명해 주세요. 개인정보는 넣지 마세요.</Text>
      <View style={s.imagePreview}>
        {readyImage ? <CardSymbol label={label} image={cardImage} size={168} /> : <View style={s.emptyImage}><Text style={s.hint}>{generating ? 'AI 사진형 그림을 만들고 있어요…' : 'AI 그림 생성 전'}</Text></View>}
        <Text style={s.label}>{photoPicking ? '사진 선택 중…' : generating ? '검수 그림 조회 / AI 그림 생성 중…' : readyImage ? imageApproved ? '사용할 그림의 뜻 확인 완료' : readyImage.source === 'photo' ? '직접 선택한 사진 · 기기에만 저장' : readyImage.source === 'approved' || readyImage.source === 'bundled' ? '뜻이 일치하는 검수 그림 · 사용자 확인 필요' : generated?.key === imageKey ? 'AI 그림(저장된 결과 재사용 포함) · 사용자 확인 필요' : '기존 그림 유지 · 새로운 AI 생성 아님' : '검수 그림 우선 · 없으면 AI 생성'}</Text>
        <Text style={s.hint}>같은 뜻은 저장된 그림을 재사용해요. 다른 그림을 원하면 뜻·장면을 수정하거나 직접 사진을 선택하세요. 사진형이어도 뜻이 정확하다는 보장은 없어요. 글자를 가리고 대상·행동·거절 의사가 분명한지, 사용자가 구분하는지 확인해 주세요.</Text>
      </View>
      {!imageServerConfigured() && <Text style={s.error}>이미지 서버가 아직 연결되지 않았어요. 지금은 임시 카드로 저장하고, 연결 후 카드 수정에서 그림을 다시 만들 수 있어요.</Text>}
      <Pressable style={s.check} accessibilityRole="checkbox" accessibilityState={{ checked: allowAI }} onPress={() => setAllowAI(v => !v)}>
        <Text style={s.checkT}>{allowAI ? '✓ ' : '□ '}그림 조회·AI 자동 생성에 동의</Text>
        <Text style={s.hint}>카드 이름·그림 뜻과 종류만 이미지 서버와 OpenAI로 전송됩니다. 말할 문장·이름·PIN은 보내지 않습니다. 입력을 마치거나 추가를 누르면 검수 그림을 먼저 찾고 없으면 AI로 만듭니다. 생성 비용이 발생할 수 있어요.</Text>
      </Pressable>
      <Pressable style={s.check} disabled={generating || photoPicking || !label.trim() || !allowAI || meaningHint.needsClarification || !imageServerConfigured()} onPress={() => void makeImage()} accessibilityRole="button" accessibilityLabel={readyImage ? '그림 다시 찾기 / 만들기' : '그림 찾기 / AI로 만들기'}>
        <Text style={s.checkT}>{generating ? '그림 생성 중…' : readyImage ? '그림 다시 찾기 / 만들기' : '그림 찾기 / AI로 만들기'}</Text>
      </Pressable>
      {readyImage && !generating && !photoPicking && <Pressable style={s.check} accessibilityRole="checkbox" accessibilityState={{ checked: imageApproved }} onPress={() => setApprovedKey(imageApproved ? null : imageKey)}>
        <Text style={s.checkT}>{imageApproved ? '✓ ' : '□ '}글자 없이도 뜻이 맞는지 사용자와 확인했어요</Text>
        <Text style={s.hint}>다른 단어와 혼동되지 않고, 표현의 대상·행동·부정 의미가 맞아요. 제가 확인하기 전에는 저장되지 않아요.</Text>
      </Pressable>}
      <Text style={s.label}>직접 사진 사용 (선택 사항)</Text>
      <View style={s.row}>
        <Pressable accessibilityRole="button" style={[s.check, { flex: 1 }]} disabled={generating || photoPicking} onPress={() => void choosePhoto('camera')}><Text style={s.checkT}>사진 찍기</Text></Pressable>
        <Pressable accessibilityRole="button" style={[s.check, { flex: 1 }]} disabled={generating || photoPicking} onPress={() => void choosePhoto('album')}><Text style={s.checkT}>앨범에서 선택</Text></Pressable>
      </View>
      <Text style={s.hint}>직접 선택한 사진은 이 기기에만 저장돼요. AI 서버에 업로드하지 않습니다. 얼굴·문서·주소 등 개인정보가 담기지 않도록 주의해 주세요.</Text>
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

      {preview ? <Text style={s.preview}>{`말하는 예: ${preview}${showL1 && l1Sentence ? `\nL1에서: "${l1Sentence}"` : ''}`}</Text> : null}
      {error ? <Text style={s.error}>{error}</Text> : null}

      <View style={s.row}>
        {onCancel && (
          <Pressable style={[s.btn, s.ghost, { flex: 1 }]} onPress={() => void cancel()}>
            <Text style={s.btnT}>취소</Text>
          </Pressable>
        )}
        <Pressable style={[s.btn, s.pri, { flex: 1 }, (generating || photoPicking) && { opacity: 0.5 }]} disabled={generating || photoPicking} onPress={submit}>
          <Text style={[s.btnT, { color: '#fff' }]}>{initial ? submitLabel : `＋ ${submitLabel}`}</Text>
        </Pressable>
      </View>
      {!generating && !photoPicking && item && <Pressable style={s.check} onPress={savePending} accessibilityRole="button" accessibilityLabel="그림 준비 중 임시 카드로 저장">
        <Text style={s.checkT}>그림 준비 중 임시 카드로 저장</Text>
        <Text style={s.hint}>동의하지 않거나 오프라인·실패한 경우에도 말할 카드는 저장됩니다. 임의의 그림은 붙이지 않아요. 나중에 보호자 모드의 카드 수정에서 그림을 다시 만들 수 있어요.</Text>
      </Pressable>}
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
  wrapChoices: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  imagePreview: { alignItems: 'center', gap: 8, borderWidth: 1, borderColor: '#ddd', borderRadius: 12, padding: 12, backgroundColor: '#fff' },
  emptyImage: { width: 168, height: 168, alignItems: 'center', justifyContent: 'center', backgroundColor: '#f5f5f5', borderRadius: 8 },
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
