import { describe, expect, it } from 'vitest';
import { DEMO_EXTRACTION, DEMO_TEXT, fixtureExtract } from './fixture.js';
import { requiredFields } from './schema.js';
import { missingFields } from './verify.js';

// Fixture mode answers only the demo story, so the offline demo and the tests always see the same founder.
describe('fixture mode', () => {
  it('answers only the demo story, and only with the founder extraction', () => {
    expect(fixtureExtract(DEMO_TEXT)).toBe(DEMO_EXTRACTION);
    expect(fixtureExtract(`  ${DEMO_TEXT}  `)).toBe(DEMO_EXTRACTION);
    expect(fixtureExtract('I run a bakery and want to hire.')).toEqual({});
  });

  it('leaves the decision kind to code and the wages to a follow-up', () => {
    expect(missingFields(DEMO_EXTRACTION)).toEqual(['decisionType', 'payroll']);
  });
});

describe('missingFields', () => {
  it('lists every required field when nothing is known', () => {
    expect(missingFields({})).toEqual(requiredFields);
  });
});
