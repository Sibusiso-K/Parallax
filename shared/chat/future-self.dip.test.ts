import { describe, expect, it } from 'vitest';
import { figureTable } from '../engine/analysis.js';
import { buildPrompt, chatRequest } from './future-self.js';
import { DEMO_EXTRACTION } from '../intake/fixture.js';
import { templatePaths } from '../paths/templates.js';
import { buildProfile } from '../profile/profile.js';

const paths = templatePaths(buildProfile({ ...DEMO_EXTRACTION, payroll: { low: 21000, high: 21000, quote: '21k' } }));
const prompt = (i: number) => {
  const p = paths[i]!;
  const req = chatRequest.parse({ path: { id: p.id, letter: p.letter, name: p.name, summary: p.summary, startingCash: p.startingCash, assumptions: p.assumptions }, message: 'When was cash tightest?' });
  return buildPrompt(req, figureTable(p)).system;
};

describe('the lowest-cash figure in the future-self prompt', () => {
  it('tells the model when cash never fell below the start (path A, likely case)', () => {
    expect(prompt(0)).toMatch(/lowest cash over the 36 months, likely case \(cash never fell below where it started/);
  });

  it('says nothing extra when cash did dip (path B)', () => {
    expect(prompt(1)).not.toMatch(/\{\{fig:B\.lowest\.likely\}\}[^\n]*never fell below/);
  });
});
