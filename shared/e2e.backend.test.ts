import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { POST } from '../api/intake.js';
import { CASES, SETBACK_IDS, figureTable } from './engine/analysis.js';
import { simulate, validateAssumption, type Simulation } from './engine/simulate.js';
import { guardText } from './guard/figures.js';
import { intakeResponseSchema } from './intake/contract.js';
import { DEMO_TEXT } from './intake/fixture.js';
import { decisionTypes, type DecisionType, type Extraction, type FieldKey } from './intake/schema.js';
import { templatePaths } from './paths/templates.js';
import { assumedKeys, buildProfile, type MoneyKey } from './profile/profile.js';
import { isMoneyField, parseAmount } from '../web/src/lib/format';
import { exploreSession } from '../web/src/immersive/session-adapter';
import { FIELD_DEFAULTS, MONEY_FIELDS, NUMBER_FIELDS, mockApi, toExtraction, toScreenFields } from '../web/src/lib/parallax-api';
import { pathFigures } from '../web/src/lib/stress';
import type { PathCard, Profile } from '../web/src/lib/types';

// The whole backend chain, driven the way the screens drive it: the founder's text goes to POST /api/intake, the
// answer is mapped to screen fields by the same function the screens use, the follow-up questions are answered with a
// mix of typed figures and "I don't know" defaults, and the profile becomes three path cards and 36 months of cash.
// Every invariant the engine promises is checked at every stage.

const MODEL_VARS = ['META_MODEL_ENABLED', 'META_API_KEY', 'META_API_BASE_URL'] as const;
beforeEach(() => {
  for (const k of MODEL_VARS) delete process.env[k];
});
afterEach(() => {
  for (const k of MODEL_VARS) delete process.env[k];
  vi.unstubAllGlobals();
});

interface Story {
  name: string;
  text: string;
  /** The kind of decision the founder taps when their words do not name one. */
  buttons?: DecisionType;
  /** Answers typed into the follow-up box, as the founder would type them. */
  typed?: Partial<Record<FieldKey, string>>;
  /** Fields the founder leaves to the "I don't know" defaults. */
  defaults?: FieldKey[];
  /** Template fields a model would have read from the story (the fixture cannot), applied like a field edit. */
  template?: Partial<Record<FieldKey, string>>;
}

const TODAY: MoneyKey[] = ['revenue', 'directCosts', 'overheads', 'payroll', 'founderPay', 'debtRepayments', 'cash'];

/** The screens' readValue (FieldGrid.tsx), so a typed answer goes through the same parser the UI uses. */
function answer(key: FieldKey, raw: string): unknown {
  if (MONEY_FIELDS.includes(key)) {
    const p = parseAmount(raw);
    if (!p) throw new Error(`${key}: cannot read "${raw}"`);
    return { ...p, quote: raw.trim() };
  }
  if (NUMBER_FIELDS.includes(key)) {
    const n = Number(raw.trim().replace(/\s*(days?|%)$/i, ''));
    if (!Number.isFinite(n) || n < 0) throw new Error(`${key}: cannot read "${raw}"`);
    return n;
  }
  return raw.trim();
}

function expectSimulation(startingCash: number, sim: Simulation, label: string) {
  for (const c of CASES) {
    expect(sim[c].rows, label).toHaveLength(36);
    expect(sim[c].rows.map((r) => r.month)).toEqual(Array.from({ length: 36 }, (_, i) => i + 1));
    let cash = startingCash;
    for (const row of sim[c].rows) {
      for (const v of [row.income, row.costs, row.net, row.cash]) expect(Number.isFinite(v), `${label} ${c} ${row.month}`).toBe(true);
      cash += row.net;
      expect(row.net).toBe(row.income - row.costs);
      expect(row.cash).toBe(cash);
    }
    expect(sim[c].shortfallMonths).toEqual(sim[c].rows.filter((r) => r.cash < 0).map((r) => r.month));
  }
  sim.bad.rows.forEach((row, i) => {
    expect(row.cash).toBeLessThanOrEqual(sim.likely.rows[i]!.cash);
    expect(sim.likely.rows[i]!.cash).toBeLessThanOrEqual(sim.good.rows[i]!.cash);
  });
}

