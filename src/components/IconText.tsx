import { StyleSheet, Text, View, type StyleProp, type TextStyle } from 'react-native';

/**
 * 이모지 + 글자를 나란히 표시.
 * 안드로이드에서 이모지와 한글을 한 Text에 넣으면 너비 계산이 틀려 뒷글자가 잘리는 문제가 있어 분리한다.
 */
export function IconText({ icon, text, style }: { icon: string; text: string; style?: StyleProp<TextStyle> }) {
  return (
    <View style={s.row}>
      {!!icon && <Text style={style}>{icon}</Text>}
      <Text style={style} numberOfLines={1}>{text}</Text>
    </View>
  );
}

const s = StyleSheet.create({ row: { flexDirection: 'row', alignItems: 'center', gap: 4, flexShrink: 0 } });
