import { useEffect, useRef, useState } from 'react';
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

interface Props { answer: AdvisorAnswer | undefined; snapshotKey: string; month: number; demo: boolean; disabled: boolean; working: boolean }
const voiceId = (voice: SpeechSynthesisVoice) => JSON.stringify([voice.voiceURI, voice.lang, voice.name]);

/** User-initiated browser speech only; no microphone or model provider is used. */
export function DemoVoice({ answer, snapshotKey, month, demo, disabled, working }: Props) {
  const [state, setState] = useState<PlaybackState>('idle');
  const [voices, setVoices] = useState<SpeechSynthesisVoice[]>([]);
  const [voiceKey, setVoiceKey] = useState('');
  const [discovery, setDiscovery] = useState<'loading' | 'ready' | 'empty' | 'unsupported'>('loading');
  const controller = useRef<ReturnType<typeof createSpeechController> | null>(null);
  const current = answer && answer.snapshotKey === snapshotKey && answer.month === month ? answer : undefined;
  const transcript = current ? answerTranscript(current) : null;
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
  useEffect(() => { controller.current?.stop(); }, [snapshotKey, month, answer, disabled, working, demo]);

  const canPlay = demo && !disabled && !working && Boolean(transcript) && discovery !== 'unsupported';
  const status = state === 'starting' ? 'Starting voice…' : state === 'playing' ? 'Reading the answer.' : state === 'paused' ? 'Playback paused.' : state === 'finished' ? 'Playback finished.' : state === 'error' ? 'Voice unavailable. The answer remains in text above.' : '';
  return (
    <div className="demo-voice">
      <div className="demo-voice__header"><span aria-hidden="true">◖♪</span><strong>Listen to the answer</strong><span className="demo-voice__badge">Demo voice</span></div>
      <p>Uses your browser’s voice to read the text above. Voice availability and processing depend on your browser and device.</p>
      {!demo ? <p>Voice is available for the fictional demo only. Type to use the advisor.</p> : discovery === 'unsupported' ? <p>Voice is unavailable in this browser. The answer remains in text above.</p> : discovery === 'loading' ? <p>Finding available voices…</p> : discovery === 'empty' ? <p>No voices listed yet. You can try the browser’s default voice, or use the text above.</p> : null}
      {demo && discovery !== 'unsupported' && voices.length > 0 && <label className="demo-voice__choice">Voice
        <select value={voiceKey} disabled={active} onChange={(event) => setVoiceKey(event.target.value)}>
          <option value="">Browser default</option>
          {voices.map((voice) => <option key={voiceId(voice)} value={voiceId(voice)}>{voice.name} · {voice.lang}{voice.localService ? ' · device' : ''}</option>)}
        </select>
      </label>}
      {!transcript && demo && <p>Ask a question to hear its answer.</p>}
      <div className="demo-voice__controls">
        {!active ? <button className="btn demo-voice__action" type="button" disabled={!canPlay} onClick={() => { if (transcript) controller.current?.play(transcript, voices.find((voice) => voiceId(voice) === voiceKey) ?? null); }}>▶ Read answer aloud</button> : <>
          <button className="btn demo-voice__action" type="button" disabled={state === 'starting'} onClick={() => state === 'paused' ? controller.current?.resume() : controller.current?.pause()}>{state === 'paused' ? 'Resume' : 'Pause'}</button>
          <button className="btn demo-voice__stop" type="button" onClick={() => controller.current?.stop()}>Stop</button>
        </>}
      </div>
      <p className="demo-voice__note">No microphone is used. No live model is connected.</p>
      <span role="status" className="demo-voice__status">{status}</span>
    </div>
  );
}