/** A path card as the path, chart, compare and Explore screens read it. */
function expectCardSane(card: PathCard, label: string) {
  expect(card.id, label).toBe(card.letter);
  expect(card.name.length, label).toBeGreaterThan(0);
  expect(card.summary.length, label).toBeGreaterThan(0);
  expect(Number.isFinite(card.startingCash), label).toBe(true);
  expect(card.avatarUrl, label).toBe(`/avatars/${card.letter}.png`);
  expect(card.assumptions.length, label).toBeGreaterThan(0);
  const ids = card.assumptions.map((a) => a.id);
  expect(new Set(ids).size, label).toBe(ids.length);
  for (const a of card.assumptions) {
    expect(a.id, label).toMatch(new RegExp(`^${card.letter}\\d+$`));
    expect(a.label.length, label).toBeGreaterThan(0);
    expect(['you', 'default', 'template'], `${label} ${a.id}`).toContain(a.source);
    expect(validateAssumption(a), `${label} ${a.id}`).toBeNull();
  }

  const sim = simulate(card);
  expectSimulation(card.startingCash, sim, `${label} ${card.letter}`);
  expect(simulate(card), `${label} ${card.letter}`).toEqual(sim); // deterministic

  // The shapes web/src/lib/stress.ts and charts.tsx read: index 0 is today, month 36 is the last point.
  const figures = pathFigures(card);
  for (const series of [figures.bad, figures.likely, figures.good]) {
    expect(series, `${label} ${card.letter}`).toHaveLength(37);
    expect(series.every(Number.isFinite)).toBe(true);
  }
  expect(figures.bad[0]).toBe(card.startingCash);
  expect(figures.likely[0]).toBe(card.startingCash);
  expect(figures.good[0]).toBe(card.startingCash);
  expect(figures.likely.at(-1)).toBe(sim.likely.rows.at(-1)!.cash);
  expect(figures.setbacks.map((s) => s.id)).toEqual([...SETBACK_IDS]);
  for (const s of [...figures.setbacks, figures.late, figures.worst]) {
    expect(s.name.length, `${label} ${s.id}`).toBeGreaterThan(0);
    expect(s.detail.length, `${label} ${s.id}`).toBeGreaterThan(0);
    expect(Number.isFinite(s.lowest.cash), `${label} ${s.id}`).toBe(true);
    expect(s.lowest.month).toBeGreaterThanOrEqual(1);
    expect(s.lowest.month).toBeLessThanOrEqual(36);
    expect(Number.isFinite(s.month36), `${label} ${s.id}`).toBe(true);
    expect(s.line, `${label} ${s.id}`).toHaveLength(37);
    expect(s.line[0]).toBe(card.startingCash);
  }

  // The figure table the figure guard may quote, and a guard run over a month key and a rand key.
  const table = figureTable(card);
  for (const [key, value] of Object.entries(table)) expect(Number.isFinite(value), `${label} ${key}`).toBe(true);
  const guarded = guardText(
    `Cash ends at {{fig:${card.letter}.cash.m36.likely}}; the late payment comes back in {{fig:${card.letter}.setback.late-payment.paidFromMonth}}; a made-up figure is R9,999,999.`,
    { pathId: card.letter, table, allowedIds: card.assumptions.map((a) => a.id) },
  );
  expect(guarded.text).not.toMatch(/\{\{|R9,999,999/);
  expect(guarded.text).not.toMatch(/R\s?9,999,999/);
}

async function runStory(story: Story) {
  const res = await POST(
    new Request('http://localhost/api/intake', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ text: story.text }) }),
  );
  expect(res.status, story.name).toBe(200);
  expect(res.headers.get('cache-control'), story.name).toBe('no-store');
  const data = intakeResponseSchema.parse(await res.json());
  if (!data.ok) throw new Error(`${story.name}: the intake refused a valid story`);
  expect(['model', 'fixture'], story.name).toContain(data.mode);

  // The screens' mapping: plain values for text fields, ranges kept whole, quotes kept beside them.
  const screen = toScreenFields(data.fields);
  const fields: Partial<Record<FieldKey, unknown>> = { ...screen.fields };
  const quotes: Partial<Record<FieldKey, string>> = { ...screen.quotes };
  const assumed: FieldKey[] = [];
  const followed: FieldKey[] = [];
  const missing = (data.missing as FieldKey[]).filter((k) => k !== 'decision'); // the screens do not ask for "decision"

  for (const key of [...missing]) {
    if (key === 'decisionType' && story.buttons) {
      fields.decisionType = story.buttons;
      missing.splice(missing.indexOf(key), 1);
      continue;
    }
    const raw = story.typed?.[key];
    if (raw !== undefined) {
      fields[key] = answer(key, raw);
      quotes[key] = raw.trim();
      followed.push(key);
      missing.splice(missing.indexOf(key), 1);
      continue;
    }
    if (key in FIELD_DEFAULTS) {
      fields[key] = FIELD_DEFAULTS[key];
      assumed.push(key);
      missing.splice(missing.indexOf(key), 1);
      continue;
    }
    throw new Error(`${story.name}: the screen has no way to answer "${key}"`);
  }
  // "This is right" is only enabled once every follow-up is answered.
  expect(missing, story.name).toEqual([]);

  // Template fields a model would have read, and typed answers for fields the follow-ups do not ask for.
  for (const [key, raw] of [...Object.entries(story.template ?? {}), ...Object.entries(story.typed ?? {})] as [FieldKey, string][]) {
    if (fields[key] !== undefined) continue;
    fields[key] = answer(key, raw);
    quotes[key] = raw.trim();
  }

  // Every screen value is a shape FieldGrid can render.
  for (const key of MONEY_FIELDS) {
    const v = fields[key];
    if (v === undefined) continue;
    expect(isMoneyField(v), `${story.name} ${key}`).toBe(true);
    if (!isMoneyField(v)) continue;
    expect(Number.isFinite(v.low) && Number.isFinite(v.high), `${story.name} ${key}`).toBe(true);
    expect(v.low, `${story.name} ${key}`).toBeLessThanOrEqual(v.high);
    if (v.base !== undefined) {
      expect(v.base).toBeGreaterThanOrEqual(v.low);
      expect(v.base).toBeLessThanOrEqual(v.high);
    }
  }
  for (const key of NUMBER_FIELDS) {
    const v = fields[key];
    if (v === undefined) continue;
    expect(typeof v, `${story.name} ${key}`).toBe('number');
    expect(Number.isFinite(v as number)).toBe(true);
  }
  expect(decisionTypes, story.name).toContain(fields.decisionType);

  // The profile the paths are built from: every figure finite, ordered, and marked as the founder's or a default.
  const profile: Profile = { fields, assumed };
  const extraction = toExtraction(profile);
  expect(toExtraction(profile), story.name).toEqual(extraction); // deterministic mapping
  const built = buildProfile(extraction);
  expect(built.decisionType, story.name).not.toBeNull();
  expect(decisionTypes, story.name).toContain(built.decisionType);
  for (const key of Object.keys(built.money) as MoneyKey[]) {
    const f = built.money[key];
    expect(Number.isFinite(f.low) && Number.isFinite(f.base) && Number.isFinite(f.high), `${story.name} ${key}`).toBe(true);
    expect(f.low, `${story.name} ${key}`).toBeLessThanOrEqual(f.base);
    expect(f.base, `${story.name} ${key}`).toBeLessThanOrEqual(f.high);
    // The usual figure sits inside the founder's own range: the base can never fall outside the ends they gave.
    if (fields[key] !== undefined && isMoneyField(fields[key])) {
      const own = fields[key] as { low: number; high: number };
      expect(f.base, `${story.name} ${key}`).toBeGreaterThanOrEqual(own.low);
      expect(f.base, `${story.name} ${key}`).toBeLessThanOrEqual(own.high);
    }
    expect(['you', 'default'], `${story.name} ${key}`).toContain(f.source);
  }
  expect(Number.isFinite(built.paymentDays.value), story.name).toBe(true);
  expect(Number.isFinite(built.priceRisePercent.value), story.name).toBe(true);
  expect(assumedKeys(built).sort(), story.name).toEqual(assumed.filter((k) => TODAY.includes(k as MoneyKey)).sort());

  // The paths the UI actually receives (avatar included), and the engine beneath them.
  const builtCards = templatePaths(built);
  const cards = await mockApi.paths(profile);
  expect(cards, story.name).toEqual(builtCards.map((c) => ({ ...c, avatarUrl: `/avatars/${c.letter}.png` })));
  expect(cards.map((c) => c.letter), story.name).toEqual(['A', 'B', 'C']);
  for (const card of cards) expectCardSane(card, story.name);

  // Explore opens from the same cards, and its baseline is the same simulation the regular screens show.
  const b = cards.find((c) => c.letter === 'B')!;
  const session = exploreSession({
    kind: 'confirmed',
    sessionId: `decision-${story.name}`,
    revision: 1,
    title: String(fields.decision ?? story.name),
    paths: cards,
    selectedPath: 'B',
  });
  expect(session.ok, story.name).toBe(true);
  if (session.ok) {
    expect(session.session.paths.B.path, story.name).toBe(b);
    expect(session.session.snapshotFor('B', false).baseline.rows, story.name).toEqual(simulate(b).likely.rows);
    expect(session.session.snapshotFor('B', false).baseline.lowest, story.name).toEqual({ cash: pathFigures(b).lowestLikely.cash, month: pathFigures(b).lowestLikely.month });
    expect(session.session.snapshotFor('B', true).active.firstShortfall, story.name).toBe(pathFigures(b).late.runsOut);
  }

  // Same text, same answer: the chain is deterministic.
  const again = intakeResponseSchema.parse(
    await (
      await POST(
        new Request('http://localhost/api/intake', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ text: story.text }) }),
      )
    ).json(),
  );
  if (!again.ok) throw new Error(`${story.name}: the second intake refused`);
  expect(again.fields, story.name).toEqual(data.fields);

  return { fields, quotes, cards, built };
}

