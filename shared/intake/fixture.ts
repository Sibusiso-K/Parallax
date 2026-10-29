import type { Extraction } from './schema';

// Fixture mode (FEATURES.md F20): used while there is no Meta key, and as the fallback
// when the model fails. Naledi Mokoena is the fictional demo persona (DEMO.md §1).

export const NALEDI_TEXT =
  "I'm 27 and live in Soweto, Gauteng. I'm a payroll administrator and take home R19,500 a month. " +
  'On weekends I run a catering business that makes about R6,000 profit a month, anywhere from 2.5k to 11k. ' +
  "I've been offered a big catering contract and I'm thinking of quitting my job to cater full-time. " +
  'I send my mother R3,000 every month and that is non-negotiable. I have between R30,000 and R40,000 saved ' +
  "and I pay R800 a month on a store account. I don't like big risks. What matters most is security and family time.";

export const NALEDI_EXTRACTION: Extraction = {
  decision: {
    value: 'Quit my payroll job to run my catering business full-time',
    quote: "thinking of quitting my job to cater full-time",
  },
  ageBand: { value: '25-34', quote: "I'm 27" },
  province: { value: 'Gauteng', quote: 'Soweto, Gauteng' },
  takeHome: { low: 19500, high: 19500, quote: 'take home R19,500 a month' },
  familySupportMonthly: { low: 3000, high: 3000, quote: 'I send my mother R3,000 every month' },
  debtRepayments: { low: 800, high: 800, quote: 'R800 a month on a store account' },
  savings: { low: 30000, high: 40000, quote: 'between R30,000 and R40,000 saved' },
  riskComfort: { value: 'low', quote: "I don't like big risks" },
  goals: { value: ['security', 'family time'], quote: 'security and family time' },
  // essentialExpenses is left out on purpose: Parallax asks for it as a follow-up.
};

// Without a model, only the demo text is understood; anything else comes back empty,
// and the person fills the form by hand (F2: "an empty form keeps the text").
export function fixtureExtract(text: string): Extraction {
  return text.trim() === NALEDI_TEXT ? NALEDI_EXTRACTION : {};
}
