import * as Speech from 'expo-speech';
import { createAudioPlayer, setAudioModeAsync, type AudioPlayer } from 'expo-audio';
import { VOICE_CLIPS } from './voiceClips.generated';

/** 콕톡 기본 목소리(미리 녹음된 Supertonic Sarah). 기기 목소리 대신 이 값을 voice에 저장 */
export const KOKTOK_VOICE = 'koktok';
const clipKey = (t: string) => t.replace(/\s+/g, ' ').trim();
export const hasClip = (t: string) => clipKey(t) in VOICE_CLIPS;
let player: AudioPlayer | null = null;

// AAC는 말을 대신하는 앱이라 아이폰 무음 모드에서도 소리가 나야 함
let audioReady: Promise<void> | null = null;
function ensureAudio() {
  if (!audioReady) {
    audioReady = setAudioModeAsync({ playsInSilentMode: true, interruptionMode: 'duckOthers' }).catch(() => {});
  }
  return audioReady;
}

export type KoVoice = { id: string; name: string; quality: string };

/** 기기에 있는 한국어 목소리 (고품질 먼저) */
export async function koreanVoices(): Promise<KoVoice[]> {
  const all = await Speech.getAvailableVoicesAsync().catch(() => []);
  return all
    .filter((v) => v.language?.toLowerCase().startsWith('ko'))
    // 아이폰의 장난감·외국어 기반 목소리(Eloquence, 노벨티)는 한국어 발음이 어색해서 제외
    .filter((v) => !/eloquence|speech\.synthesis|novelty/i.test(v.identifier))
    .map((v) => ({ id: v.identifier, name: v.name, quality: String(v.quality ?? '') }))
    .sort((a, b) => Number(b.quality === 'Enhanced') - Number(a.quality === 'Enhanced') || a.name.localeCompare(b.name));
}

let bestVoice: Promise<string | undefined> | null = null;

export async function speak(text: string, rate = 1, voice?: string) {
  if (!text) return;
  await ensureAudio();
  Speech.stop();
  player?.pause();
  // 기본: 미리 녹음된 콕톡 목소리. 녹음에 없는 문장(직접 입력, 여러 단어 조합 등)만 기기 목소리로 읽음
  const clip = (!voice || voice === KOKTOK_VOICE) ? VOICE_CLIPS[clipKey(text)] : undefined;
  if (clip !== undefined) {
    try {
      player ??= createAudioPlayer(null);
      player.replace(clip);
      player.setPlaybackRate(rate, 'high');
      player.play();
      return;
    } catch {
      // 재생 실패 시 기기 목소리로
    }
  }
  const device = voice && voice !== KOKTOK_VOICE ? voice : await (bestVoice ??= koreanVoices().then((v) => v[0]?.id));
  Speech.speak(text, { language: 'ko-KR', rate, voice: device || undefined, useApplicationAudioSession: true });
}
