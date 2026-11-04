import { describe, expect, it } from 'vitest';
import { answerTranscript } from './DemoVoice';
import type { AdvisorAnswer } from './advisor-fixture';

describe('demo voice transcript', () => {
  it('reads the displayed claim and code segments in order without replacing values', () => {
    const a = { segments: [{ kind: 'text', text: 'Cash is ' }, { kind: 'claim', index: 0 }, { kind: 'code', text: ' under this scenario.' }], claims: [{ text: '-R29,000' }] } as AdvisorAnswer;
    expect(answerTranscript(a)).toBe('Cash is -R29,000 under this scenario.');
  });
  it('fails closed if a displayed claim is absent', () => {
    const a = { segments: [{ kind: 'claim', index: 1 }], claims: [] } as unknown as AdvisorAnswer;
    expect(answerTranscript(a)).toBeNull();
  });
});