const STORIES: Story[] = [
  {
    name: 'demo',
    text: DEMO_TEXT,
    defaults: ['payroll'],
  },
  {
    name: 'contract-all-typed',
    text:
      'We run a plumbing business in Durban. We sell about R120,000 a month, usually around R100,000. Materials cost R45,000. ' +
      'Rent is R18,000, wages R35,000, I pay myself R15,000 and the van loan is R4,000. There is R80,000 in the bank. ' +
      'A builder has offered a 12-month contract worth R50,000 a month, paid 45 days after invoice. We would need another ' +
      'plumber at R12,000 and a machine for R30,000. Should we take the contract?',
    typed: {
      business: 'Plumbing',
      revenue: '100000 to 120000',
      directCosts: '45000',
      overheads: '18000',
      payroll: '35000',
      founderPay: '15000',
      debtRepayments: '4000',
      cash: '80000',
      riskComfort: 'medium',
      goals: 'growth, profit',
      offerRevenue: '50000',
      paymentDays: '45',
      hireCost: '12000',
      upfrontCost: '30000',
    },
  },
  {
    name: 'hire-with-defaults',
    text: 'I run a bakery in Soweto. Should I hire a baker for the morning shift?',
    buttons: undefined,
    typed: { business: 'Bakery', revenue: '60k to 80k', directCosts: '20k', overheads: '9k', founderPay: '8k' },
    defaults: ['payroll', 'debtRepayments', 'cash', 'riskComfort', 'goals'],
    template: { hireCost: '9500' },
  },
  {
    name: 'pricing-zero-cash',
    text: 'Our coffee shop is quiet. Should I raise my prices by 5%?',
    typed: {
      business: 'Coffee shop',
      revenue: '120000',
      directCosts: '45000',
      overheads: '25000',
      payroll: '30000',
      founderPay: '12000',
      debtRepayments: '0',
      cash: '0',
      riskComfort: 'low',
      goals: 'profit',
    },
  },
  {
    name: 'messy-no-decision-words',
    text: 'We are a small catering outfit. What should we do?',
    buttons: 'contract',
    typed: {
      business: 'Catering',
      revenue: '0',
      directCosts: '0',
      overheads: '5000',
      payroll: '0',
      founderPay: '0',
      debtRepayments: '0',
      cash: '0',
    },
    defaults: ['riskComfort', 'goals'],
  },
  {
    name: 'messy-costs-above-sales',
    text: 'We run a laundry. Honestly I am not sure what to do next.',
    buttons: 'hire',
    typed: {
      business: 'Laundry',
      revenue: '5k to 10k',
      directCosts: '12k',
      overheads: '4k',
      payroll: '3k',
      founderPay: '2k',
      debtRepayments: '0',
      cash: '0',
    },
    defaults: ['riskComfort', 'goals'],
  },
  {
    name: 'huge-figures',
    text: 'We are a mining contractor. A client has offered us a contract worth a billion rand a year. Should we take the contract?',
    typed: {
      business: 'Mining contractor',
      revenue: '1000000000',
      directCosts: '400000000',
      overheads: '50000000',
      payroll: '100000000',
      founderPay: '1000000',
      debtRepayments: '0',
      cash: '1000000000',
    },
    defaults: ['riskComfort', 'goals'],
  },
];

