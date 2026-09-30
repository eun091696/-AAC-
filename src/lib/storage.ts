import AsyncStorage from '@react-native-async-storage/async-storage';
import type { Item, Place, Settings } from '../types';

// 기기 로컬에만 저장 (서버 전송 없음). 이름·증상 등 민감정보 보호 목적.
const KEY = 'acc.v1';

/** extras: 장소 id별로 보호자가 추가한 카드 (기본 판에도 추가 가능) */
/** l1Overrides: 장소 id별 L1 칸 교체 { 칸번호: 카드 } */
export type Persisted = { settings: Settings; custom: Place[]; extras: Record<string, Item[]>; l1Overrides: Record<string, Record<string, Item>> };

export async function loadState(): Promise<Partial<Persisted> | null> {
  try {
    const raw = await AsyncStorage.getItem(KEY);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

export async function saveState(state: Persisted) {
  try {
    await AsyncStorage.setItem(KEY, JSON.stringify(state));
  } catch {
    // 저장 실패는 사용 흐름을 막지 않음
  }
}

export async function clearState() {
  try {
    await AsyncStorage.removeItem(KEY);
  } catch {}
}
