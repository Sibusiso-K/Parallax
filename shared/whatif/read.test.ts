import { describe, expect, it } from 'vitest';
import { readInCode, toResult } from './read.js';

const read = (t: string) => toResult(readInCode(t));

describe('reading a what-if in code', () => {
  it('reads a late payment and a price rise together', () => {
    expect(read('What if they pay late and I put prices up 10%?').changes).toEqual({ latePayment: true, pricePercent: 10 });
  });

  it('reads a price cut as negative', () => {
    expect(read('what if I cut prices by 5 percent').changes).toEqual({ pricePercent: -5 });
  });

  it('reads the contract at half size, in words or as a percent', () => {
    expect(read('what if the contract is half the size').changes).toEqual({ contractScale: 0.5 });
    expect(read('what if the contract is 75% of the offer').changes).toEqual({ contractScale: 0.75 });
  });

  it('reads a client paying on time as the lever off', () => {
    expect(read('what if the client pays on time?').changes).toEqual({ latePayment: false });
  });

  it('keeps values on the sliders, and says when one was out of range', () => {
    const r = read('what if prices go up 50%');
    expect(r.changes.pricePercent).toBe(20);
    expect(r.clamped).toBe(true);
    expect(read('what if the contract is doubled').changes.contractScale).toBe(1.5);
  });

  it('says when the what-if is something the levers cannot show', () => {
    const r = read('what if I hire a second chef?');
    expect(r.outOfScope).toBe(true);
    expect(r.changes).toEqual({});
  });

  it('changes nothing it was not asked about', () => {
    expect(read('hello there').changes).toEqual({});
  });
});

describe('model replies become slider positions', () => {
  it('snaps to the nearest step and leaves unnamed levers alone', () => {
    expect(toResult({ latePayment: null, contractPercent: 60, pricePercent: 7, outOfScope: false }).changes).toEqual({ contractScale: 0.5, pricePercent: 5 });
  });
});