describe('the backend chain the UI drives', () => {
  for (const story of STORIES) {
    it(`carries "${story.name}" from text to three 36-month paths`, async () => {
      const { cards } = await runStory(story);
      expect(cards).toHaveLength(3);
    });
  }
});

describe('the model-mode chain', () => {
  const KEY = 'test-key-not-real';

  it('maps a full model extraction to screen fields, and builds the paths with no follow-ups', async () => {
    process.env.META_MODEL_ENABLED = 'true';
    process.env.META_API_KEY = KEY;
    const extracted: Extraction = {
      decision: { value: 'Raise our prices by 8%', quote: 'raise our prices' },
      decisionType: { value: 'pricing', quote: 'raise our prices' },
      business: { value: 'Coffee shop', quote: 'coffee shop' },
      revenue: { low: 100_000, high: 120_000, base: 110_000, quote: 'R100 000 to R120 000' },
      directCosts: { low: 40_000, high: 45_000, quote: 'R40 000 to R45 000' },
      overheads: { low: 25_000, high: 25_000, quote: 'R25 000' },
      payroll: { low: 30_000, high: 30_000, quote: 'R30 000' },
      founderPay: { low: 12_000, high: 12_000, quote: 'R12 000' },
      debtRepayments: { low: 0, high: 0, quote: 'R0' },
      cash: { low: 90_000, high: 90_000, quote: 'R90 000' },
      riskComfort: { value: 'medium', quote: 'medium' },
      goals: { value: ['profit'], quote: 'profit' },
      priceRisePercent: { value: 8, quote: '8%' },
    };
    vi.stubGlobal('fetch', async () =>
      new Response(JSON.stringify({ choices: [{ message: { content: JSON.stringify(extracted) } }] }), { status: 200 }),
    );
    const story: Story = {
      name: 'model-pricing',
      text:
        'We run a coffee shop. Sales are R100 000 to R120 000 a month. Beans and milk cost R40 000 to R45 000. Rent is R25 000, ' +
        'staff R30 000, and I pay myself R12 000. We repay R0 on debt and have R90 000 in the bank. I am medium on risk; profit ' +
        'matters most. Should we raise our prices by 8%?',
    };
    const { fields, built } = await runStory(story);
    expect(fields.revenue).toEqual({ low: 100_000, high: 120_000, base: 110_000, quote: 'R100 000 to R120 000' });
    expect(fields.goals).toBe('profit');
    expect(fields.priceRisePercent).toBe(8);
    expect(built.decisionType).toBe('pricing');
    expect(built.priceRisePercent).toEqual({ value: 8, source: 'you' });
  });

  it('answers in fixture mode with a notice when the model call fails, and still builds paths from the answers', async () => {
    process.env.META_MODEL_ENABLED = 'true';
    process.env.META_API_KEY = KEY;
    vi.stubGlobal('fetch', async () => new Response('{}', { status: 402 }));
    const story: Story = {
      name: 'model-failed',
      text: 'Our hardware shop needs a decision. Should we take a contract with a builder?',
      buttons: 'contract',
      typed: { business: 'Hardware', revenue: '90k', directCosts: '30k', overheads: '15k', payroll: '20k', founderPay: '10k', debtRepayments: '0', cash: '40k' },
      defaults: ['riskComfort', 'goals'],
    };
    const { fields, cards } = await runStory(story);
    expect(fields.business).toBe('Hardware');
    expect(cards).toHaveLength(3);
  });
});
