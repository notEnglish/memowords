// ============================================================
// MemoWords — Web Speech API 发音封装
// ============================================================

import { ref } from 'vue';

export function usePronunciation() {
  const isSpeaking = ref(false);
  const isSupported = ref(
    typeof window !== 'undefined' && 'speechSynthesis' in window,
  );

  function pronounce(word: string, lang: string = 'en-US'): void {
    if (!isSupported.value) return;

    // 取消当前正在播放的语音
    speechSynthesis.cancel();

    const utterance = new SpeechSynthesisUtterance(word);
    utterance.lang = lang;
    utterance.rate = 0.9;
    utterance.pitch = 1.0;

    utterance.onstart = () => {
      isSpeaking.value = true;
    };
    utterance.onend = () => {
      isSpeaking.value = false;
    };
    utterance.onerror = () => {
      isSpeaking.value = false;
    };

    speechSynthesis.speak(utterance);
  }

  function stop(): void {
    speechSynthesis.cancel();
    isSpeaking.value = false;
  }

  return {
    isSpeaking,
    isSupported,
    pronounce,
    stop,
  };
}
