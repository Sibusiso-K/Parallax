import type { Extraction } from './schema.js';

// Fixture mode (FEATURES.md F20): used while there is no Meta key, and as the fallback when the model fails.
// The demo founder is fictional (DEMO.md §1): a meal-prep and catering business in Johannesburg weighing a big contract.

export const DEMO_TEXT =
  'I run a meal-prep and catering business in Johannesburg with three staff. ' +
  'We sell about R90,000 a month, anywhere from R75k to R105k. Ingredients and packaging cost R36,000 a month. ' +
  'Rent, power, fuel and software come to R16,000, and I pay myself R12,000. ' +
  'We repay R3,500 a month on the delivery van, and there is R120,000 in the business account. ' +
  'A corporate client has offered us a 12-month contract for staff lunches worth R60,000 a month, ' +
  'but they pay 60 days after each invoice. I would need another cook at R8,500 a month and a second fridge for R25,000. ' +
  "Should I take the contract? I'm careful with risk. What matters most is cash safety and growth.";

export const DEMO_EXTRACTION: Extraction = {
  decision: { value: 'Take on a 12-month corporate lunch contract', quote: 'Should I take the contract?' },
  business: { value: 'Meal-prep and catering', quote: 'meal-prep and catering business' },
  location: { value: 'Johannesburg', quote: 'Johannesburg' },
  revenue: { low: 75000, base: 90000, high: 105000, quote: 'about R90,000 a month, anywhere from R75k to R105k' },
  directCosts: { low: 36000, high: 36000, quote: 'Ingredients and packaging cost R36,000 a month' },
  overheads: { low: 16000, high: 16000, quote: 'Rent, power, fuel and software come to R16,000' },
  founderPay: { low: 12000, high: 12000, quote: 'I pay myself R12,000' },
  debtRepayments: { low: 3500, high: 3500, quote: 'We repay R3,500 a month on the delivery van' },
  cash: { low: 120000, high: 120000, quote: 'R120,000 in the business account' },
  riskComfort: { value: 'low', quote: "I'm careful with risk" },
  goals: { value: ['cash safety', 'growth'], quote: 'cash safety and growth' },
  offerRevenue: { low: 60000, high: 60000, quote: 'worth R60,000 a month' },
  paymentDays: { value: 60, quote: 'they pay 60 days after each invoice' },
  hireCost: { low: 8500, high: 8500, quote: 'another cook at R8,500 a month' },
  upfrontCost: { low: 25000, high: 25000, quote: 'a second fridge for R25,000' },
  // payroll is left out on purpose: Parallax asks for it as a follow-up. decisionType is left to code (decision.ts).
};

// Without a model, only the demo text is understood; anything else comes back empty,
// and the founder fills the form by hand (F2: "an empty form keeps the text").
export function fixtureExtract(text: string): Extraction {
  return text.trim() === DEMO_TEXT ? DEMO_EXTRACTION : {};
}
