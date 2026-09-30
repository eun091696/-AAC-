import React, { useState } from 'react';
import { ActivityIndicator, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import type { Opt } from './types';
import { DEFAULT_SHOW_TEXT } from './data';
import { useApp } from './state/AppState';
import { HomeScreen } from './screens/HomeScreen';
import { ShowScreen } from './screens/ShowScreen';
import { GuardianScreen } from './screens/GuardianScreen';
import { AskSheet, AskState } from './components/AskSheet';
import { PinModal } from './components/PinModal';
import { AddCardModal } from './components/AddCardModal';
import { Toast } from './components/Toast';

type Screen = 'home' | 'show' | 'guardian';

export function Root() {
  const { ready, say, toast } = useApp();
  const [screen, setScreen] = useState<Screen>('home');
  const [showText, setShowText] = useState('');
  const [ask, setAsk] = useState<AskState | null>(null);
  // PIN 확인 후 열 화면: 보호자 모드 또는 카드 추가
  const [pinFor, setPinFor] = useState<'guardian' | 'addCard' | null>(null);
  const [addCardOpen, setAddCardOpen] = useState(false);

  if (!ready) {
    return (
      <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
        <ActivityIndicator />
      </View>
    );
  }

  const openAsk = (q: string, opts: Opt[], fromShow: boolean) => setAsk({ q, opts, fromShow });

  const pick = (o: Opt) => {
    const fromShow = ask?.fromShow;
    setAsk(null);
    say(o.s);
    if (fromShow) setShowText(o.s);
  };

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: screen === 'show' ? '#111' : '#fff' }} edges={['top', 'bottom']}>
      <StatusBar style={screen === 'show' ? 'light' : 'dark'} />
      {screen === 'home' && (
        <HomeScreen
          onShow={(t) => {
            setShowText(t || DEFAULT_SHOW_TEXT);
            setScreen('show');
          }}
          onGuardian={() => setPinFor('guardian')}
          onAddCard={() => setPinFor('addCard')}
          onAsk={openAsk}
        />
      )}
      {screen === 'show' && <ShowScreen text={showText} onAsk={openAsk} onClose={() => setScreen('home')} />}
      {screen === 'guardian' && <GuardianScreen onClose={() => setScreen('home')} />}

      <AskSheet state={ask} onPick={pick} onClose={() => setAsk(null)} />
      <PinModal
        visible={pinFor !== null}
        onCancel={() => setPinFor(null)}
        onSuccess={() => {
          if (pinFor === 'guardian') setScreen('guardian');
          // iOS는 모달이 닫히는 중에 새 모달을 열면 무시될 수 있어 잠깐 기다림
          else setTimeout(() => setAddCardOpen(true), 400);
          setPinFor(null);
        }}
      />
      <AddCardModal visible={addCardOpen} onClose={() => setAddCardOpen(false)} />
      <Toast text={toast} />
    </SafeAreaView>
  );
}
