import { describe, expect, it } from 'vitest';
import { DEMO_EXTRACTION } from '../intake/fixture.js';
import { assumedKeys, buildProfile } from './profile.js';

describe('buildProfile defaults', () => {
  it('uses the contract payment terms and the 30-day default when the client\'s terms are not given', () => {
    expect(buildProfile({}).paymentDays).toEqual({ value: 30, source: 'default' });
    expect(buildProfile(DEMO_EXTRACTION).paymentDays).toEqual({ value: 60, source: 'you' });
  });

  it('keeps an empty decision kind empty, rather than guessing one', () => {
    expect(buildProfile({}).decisionType).toBeNull();
  });
});

describe('assumedKeys', () => {
  it('lists the business figures the founder did not give, and nothing else', () => {
    expect(assumedKeys(buildProfile(DEMO_EXTRACTION))).toEqual(['payroll']);
  });

  it('lists every business figure when nothing was given', () => {
    expect(assumedKeys(buildProfile({}))).toEqual(['revenue', 'directCosts', 'overheads', 'payroll', 'founderPay', 'debtRepayments', 'cash']);
  });
});
