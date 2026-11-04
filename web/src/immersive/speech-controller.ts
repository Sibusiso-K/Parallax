export type PlaybackState = 'idle' | 'starting' | 'playing' | 'paused' | 'finished' | 'error';

/** Owns one utterance. Old callbacks cannot change state after cancellation. */
export function createSpeechController(synth: SpeechSynthesis, makeUtterance: (text: string) => SpeechSynthesisUtterance, report: (state: PlaybackState) => void) {
  let generation = 0;
  let active = false;
  let state: PlaybackState = 'idle';
  let startTimer: ReturnType<typeof setTimeout> | undefined;
  const clearStartTimer = () => { if (startTimer) clearTimeout(startTimer); startTimer = undefined; };
  const set = (next: PlaybackState) => { state = next; report(next); };
  const cancel = () => { try { synth.cancel(); } catch { /* A failed browser cancellation must not keep stale state. */ } };
  const stop = () => { generation += 1; clearStartTimer(); if (active) cancel(); active = false; set('idle'); };
  return {
    play(text: string, voice: SpeechSynthesisVoice | null) {
      stop();
      if (!text.trim()) return;
      const ticket = ++generation;
      try {
        const utterance = makeUtterance(text);
        utterance.lang = voice?.lang || 'en-ZA';
        if (voice) utterance.voice = voice;
        utterance.onstart = () => { if (ticket === generation) { clearStartTimer(); set('playing'); } };
        utterance.onend = () => { if (ticket === generation) { clearStartTimer(); active = false; set('finished'); } };
        utterance.onerror = () => { if (ticket === generation) { clearStartTimer(); active = false; set('error'); } };
        active = true; set('starting');
        startTimer = setTimeout(() => { if (ticket === generation) { generation += 1; active = false; cancel(); set('error'); } }, 8000);
        synth.speak(utterance);
      } catch { if (ticket === generation) { clearStartTimer(); active = false; set('error'); } }
    },
    pause() { if (state !== 'playing' || !active) return; try { synth.pause(); set('paused'); } catch { stop(); set('error'); } },
    resume() { if (state !== 'paused' || !active) return; try { synth.resume(); set('playing'); } catch { stop(); set('error'); } },
    stop,
    /** Detach without scheduling React updates after unmount. */
    dispose() { generation += 1; clearStartTimer(); if (active) cancel(); active = false; state = 'idle'; },
  };
}
