import React from 'react';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { AppStateProvider } from './src/state/AppState';
import { Root } from './src/Root';

export default function App() {
  return (
    <SafeAreaProvider>
      <AppStateProvider>
        <Root />
      </AppStateProvider>
    </SafeAreaProvider>
  );
}
