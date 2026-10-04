import React, { useRef, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { C } from '../theme';

type Props<T> = {
  data: T[];
  cols: number;
  renderItem: (item: T, index: number) => React.ReactNode;
  /** true: 화면을 꽉 채움(L1), false: 고정 행 높이 + 스크롤(L2) */
  fill?: boolean;
  rowHeight?: number;
  /** 주면 칸 높이 = 실제 칸 너비 + 이 값 (그림이 정사각형으로 꽉 차게) */
  squareExtra?: number;
  gap?: number;
};

export function Grid<T>({ data, cols, renderItem, fill, rowHeight: fixedRow = 88, squareExtra, gap = 8 }: Props<T>) {
  const [gridW, setGridW] = useState(0);
  const rowHeight = squareExtra !== undefined && gridW ? Math.round((gridW - 20 - gap * (cols - 1)) / cols) + squareExtra : fixedRow;
  const rows: T[][] = [];
  for (let i = 0; i < data.length; i += cols) rows.push(data.slice(i, i + cols));

  const content = rows.map((row, ri) => (
    <View key={ri} style={[{ flexDirection: 'row', gap }, fill ? { flex: 1 } : { height: rowHeight }]}>
      {row.map((item, ci) => (
        <View key={ci} style={{ flex: 1 }}>
          {renderItem(item, ri * cols + ci)}
        </View>
      ))}
      {Array.from({ length: cols - row.length }).map((_, k) => (
        <View key={`empty-${k}`} style={{ flex: 1 }} />
      ))}
    </View>
  ));

  if (fill) return <View style={{ flex: 1, gap, padding: 10 }}>{content}</View>;
  return <View style={{ flex: 1 }} onLayout={(e) => setGridW(e.nativeEvent.layout.width)}><ScrollGrid gap={gap}>{content}</ScrollGrid></View>;
}

/** 스크롤 목록 + 조금 내려가면 오른쪽 아래에 "맨 위로" 버튼 */
function ScrollGrid({ gap, children }: { gap: number; children: React.ReactNode }) {
  const ref = useRef<ScrollView>(null);
  const [showTop, setShowTop] = useState(false);
  return (
    <View style={{ flex: 1 }}>
      <ScrollView
        ref={ref}
        contentContainerStyle={{ gap, padding: 10 }}
        scrollEventThrottle={100}
        onScroll={(e) => {
          const down = e.nativeEvent.contentOffset.y > 60; // 한 줄 정도만 내려가도 표시
          if (down !== showTop) setShowTop(down);
        }}
      >
        {children}
      </ScrollView>
      {showTop && (
        <Pressable
          style={({ pressed }) => [s.top, pressed && { opacity: 0.7 }]}
          onPress={() => ref.current?.scrollTo({ y: 0, animated: true })}
          accessibilityRole="button"
          accessibilityLabel="맨 위로"
          hitSlop={8}
        >
          <Text style={s.topT}>↑</Text>
        </Pressable>
      )}
    </View>
  );
}

const s = StyleSheet.create({
  top: {
    position: 'absolute',
    right: 14,
    bottom: 14,
    width: 52,
    height: 52,
    borderRadius: 26,
    backgroundColor: C.primary,
    alignItems: 'center',
    justifyContent: 'center',
    elevation: 4,
    shadowColor: '#000',
    shadowOpacity: 0.2,
    shadowRadius: 4,
    shadowOffset: { width: 0, height: 2 },
  },
  topT: { color: '#fff', fontSize: 24, fontWeight: '700' },
});
