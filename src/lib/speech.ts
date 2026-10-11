import * as Speech from 'expo-speech';
import { createAudioPlayer, setAudioModeAsync, type AudioPlayer } from 'expo-audio';
import { VOICE_CLIPS } from './voiceClips.generated';

/** 콕톡 기본 목소리(미리 녹음된 Supertonic Sarah). 기기 목소리 대신 이 값을 voice에 저장 */
export const KOKTOK_VOICE = 'koktok';
const clipKey = (t: string) => t.replace(/\s+/g, ' ').trim();
export const hasClip = (t: string) => clipKey(t) in VOICE_CLIPS;
// 한 번 불러온 음성은 플레이어째 기억해 두고 되감아 재생 (매번 파일을 새로 불러오면 첫 소리가 늦거나 빠짐)
const MAX_PLAYERS = 40;
const players = new Map<number, AudioPlayer>();
let current: AudioPlayer | null = null;

function playerFor(clip: number): AudioPlayer {
  let pl = players.get(clip);
  if (pl) {
    players.delete(clip);
    players.set(clip, pl); // 최근 사용 순서로
    return pl;
  }
  pl = createAudioPlayer(clip);
  players.set(clip, pl);
  if (players.size > MAX_PLAYERS) {
    const [oldKey, old] = players.entries().next().value as [number, AudioPlayer];
    players.delete(oldKey);
    if (old !== current) old.release();
  }
  return pl;
}

/** 불러오기가 끝날 때까지 기다림 (최대 1.5초) */
function whenLoaded(pl: AudioPlayer): Promise<void> {
  if (pl.isLoaded) return Promise.resolve();
  return new Promise((resolve) => {
    const timer = setTimeout(done, 1500);
    const sub = pl.addListener('playbackStatusUpdate', (s) => { if (s.isLoaded) done(); });
    function done() { clearTimeout(timer); sub.remove(); resolve(); }
  });
}

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
  current?.pause();
  // 기본: 미리 녹음된 콕톡 목소리. 녹음에 없는 문장(직접 입력, 여러 단어 조합 등)만 기기 목소리로 읽음
  const clip = (!voice || voice === KOKTOK_VOICE) ? VOICE_CLIPS[clipKey(text)] : undefined;
  if (clip !== undefined) {
    try {
      const pl = playerFor(clip);
      current = pl;
      await whenLoaded(pl);
      if (current !== pl) return; // 기다리는 사이 다른 버튼을 눌렀으면 이건 재생 안 함
      if (pl.currentTime > 0) await pl.seekTo(0); // 처음 재생이면 되감기 대기 없이 바로
      pl.setPlaybackRate(rate, 'high');
      pl.play();
      return;
    } catch {
      // 재생 실패 시 기기 목소리로
    }
  }
  const device = voice && voice !== KOKTOK_VOICE ? voice : await (bestVoice ??= koreanVoices().then((v) => v[0]?.id));
  Speech.speak(text, { language: 'ko-KR', rate, voice: device || undefined, useApplicationAudioSession: true });
}

/** 앱 시작 때 호출: 무음 모드 설정, 기기 목소리 확인, 자주 쓰는 음성을 미리 불러와 첫 소리 지연을 없앰 */
export function warmUpSpeech(texts: string[] = []) {
  void ensureAudio().then(() => {
    bestVoice ??= koreanVoices().then((v) => v[0]?.id);
    for (const t of texts) {
      const clip = VOICE_CLIPS[clipKey(t)];
      if (clip !== undefined) playerFor(clip);
    }
  });
}
