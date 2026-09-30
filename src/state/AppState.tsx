import React, { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import type { Item, Place, Settings } from '../types';
import { BUILTIN_PLACES, DEFAULT_SETTINGS, l1Items } from '../data';
import { clearState, loadState, saveState } from '../lib/storage';
import { speak } from '../lib/speech';

type Ctx = {
  ready: boolean;
  settings: Settings;
  places: Place[];
  place: Place;
  custom: Place[];
  last: string;
  toast: string | null;
  update: (patch: Partial<Settings>) => void;
  addPlace: (p: Place) => void;
  removePlace: (id: string) => void;
  /** 판에 카드 추가 (기본 판 포함) */
  addCard: (placeId: string, item: Item) => void;
  /** 보호자가 추가한 카드 삭제 (extras 안의 순번) */
  removeCard: (placeId: string, index: number) => void;
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
  showToast: (text: string) => void;
};

const AppContext = createContext<Ctx | null>(null);

export function AppStateProvider({ children }: { children: React.ReactNode }) {
  const [ready, setReady] = useState(false);
  const [settings, setSettings] = useState<Settings>(DEFAULT_SETTINGS);
  const [custom, setCustom] = useState<Place[]>([]);
  const [extras, setExtras] = useState<Record<string, Item[]>>({});
  const [l1Overrides, setL1Overrides] = useState<Record<string, Record<string, Item>>>({});
  const [last, setLast] = useState('');
  const [toast, setToast] = useState<string | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    loadState().then((s) => {
      if (s?.settings) setSettings({ ...DEFAULT_SETTINGS, ...s.settings });
      if (s?.custom) setCustom(s.custom);
      if (s?.extras) setExtras(s.extras);
      if (s?.l1Overrides) setL1Overrides(s.l1Overrides);
      setReady(true);
    });
  }, []);

  useEffect(() => {
    if (ready) saveState({ settings, custom, extras, l1Overrides });
  }, [ready, settings, custom, extras, l1Overrides]);

  // 기본 판/만든 판 뒤에 보호자가 추가한 카드를 붙임
  const places = useMemo(
    () => [...BUILTIN_PLACES, ...custom].map((p) => (extras[p.id]?.length ? { ...p, items: [...p.items, ...extras[p.id]] } : p)),
    [custom, extras],
  );
  const place = places.find((p) => p.id === settings.placeId) ?? places[0];

  const showToast = useCallback((text: string) => {
    setToast(text);
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => setToast(null), 1800);
  }, []);

  const say = useCallback(
    (text: string) => {
      if (!text) return;
      setLast(text);
      showToast(text);
      speak(text, settings.rate);
    },
    [settings.rate, showToast],
  );

  const speakWord = useCallback((text: string) => speak(text, settings.rate), [settings.rate]);
  const update = useCallback((patch: Partial<Settings>) => setSettings((s) => ({ ...s, ...patch })), []);

  const addPlace = useCallback((p: Place) => {
    setCustom((c) => [...c.filter((x) => x.id !== p.id), p]);
    setSettings((s) => ({ ...s, placeId: p.id }));
  }, []);

  const addCard = useCallback((placeId: string, item: Item) => {
    setExtras((e) => ({ ...e, [placeId]: [...(e[placeId] ?? []), { ...item, added: true }] }));
  }, []);

  const removeCard = useCallback((placeId: string, index: number) => {
    setExtras((e) => ({ ...e, [placeId]: (e[placeId] ?? []).filter((_, i) => i !== index) }));
  }, []);

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
    setSettings((s) => (s.placeId === id ? { ...s, placeId: 'hospital' } : s));
  }, []);

  const resetAll = useCallback(async () => {
    await clearState();
    setSettings(DEFAULT_SETTINGS);
    setCustom([]);
    setExtras({});
    setL1Overrides({});
    setLast('');
  }, []);

  const value: Ctx = { ready, settings, places, place, custom, last, toast, update, addPlace, removePlace, addCard, removeCard, extras, setL1Slot, resetL1, l1Overrides, l1For, resetAll, say, speakWord, showToast };
  return <AppContext.Provider value={value}>{children}</AppContext.Provider>;
}

export function useApp() {
  const ctx = useContext(AppContext);
  if (!ctx) throw new Error('useApp must be used inside AppStateProvider');
  return ctx;
}
