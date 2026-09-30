import { useWindowDimensions } from 'react-native';

/** L1 칸 수: 휴대폰 6칸, 태블릿(가로 700 이상) 9칸 */
export function useL1Count(): 6 | 9 {
  return useWindowDimensions().width >= 700 ? 9 : 6;
}
