import React, { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import type { Item, Place, Settings } from '../types';
import { BUILTIN_PLACES, CORE, DEFAULT_SETTINGS, l1Items } from '../data';
import { clearState, loadState, saveState } from '../lib/storage';
import { speak, warmUpSpeech } from '../lib/speech';
import { CardEdits, mergePlace } from '../lib/cardEdits';
import type { ToastAction, ToastState } from '../components/Toast';

type Ctx = {
  ready: boolean;
  settings: Settings;
  places: Place[];
  place: Place;
  custom: Place[];
  last: string;
  toast: ToastState;
  /** 토스트의 되돌리기 등 버튼 실행 */
  runToastAction: () => void;
  update: (patch: Partial<Settings>) => void;
  addPlace: (p: Place) => void;
  removePlace: (id: string) => void;
  /** 판에 카드 추가 (기본 판 포함) */
  addCard: (placeId: string, item: Item) => void;
  /** 판의 카드 삭제. index는 places[].items 순번. 추가한 카드는 지우고, 원래 카드는 숨김 */
  removeCard: (placeId: string, index: number) => () => void;
  /** 카드 수정. 추가한 카드는 그대로 바꾸고, 원래 카드는 수정본을 따로 저장 */
  updateCard: (placeId: string, index: number, item: Item) => void;
  /** 원래 카드의 수정/숨김을 되돌림 */
  restoreCard: (placeId: string, index: number) => void;
  /** 판의 원래 카드 수정·숨김을 모두 풀기 (추가한 카드는 유지). 되돌리기 함수 반환 */
  resetPlaceCards: (placeId: string) => () => void;
  /** 판의 원래 카드 수 (이 순번 이상은 추가한 카드) */
  baseCount: (placeId: string) => number;
  extras: Record<string, Item[]>;
  /** L1 칸 교체 (item=null이면 기본값으로) */
  setL1Slot: (placeId: string, slot: number, item: Item | null) => void;
  resetL1: (placeId: string) => void;
  l1Overrides: Record<string, Record<string, Item>>;
  /** 교체가 반영된 L1 카드 목록 */
  l1For: (place: Place, count: number) => Item[];
  resetAll: () => Promise<void>;
  /** 말하기 + 화면 토스트 + 마지막 문장 기록 */
  say: (text: string) => void;
  /** 버튼 피드백용 짧은 발화 (기록 안 함) */
  speakWord: (text: string) => void;
  /** action을 주면 버튼이 붙고 조금 더 오래 보임 (예: 되돌리기) */
  showToast: (text: string, action?: ToastAction) => void;
};

const AppContext = createContext<Ctx | null>(null);

export function AppStateProvider({ children }: { children: React.ReactNode }) {
  const [ready, setReady] = useState(false);
  const [settings, setSettings] = useState<Settings>(DEFAULT_SETTINGS);
  const [custom, setCustom] = useState<Place[]>([]);
  const [extras, setExtras] = useState<Record<string, Item[]>>({});
  const [l1Overrides, setL1Overrides] = useState<Record<string, Record<string, Item>>>({});
  const [cardEdits, setCardEdits] = useState<CardEdits>({});
  const [last, setLast] = useState('');
  const [toast, setToast] = useState<ToastState>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // 첫 터치 때 소리가 늦지 않게: 오디오 설정과 맨 위 핵심 버튼 음성을 미리 준비
  useEffect(() => {
    warmUpSpeech(Object.values(CORE).flat().flatMap((c) => [c.w, c.s]));
  }, []);

  useEffect(() => {
    loadState().then((s) => {
      if (s?.settings) setSettings({ ...DEFAULT_SETTINGS, ...s.settings });
      if (s?.custom) setCustom(s.custom);
      if (s?.extras) setExtras(s.extras);
      if (s?.l1Overrides) setL1Overrides(s.l1Overrides);
      if (s?.cardEdits) setCardEdits(s.cardEdits);
      setReady(true);
    });
  }, []);

  useEffect(() => {
    if (ready) saveState({ settings, custom, extras, l1Overrides, cardEdits });
  }, [ready, settings, custom, extras, l1Overrides, cardEdits]);

  const rawPlaces = useMemo(() => [...BUILTIN_PLACES, ...custom], [custom]);
  // 원래 카드에 수정/숨김을 덮고, 뒤에 보호자가 추가한 카드를 붙임
  const places = useMemo(
    () => rawPlaces.map((p) => mergePlace(p, cardEdits[p.id], extras[p.id])),
    [rawPlaces, cardEdits, extras],
  );
  const baseCount = useCallback((placeId: string) => rawPlaces.find((p) => p.id === placeId)?.items.length ?? 0, [rawPlaces]);
  const place = places.find((p) => p.id === settings.placeId) ?? places[0];

  const showToast = useCallback((text: string, action?: ToastAction) => {
    setToast({ text, action });
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => setToast(null), action ? 5000 : 1800);
  }, []);

  const say = useCallback(
    (text: string) => {
      if (!text) return;
      setLast(text);
      showToast(text);
      void speak(text, settings.rate, settings.voice);
    },
    [settings.rate, settings.voice, showToast],
  );

  const speakWord = useCallback((text: string) => { void speak(text, settings.rate, settings.voice); }, [settings.rate, settings.voice]);
  const update = useCallback((patch: Partial<Settings>) => setSettings((s) => ({ ...s, ...patch })), []);

  const addPlace = useCallback((p: Place) => {
    setCustom((c) => [...c.filter((x) => x.id !== p.id), p]);
    setSettings((s) => ({ ...s, placeId: p.id }));
  }, []);

  const addCard = useCallback((placeId: string, item: Item) => {
    setExtras((e) => ({ ...e, [placeId]: [...(e[placeId] ?? []), { ...item, added: true }] }));
  }, []);

  const setEdit = useCallback((placeId: string, index: number, item: Item | null) => {
    setCardEdits((o) => {
      const cur = { ...(o[placeId] ?? {}) };
      if (item) cur[String(index)] = item;
      else delete cur[String(index)];
      return { ...o, [placeId]: cur };
    });
  }, []);

  // 판 하나의 수정·추가 상태를 저장해 두었다가 그대로 되돌리는 함수 생성
  const undoFor = useCallback((placeId: string) => {
    const prevEdits = cardEdits[placeId];
    const prevExtras = extras[placeId];
    return () => {
      setCardEdits((o) => ({ ...o, [placeId]: prevEdits ?? {} }));
      setExtras((e) => ({ ...e, [placeId]: prevExtras ?? [] }));
    };
  }, [cardEdits, extras]);

  const removeCard = useCallback((placeId: string, index: number) => {
    const undo = undoFor(placeId);
    const n = baseCount(placeId);
    if (index >= n) {
      setExtras((e) => ({ ...e, [placeId]: (e[placeId] ?? []).filter((_, i) => i !== index - n) }));
      return undo;
    }
    const orig = places.find((p) => p.id === placeId)?.items[index];
    if (orig) setEdit(placeId, index, { ...orig, hidden: true });
    return undo;
  }, [baseCount, places, setEdit, undoFor]);

  const resetPlaceCards = useCallback((placeId: string) => {
    const undo = undoFor(placeId);
    setCardEdits((o) => {
      const { [placeId]: _removed, ...rest } = o;
      return rest;
    });
    return undo;
  }, [undoFor]);

  const runToastAction = useCallback(() => {
    toast?.action?.onPress();
    if (timer.current) clearTimeout(timer.current);
    setToast(null);
  }, [toast]);

  const updateCard = useCallback((placeId: string, index: number, item: Item) => {
    const n = baseCount(placeId);
    if (index >= n) {
      setExtras((e) => ({ ...e, [placeId]: (e[placeId] ?? []).map((x, i) => (i === index - n ? { ...item, added: true } : x)) }));
    } else {
      setEdit(placeId, index, { ...item, added: undefined, hidden: undefined, edited: true });
    }
  }, [baseCount, setEdit]);

  const restoreCard = useCallback((placeId: string, index: number) => setEdit(placeId, index, null), [setEdit]);

  const setL1Slot = useCallback((placeId: string, slot: number, item: Item | null) => {
    setL1Overrides((o) => {
      const cur = { ...(o[placeId] ?? {}) };
      if (item) cur[String(slot)] = item;
      else delete cur[String(slot)];
      return { ...o, [placeId]: cur };
    });
  }, []);

  const resetL1 = useCallback((placeId: string) => {
    setL1Overrides((o) => {
      const { [placeId]: _removed, ...rest } = o;
      return rest;
    });
  }, []);

  const l1For = useCallback(
    (p: Place, count: number) => l1Items(p, count).map((it, i) => l1Overrides[p.id]?.[String(i)] ?? it),
    [l1Overrides],
  );

  const removePlace = useCallback((id: string) => {
    setCustom((c) => c.filter((x) => x.id !== id));
    setExtras((e) => {
      const { [id]: _removed, ...rest } = e;
      return rest;
    });
    resetL1(id);
    setCardEdits((o) => {
      const { [id]: _removed, ...rest } = o;
      return rest;
    });
    setSettings((s) => (s.placeId === id ? { ...s, placeId: 'hospital' } : s));
  }, [resetL1]);

  const resetAll = useCallback(async () => {
    await clearState();
    setSettings(DEFAULT_SETTINGS);
    setCustom([]);
    setExtras({});
    setL1Overrides({});
    setCardEdits({});
    setLast('');
  }, []);

  const value: Ctx = { ready, settings, places, place, custom, last, toast, runToastAction, resetPlaceCards, update, addPlace, removePlace, addCard, removeCard, updateCard, restoreCard, baseCount, extras, setL1Slot, resetL1, l1Overrides, l1For, resetAll, say, speakWord, showToast };
  return <AppContext.Provider value={value}>{children}</AppContext.Provider>;
}

export function useApp() {
  const ctx = useContext(AppContext);
  if (!ctx) throw new Error('useApp must be used inside AppStateProvider');
  return ctx;
}
