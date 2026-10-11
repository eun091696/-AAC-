import React, { useRef, useState } from 'react';
import { FlatList, Pressable, ScrollView, StyleSheet, Text, TextInput, useWindowDimensions, View } from 'react-native';
import type { Item, Opt } from '../types';
import { CORE, GEN_PRED, OPTS } from '../data';
import { useL1Count } from '../lib/useL1Count';
import { compose } from '../lib/korean';
import { visibleItems } from '../lib/cardEdits';
import { useApp } from '../state/AppState';
import { Grid } from '../components/Grid';
import { SymbolButton } from '../components/SymbolButton';
import { C } from '../theme';

type Props = {
  onShow: (text: string) => void;
  onGuardian: () => void;
  onAddCard: () => void;
  onAsk: (q: string, opts: Opt[], fromShow: boolean) => void;
};

export function HomeScreen({ onShow, onGuardian, onAddCard, onAsk }: Props) {
  const { settings, place, places, update, say, speakWord, last, l1For } = useApp();
  const l1Count = useL1Count();
  const { width } = useWindowDimensions();
  const L = settings.level;
  const [chips, setChips] = useState<Item[]>([]);
  const chipScroll = useRef<ScrollView>(null);
  const [text, setText] = useState('');

  const composed = compose(chips);
  const current = L === 'L2' ? composed || last : L === 'L3' ? text.trim() || last : last;
  const tablet = width >= 700;

  const onCore = (c: Item) => {
    if (L === 'L2' && chips.length) {
      setChips([...chips, c]);
      speakWord(c.w);
    } else say(c.s);
  };

  const core = CORE[L];
  const coreIcon = L === 'L1' ? 30 : 20;
  const coreLabel = L === 'L1' ? 15 : L === 'L2' ? 12 : 13;

  return (
    <View style={s.wrap}>
      {/* header */}
      <View style={s.hdr}>
        <View style={s.placeBox}>
          <Text style={s.placeT}>{place.icon}</Text>
          <Text style={s.placeT} numberOfLines={1}>{`지금: ${place.name}`}</Text>
        </View>
        <Text style={s.lvl}>{L}</Text>
        <Pressable style={s.gbtn} onPress={onGuardian} accessibilityLabel="보호자 모드">
          <View style={s.row}>
            <Text style={s.gbtnT}>🔒</Text>
            <Text style={s.gbtnT} numberOfLines={1}>보호자</Text>
          </View>
        </Pressable>
      </View>

      {/* 고정 핵심 버튼 */}
      <View style={s.core}>
        {core.map((c) => (
          <SymbolButton
            key={c.w}
            icon={c.i} image={c.image}
            label={c.w}
            variant={c.tone ?? 'core'}
            iconSize={coreIcon}
            labelSize={coreLabel}
            style={{ minHeight: L === 'L1' ? 96 : 76 }}
            onPress={() => onCore(c)}
          />
        ))}
      </View>

      {/* L2 조합 줄 */}
      {L === 'L2' && (
        <View style={s.strip}>
          <View style={s.stripRow}>
            <ScrollView
              ref={chipScroll}
              horizontal
              showsHorizontalScrollIndicator={false}
              style={s.chipsScroll}
              contentContainerStyle={s.chips}
              // 카드를 고르면 방금 고른 카드(맨 오른쪽)가 보이게
              onContentSizeChange={() => chipScroll.current?.scrollToEnd({ animated: true })}
            >
              {chips.length ? (
                chips.map((c, i) => (
                  <Pressable key={i} style={s.chip} onPress={() => setChips(chips.filter((_, k) => k !== i))}>
                    <Text style={s.chipT}>{c.w}</Text>
                  </Pressable>
                ))
              ) : (
                <Text style={s.ph}>버튼을 눌러 문장을 만들어요</Text>
              )}
            </ScrollView>
            {chips.length > 0 && (
              <Pressable onPress={() => setChips([])} accessibilityLabel="모두 지우기" hitSlop={8}>
                <Text style={s.clr}>⌫</Text>
              </Pressable>
            )}
          </View>
          <Text style={s.preview}>{composed}</Text>
        </View>
      )}

      {/* 장소 탭 (L2/L3) */}
      {L !== 'L1' && (
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={s.tabsWrap} contentContainerStyle={s.tabs}>
          {places.map((p) => (
            <Pressable key={p.id} style={[s.tab, s.row, p.id === place.id && s.tabOn]} onPress={() => update({ placeId: p.id })}>
              {/* 안드로이드: 이모지와 한글을 한 Text에 넣으면 너비 계산이 틀려 뒷글자가 잘림 → 분리 */}
              <Text style={s.tabT}>{p.icon}</Text>
              <Text style={[s.tabT, p.id === place.id && { color: '#fff' }]} numberOfLines={1}>{p.name}</Text>
            </Pressable>
          ))}
          <Pressable style={[s.tab, s.row, s.tabAdd]} onPress={onGuardian}>
            <Text style={s.tabT}>＋</Text>
            <Text style={s.tabT} numberOfLines={1}>새 판</Text>
          </Pressable>
        </ScrollView>
      )}

      {/* 본문 */}
      {L === 'L1' && (
        <Grid
          data={l1For(place, l1Count)}
          cols={l1Count === 9 ? 3 : 2}
          fill
          renderItem={(it) => (
            <SymbolButton
              icon={it.i} image={it.image}
              label={it.l1s ?? it.w}
              iconSize={l1Count === 9 ? 44 : 52}
              labelSize={18}
              onPress={() => (it.body && !it.l1s ? onAsk('어디가 아파요?', OPTS.body, false) : say(it.l1s ?? it.s))}
            />
          )}
        />
      )}

      {L === 'L2' && (
        <Grid<Item | null>
          data={[...visibleItems(place), null]}
          cols={tablet ? 4 : 3}
          // 실제 칸 너비만큼 그림 + 글자 한 줄: 그림이 칸을 꽉 채우게
          squareExtra={30}
          renderItem={(it) =>
            it ? (
              <SymbolButton
                icon={it.i} image={it.image}
                label={it.w}
                labelSize={15}
                onPress={() => {
                  setChips([...chips, it]);
                  speakWord(it.w);
                }}
              />
            ) : (
              <SymbolButton icon="＋" label="카드 추가" variant="add" onPress={onAddCard} />
            )
          }
        />
      )}

      {L === 'L3' && (
        <View style={{ flex: 1 }}>
          <TextInput value={text} onChangeText={setText} placeholder="하고 싶은 말을 입력하세요" style={s.input} returnKeyType="done" />
          <View style={s.preds}>
            {(place.pred ?? GEN_PRED).map((w) => (
              <Pressable key={w} style={s.chip} onPress={() => setText((t) => `${t.trim()} ${w}`.trim())}>
                <Text style={s.chipT}>{w}</Text>
              </Pressable>
            ))}
          </View>
          <Text style={s.sec}>이 장소에서 자주 쓰는 문장</Text>
          <FlatList
            data={place.l3.map((x) => x.replace('{name}', settings.name || '○○○'))}
            keyExtractor={(x, i) => `${i}-${x}`}
            contentContainerStyle={{ gap: 6, padding: 10 }}
            renderItem={({ item }) => (
              <Pressable
                style={({ pressed }) => [s.li, pressed && { backgroundColor: '#e8eefc' }]}
                onPress={() => {
                  setText(item);
                  say(item);
                }}
              >
                <Text style={s.liT}>{item}</Text>
              </Pressable>
            )}
          />
        </View>
      )}

      {/* 하단 */}
      <View style={s.bottom}>
        <Pressable style={[s.bBtn, { backgroundColor: C.primary }]} onPress={() => say(current)}>
          <Text style={s.bBtnT}>{L === 'L1' ? '🔊 다시 말하기' : '🔊 말하기'}</Text>
        </Pressable>
        <Pressable style={[s.bBtn, { backgroundColor: C.dark }]} onPress={() => onShow(current)}>
          <Text style={s.bBtnT}>📱 보여주기</Text>
        </Pressable>
      </View>
    </View>
  );
}

