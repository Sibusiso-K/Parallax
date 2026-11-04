import { describe, expect, it, vi } from 'vitest';
import { createSpeechController, type PlaybackState } from './speech-controller';

function setup() {
  const synth = { speak: vi.fn(), cancel: vi.fn(), pause: vi.fn(), resume: vi.fn() } as unknown as SpeechSynthesis;
  const utterances: SpeechSynthesisUtterance[] = [];
  const states: PlaybackState[] = [];
  const controller = createSpeechController(synth, (text) => { const u = { text } as SpeechSynthesisUtterance; utterances.push(u); return u; }, (s) => states.push(s));
  return { synth, utterances, states, controller };
}
describe('demo speech controller', () => {
  it('passes exact approved text and selected voice, and supports pause, resume and stop', () => {
    const { synth, utterances, states, controller } = setup();
    const voice = { lang: 'en-ZA' } as SpeechSynthesisVoice;
    controller.play('Cash is -R29,000.', voice);
    expect(utterances[0]).toMatchObject({ text: 'Cash is -R29,000.', voice, lang: 'en-ZA' });
    expect(states.at(-1)).toBe('starting');
    utterances[0]!.onstart?.({} as SpeechSynthesisEvent);
    controller.pause(); expect(synth.pause).toHaveBeenCalledOnce(); expect(states.at(-1)).toBe('paused');
    controller.resume(); expect(synth.resume).toHaveBeenCalledOnce(); expect(states.at(-1)).toBe('playing');
    controller.stop(); expect(synth.cancel).toHaveBeenCalledOnce(); expect(states.at(-1)).toBe('idle');
  });
  it('ignores callbacks from cancelled answers after another answer starts or after dispose', () => {
    const { utterances, states, controller } = setup();
    controller.play('first', null); const first = utterances[0]!;
    controller.play('second', null); const second = utterances[1]!;
    first.onend?.({} as SpeechSynthesisEvent); first.onerror?.({} as SpeechSynthesisErrorEvent);
    expect(states.at(-1)).toBe('starting');
    second.onstart?.({} as SpeechSynthesisEvent); expect(states.at(-1)).toBe('playing');
    controller.dispose(); second.onend?.({} as SpeechSynthesisEvent);
    expect(states.at(-1)).toBe('playing');
  });
  it('fails visibly on browser errors and does not pass empty text to synthesis', () => {
    const { synth, utterances, states, controller } = setup();
    controller.play(' ', null); expect(synth.speak).not.toHaveBeenCalled();
    controller.play('answer', null); utterances[0]!.onerror?.({} as SpeechSynthesisErrorEvent);
    expect(states.at(-1)).toBe('error');
  });
  it('recovers if the browser never starts the utterance', () => {
    vi.useFakeTimers();
    try {
      const { synth, utterances, states, controller } = setup();
      controller.play('answer', null);
      vi.advanceTimersByTime(8000);
      expect(states.at(-1)).toBe('error'); expect(synth.cancel).toHaveBeenCalledOnce();
      utterances[0]!.onstart?.({} as SpeechSynthesisEvent);
      expect(states.at(-1)).toBe('error');
    } finally { vi.useRealTimers(); }
  });
});
