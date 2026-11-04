import { z } from 'zod';

// Intake fields for a founder's business decision (SCOPE.md §3). Every extracted field carries the quote it came from,
// so code can check the quote is really in the person's text (FEATURES.md F2).

export const moneyField = z.object({
  low: z.number().nonnegative(),
  high: z.number().nonnegative(),
  /** The founder's own "usually" figure inside the range, if they gave one. */
  base: z.number().nonnegative().optional(),
  quote: z.string().min(1),
});

const textField = z.object({ value: z.string().min(1), quote: z.string().min(1) });
const numberField = z.object({ value: z.number().nonnegative(), quote: z.string().min(1) });

// The decisions Parallax has templates for (SCOPE.md §2). Other founder decisions are on the roadmap.
export const decisionTypes = ['contract', 'hire', 'pricing'] as const;
export type DecisionType = (typeof decisionTypes)[number];

export const decisionLabels: Record<DecisionType, string> = {
  contract: 'Take on a big contract or order',
  hire: 'Make a hire',
  pricing: 'Raise your prices',
};

export const riskLevels = ['low', 'medium', 'high'] as const;
export const goalOptions = ['cash safety', 'growth', 'profit', 'control', 'time'] as const;

export const extraction = z.object({
  decision: textField.optional(),
  decisionType: z.object({ value: z.enum(decisionTypes), quote: z.string().min(1) }).optional(),
  business: textField.optional(),
  location: textField.optional(),
  revenue: moneyField.optional(),
  directCosts: moneyField.optional(),
  overheads: moneyField.optional(),
  payroll: moneyField.optional(),
  founderPay: moneyField.optional(),
  debtRepayments: moneyField.optional(),
  cash: moneyField.optional(),
  riskComfort: z.object({ value: z.enum(riskLevels), quote: z.string().min(1) }).optional(),
  goals: z
    .object({ value: z.array(z.enum(goalOptions)).min(1).max(3), quote: z.string().min(1) })
    .optional(),
  // Template fields: optional and never asked as follow-ups; za.json templates fill in what is missing.
  offerRevenue: moneyField.optional(),
  paymentDays: numberField.optional(),
  hireCost: moneyField.optional(),
  upfrontCost: moneyField.optional(),
  priceRisePercent: numberField.optional(),
});

export type Extraction = z.infer<typeof extraction>;
export type MoneyField = z.infer<typeof moneyField>;
export type FieldKey = keyof Extraction;

export const requiredFields: FieldKey[] = [
  'decision',
  'decisionType',
  'business',
  'revenue',
  'directCosts',
  'overheads',
  'payroll',
  'founderPay',
  'debtRepayments',
  'cash',
  'riskComfort',
  'goals',
];

/** Amounts in rand. All are per month except `cash` (a balance) and `upfrontCost` (paid once). */
export const moneyKeys = [
  'revenue',
  'directCosts',
  'overheads',
  'payroll',
  'founderPay',
  'debtRepayments',
  'cash',
  'offerRevenue',
  'hireCost',
  'upfrontCost',
] as const satisfies readonly FieldKey[];

export const numberKeys = ['paymentDays', 'priceRisePercent'] as const satisfies readonly FieldKey[];

export const fieldLabels: Record<FieldKey, string> = {
  decision: 'The decision',
  decisionType: 'Kind of decision',
  business: 'What the business does',
  location: 'Where the business is based',
  revenue: 'Sales each month',
  directCosts: 'Direct costs each month (stock, ingredients, materials)',
  overheads: 'Rent and running costs each month',
  payroll: 'Staff wages each month',
  founderPay: 'What you pay yourself each month',
  debtRepayments: 'Business debt repayments each month',
  cash: 'Cash in the business',
  riskComfort: 'Comfort with risk',
  goals: 'Top priorities',
  offerRevenue: 'The new contract or order, per month',
  paymentDays: 'Days the client takes to pay',
  hireCost: 'Monthly cost of the new person',
  upfrontCost: 'One-off cost to get started',
  priceRisePercent: 'Price rise (%)',
};

// One follow-up at a time, in this order (F2: at most three are asked before the form).
export const followUps: Record<FieldKey, string> = {
  decision: 'What decision are you weighing up for the business?',
  decisionType: 'Which is closest: taking on a big contract or order, making a hire, or raising your prices?',
  business: 'What does the business do?',
  location: 'Where is the business based?',
  revenue: 'Roughly how much does the business sell each month?',
  directCosts: 'What do stock, ingredients or materials cost you each month?',
  overheads: 'What do rent and running costs (power, fuel, software) come to each month?',
  payroll: 'What do staff wages come to each month, in total?',
  founderPay: 'How much do you pay yourself each month?',
  debtRepayments: 'Does the business repay any debt each month? How much?',
  cash: 'How much cash is in the business right now?',
  riskComfort: 'How comfortable are you with risk: low, medium or high?',
  goals: 'What matters most right now? Pick up to three: cash safety, growth, profit, control, time.',
  offerRevenue: 'What is the new contract or order worth each month?',
  paymentDays: 'How many days after an invoice does the client pay?',
  hireCost: 'What would the new person cost you each month?',
  upfrontCost: 'Is there a one-off cost to get started, such as equipment?',
  priceRisePercent: 'By what percentage would you raise prices?',
};

export const intakeRequest = z.object({
  text: z.string().trim().min(1, 'Tell us about your decision first').max(4000, 'Please keep it under 4,000 characters'),
});
