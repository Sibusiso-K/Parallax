import { describe, expect, it } from 'vitest';
import { detectDecision, parseDecisionAnswer } from './decision.js';

describe('detectDecision', () => {
  it('finds the three founder decisions in plain words', () => {
    expect(detectDecision('Should I take the contract?')).toEqual({ value: 'contract', quote: 'contract' });
    expect(detectDecision('A corporate client wants weekly orders')).toMatchObject({ value: 'contract' });
    expect(detectDecision('We won a tender for school meals')).toMatchObject({ value: 'contract' });
    // "new client" alone is not a contract: the hire is the decision here.
    expect(detectDecision('Should we hire someone since we got a new client?')).toMatchObject({ value: 'hire' });
    expect(detectDecision('Is it time to hire a second cook?')).toMatchObject({ value: 'hire' });
    expect(detectDecision('Should I take on someone to do deliveries?')).toMatchObject({ value: 'hire' });
    expect(detectDecision('Should we raise our prices by 10%?')).toMatchObject({ value: 'pricing', quote: 'raise our prices' });
    expect(detectDecision('I want to charge more for weekend orders')).toMatchObject({ value: 'pricing' });
  });

  it('treats a hire inside a contract decision as part of the contract', () => {
    expect(detectDecision('Should I hire a cook to take the contract?')).toMatchObject({ value: 'contract' });
  });

  it('gives the matched words as the quote, exactly as written', () => {
    expect(detectDecision('Thinking about HIRING an assistant')).toEqual({ value: 'hire', quote: 'HIRING' });
  });

  it('finds nothing when the text names none of the three', () => {
    expect(detectDecision("I'm stuck")).toBeNull();
    expect(detectDecision('We signed several contracts last year')).toBeNull(); // "contracts" is not "contract"
  });
});

describe('parseDecisionAnswer', () => {
  it('reads short answers to the follow-up question', () => {
    expect(parseDecisionAnswer('contract')).toBe('contract');
    expect(parseDecisionAnswer('a big order')).toBe('contract');
    expect(parseDecisionAnswer('hire')).toBe('hire');
    expect(parseDecisionAnswer('staff')).toBe('hire');
    expect(parseDecisionAnswer('prices')).toBe('pricing');
    expect(parseDecisionAnswer('no idea')).toBeNull();
  });
});