const s = StyleSheet.create({
  wrap: { flex: 1, backgroundColor: C.bg },
  hdr: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: 12, paddingVertical: 8, borderBottomWidth: 1, borderColor: C.line },
  placeBox: { flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: C.primarySoft, paddingHorizontal: 10, paddingVertical: 5, borderRadius: 14, flexShrink: 0 },
  placeT: { color: C.primary, fontWeight: '700', fontSize: 14 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 4, flexShrink: 0 },
  lvl: { fontSize: 11, color: C.sub, borderWidth: 1, borderColor: '#ddd', borderRadius: 8, paddingHorizontal: 6, paddingVertical: 2 },
  gbtn: { marginLeft: 'auto', backgroundColor: '#f3f4f6', borderRadius: 8, paddingHorizontal: 8, paddingVertical: 6 },
  gbtnT: { fontSize: 12, color: '#777' },
  core: { flexDirection: 'row', gap: 6, padding: 8, backgroundColor: C.core, borderBottomWidth: 2, borderColor: C.coreLine },
  strip: { marginHorizontal: 10, marginTop: 8, borderWidth: 2, borderStyle: 'dashed', borderColor: '#9bb3e8', borderRadius: 12, padding: 8 },
  stripRow: { flexDirection: 'row', alignItems: 'center', minHeight: 32, gap: 6 },
  // 고른 카드는 한 줄로 고정, 많으면 좌우로 스크롤 (아래 카드 목록이 밀리지 않음)
  chipsScroll: { flex: 1, flexGrow: 1 },
  chips: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  chip: { backgroundColor: C.primarySoft, borderRadius: 8, paddingHorizontal: 8, paddingVertical: 5 },
  chipT: { fontSize: 13, color: C.text },
  ph: { fontSize: 12, color: '#999' },
  clr: { fontSize: 20, color: '#666', paddingHorizontal: 6 },
  preview: { fontSize: 16, fontWeight: '700', color: C.primary, marginTop: 2, minHeight: 20 },
  // 장소 탭 아래 여백 + 구분선: 카드를 스크롤해도 탭과 붙어 보이지 않게
  // flexShrink 0: 위 문장 칸이 커져도 탭 줄이 눌려 잘리지 않게
  tabsWrap: { flexGrow: 0, flexShrink: 0, borderBottomWidth: 1, borderColor: C.line },
  tabs: { gap: 6, paddingHorizontal: 10, paddingTop: 8, paddingBottom: 10 },
  tab: { backgroundColor: C.gray, borderRadius: 14, paddingHorizontal: 10, paddingVertical: 6 },
  tabOn: { backgroundColor: C.primary },
  tabAdd: { backgroundColor: '#fff', borderWidth: 1, borderStyle: 'dashed', borderColor: '#aaa' },
  tabT: { fontSize: 12, color: C.text },
  input: { marginHorizontal: 10, marginTop: 8, borderWidth: 1.5, borderColor: '#bbb', borderRadius: 12, padding: 12, fontSize: 16 },
  preds: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, paddingHorizontal: 10, paddingVertical: 8 },
  sec: { fontSize: 12, color: C.sub, paddingHorizontal: 12 },
  li: { borderWidth: 1.5, borderColor: C.btnLine, borderRadius: 12, padding: 12, backgroundColor: '#fafbfc' },
  liT: { fontSize: 15, color: C.text },
  bottom: { flexDirection: 'row', gap: 8, padding: 10, borderTopWidth: 1, borderColor: C.line },
  bBtn: { flex: 1, paddingVertical: 14, borderRadius: 14, alignItems: 'center' },
  bBtnT: { color: '#fff', fontWeight: '800', fontSize: 15 },
});
