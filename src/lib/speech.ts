import * as Speech from 'expo-speech';

export function speak(text: string, rate = 1) {
  if (!text) return;
  Speech.stop();
  Speech.speak(text, { language: 'ko-KR', rate });
}
