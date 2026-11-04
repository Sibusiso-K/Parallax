import { useEffect, useRef, useState } from 'react';
import { pickVoice, spokenText } from '../lib/speech';
import type { AdvisorAnswer } from './advisor-fixture';
import { createSpeechController, type PlaybackState } from './speech-controller';
import './demo-voice.css';

/** The same segments rendered by AnswerCard, with figures taken only from resolved claims. */
export function answerTranscript(answer: AdvisorAnswer): string | null {
  let value = '';
  for (const segment of answer.segments) {
    if (segment.kind === 'claim') {
      const claim = answer.claims[segment.index];
      if (!claim || typeof claim.text !== 'string') return null;
      value += claim.text;
    } else value += segment.text;
  }
  return value.trim() || null;
}

interface Props {
  /** The exact words on screen, or null when there is nothing to read. */
  transcript: string | null;
  /** What the words belong to. Any change stops the reading, so an old answer is never read over new figures. */
  resetKey: string;
  disabled: boolean;
  working: boolean;
  /** Reads at once when this changes to a new value: the founder has just spoken and is waiting to hear back. */
  autoPlay?: number;
  idleHint?: string;
  label?: string;
}
const voiceId = (voice: SpeechSynthesisVoice) => JSON.stringify([voice.voiceURI, voice.lang, voice.name]);

/** User-initiated browser speech: the device's own voice reads the words on screen. Nothing is sent anywhere. */
export function DemoVoice({ transcript, resetKey, disabled, working, autoPlay = 0, idleHint = 'Ask a question to hear its answer.', label = 'Read aloud' }: Props) {
  const [state, setState] = useState<PlaybackState>('idle');
  const [voices, setVoices] = useState<SpeechSynthesisVoice[]>([]);
  const [voiceKey, setVoiceKey] = useState('');
  const [discovery, setDiscovery] = useState<'loading' | 'ready' | 'empty' | 'unsupported'>('loading');
  const controller = useRef<ReturnType<typeof createSpeechController> | null>(null);
  const active = state === 'starting' || state === 'playing' || state === 'paused';

  useEffect(() => {
    if (!('speechSynthesis' in window) || typeof SpeechSynthesisUtterance === 'undefined') { setDiscovery('unsupported'); return; }
    const synth = window.speechSynthesis;
    const own = createSpeechController(synth, (text) => new SpeechSynthesisUtterance(text), setState);
    controller.current = own;
    let timer: ReturnType<typeof setTimeout> | undefined;
    const refresh = (event?: Event) => {
      try {
        const available = synth.getVoices();
        setVoices(available);
        setVoiceKey((key) => available.some((v) => voiceId(v) === key) ? key : '');
        if (available.length) { setDiscovery('ready'); if (timer) clearTimeout(timer); }
        else if (event) setDiscovery('empty');
      } catch { setVoices([]); setDiscovery('empty'); }
    };
    synth.addEventListener('voiceschanged', refresh);
    refresh();
    timer = setTimeout(() => { setDiscovery((previous) => previous === 'loading' ? 'empty' : previous); }, 2000);
    const hide = () => { if (document.hidden) own.stop(); };
    document.addEventListener('visibilitychange', hide);
    return () => { if (timer) clearTimeout(timer); synth.removeEventListener('voiceschanged', refresh); document.removeEventListener('visibilitychange', hide); own.dispose(); if (controller.current === own) controller.current = null; };
  }, []);
  useEffect(() => { controller.current?.stop(); }, [resetKey, disabled, working]);

  const play = () => {
    if (transcript) controller.current?.play(spokenText(transcript), voices.find((voice) => voiceId(voice) === voiceKey) ?? pickVoice(voices) ?? null);
  };
  // The founder asked out loud, so they hear the reply out loud, without a second press.
  const spokenTo = useRef(autoPlay);
  useEffect(() => {
    if (autoPlay === spokenTo.current || !transcript || working || disabled) return;
    spokenTo.current = autoPlay;
    play();
    // Only a new spoken question starts this; `play` reads the latest words and voice.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [autoPlay, transcript, working, disabled]);

  const canPlay = !disabled && !working && Boolean(transcript) && discovery !== 'unsupported';
  const status = state === 'starting' ? 'Starting voice…' : state === 'playing' ? 'Reading aloud.' : state === 'paused' ? 'Paused.' : state === 'finished' ? 'Finished.' : state === 'error' ? 'Voice unavailable. The words stay on screen.' : '';
  return (
    <div className="demo-voice">
      <div className="demo-voice__controls">
        {!active ? <button className="btn demo-voice__action" type="button" disabled={!canPlay} onClick={play}>▶ {label}</button> : <>
          <button className="btn demo-voice__action" type="button" disabled={state === 'starting'} onClick={() => state === 'paused' ? controller.current?.resume() : controller.current?.pause()}>{state === 'paused' ? 'Resume' : 'Pause'}</button>
          <button className="btn demo-voice__stop" type="button" onClick={() => controller.current?.stop()}>Stop</button>
        </>}
        {discovery !== 'unsupported' && voices.length > 0 && <label className="demo-voice__choice"><span className="sr-only">Voice</span>
          <select value={voiceKey} disabled={active} onChange={(event) => setVoiceKey(event.target.value)}>
            <option value="">Best voice on this device</option>
            {voices.map((voice) => <option key={voiceId(voice)} value={voiceId(voice)}>{voice.name} · {voice.lang}</option>)}
          </select>
        </label>}
      </div>
      {discovery === 'unsupported' ? <p>This browser has no voice. The words stay on screen.</p> : !transcript && <p>{idleHint}</p>}
      <p className="demo-voice__note">Your device’s own voice reads the words on screen. Nothing is sent anywhere.</p>
      <span role="status" className="demo-voice__status">{status}</span>
    </div>
  );
}
