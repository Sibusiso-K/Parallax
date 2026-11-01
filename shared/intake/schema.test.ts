import { describe, expect, it } from 'vitest';
import za from '../defaults/za.json' with { type: 'json' };
import { DEMO_EXTRACTION } from './fixture.js';
import { decisionLabels, decisionTypes, extraction, fieldLabels, followUps, goalOptions, intakeRequest, moneyField, moneyKeys, numberKeys, requiredFields, riskLevels } from './schema.js';

// The shape of what the intake accepts, and the tables that describe each field must agree with one another.
describe('the intake schema', () => {
  it('accepts the demo founder extraction', () => {
    expect(extraction.safeParse(DEMO_EXTRACTION).success).toBe(true);
  });

  it('refuses negative money, unknown decision kinds and more than three goals', () => {
    expect(extraction.safeParse({ revenue: { low: -1, high: 5, quote: 'x' } }).success).toBe(false);
    expect(extraction.safeParse({ decisionType: { value: 'merger', quote: 'x' } }).success).toBe(false);
    expect(extraction.safeParse({ goals: { value: ['cash safety', 'growth', 'profit', 'control'], quote: 'x' } }).success).toBe(false);
  });

  it('refuses a field with no quote, since the quote is how code checks it against the text', () => {
    expect(extraction.safeParse({ revenue: { low: 5, high: 5, quote: '' } }).success).toBe(false);
  });

  it('tells the person in plain words when the request is empty', () => {
    const r = intakeRequest.safeParse({ text: '   ' });
    expect(r.success).toBe(false);
    if (!r.success) expect(r.error.issues[0]?.message).toBe('Tell us about your decision first');
  });

  it('caps the request at 4,000 characters', () => {
    expect(intakeRequest.safeParse({ text: 'x'.repeat(4000) }).success).toBe(true);
    expect(intakeRequest.safeParse({ text: 'x'.repeat(4001) }).success).toBe(false);
  });
});

describe('the intake tables agree with each other', () => {
  it('gives every required field a label and a follow-up question', () => {
    for (const k of requiredFields) {
      expect(fieldLabels[k], k).toBeTruthy();
      expect(followUps[k], k).toBeTruthy();
    }
  });

  it('gives every money field a spending cap in za.json, and keeps the number fields out of the money list', () => {
    for (const k of moneyKeys) expect(za.caps, k).toHaveProperty(k);
    for (const k of numberKeys) expect(moneyKeys as readonly string[]).not.toContain(k);
  });

  it('labels every decision kind, and only those', () => {
    expect(Object.keys(decisionLabels).sort()).toEqual([...decisionTypes].sort());
  });

  it('lists the risk levels and goal options the docs name', () => {
    expect(riskLevels).toEqual(['low', 'medium', 'high']);
    expect(goalOptions).toEqual(['cash safety', 'growth', 'profit', 'control', 'time']);
  });

  it('gives a money figure both ends and a quote, and refuses a negative end', () => {
    expect(moneyField.safeParse({ low: 5, high: 9, quote: 'x' }).success).toBe(true);
    expect(moneyField.safeParse({ low: -5, high: 9, quote: 'x' }).success).toBe(false);
    expect(moneyField.safeParse({ low: 5, high: 9 }).success).toBe(false);
  });
});
