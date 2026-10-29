import { z } from 'zod';

// Intake fields (SCOPE.md §3). Every extracted field carries the quote it came from,
// so code can check the quote is really in the person's text (FEATURES.md F2).

export const moneyField = z.object({
  low: z.number().nonnegative(),
  high: z.number().nonnegative(),
  /** The person's own "usually" figure inside the range, if they gave one. */
  base: z.number().nonnegative().optional(),
  quote: z.string().min(1),
});

const textField = z.object({ value: z.string().min(1), quote: z.string().min(1) });

export const ageBands = ['18-24', '25-34', '35-44', '45-54', '55+'] as const;
export const riskLevels = ['low', 'medium', 'high'] as const;
export const goalOptions = ['security', 'income', 'freedom', 'family time', 'growth'] as const;

export const extraction = z.object({
  decision: textField.optional(),
  ageBand: z.object({ value: z.enum(ageBands), quote: z.string().min(1) }).optional(),
  province: textField.optional(),
  takeHome: moneyField.optional(),
  essentialExpenses: moneyField.optional(),
  familySupportMonthly: moneyField.optional(),
  debtRepayments: moneyField.optional(),
  savings: moneyField.optional(),
  riskComfort: z.object({ value: z.enum(riskLevels), quote: z.string().min(1) }).optional(),
  goals: z
    .object({ value: z.array(z.enum(goalOptions)).min(1).max(3), quote: z.string().min(1) })
    .optional(),
  // Template field for decision 1 (side business); optional, never asked as a follow-up.
  sideIncome: moneyField.optional(),
});

export type Extraction = z.infer<typeof extraction>;
export type MoneyField = z.infer<typeof moneyField>;
export type FieldKey = keyof Extraction;

export const requiredFields: FieldKey[] = [
  'decision',
  'ageBand',
  'province',
  'takeHome',
  'essentialExpenses',
  'familySupportMonthly',
  'debtRepayments',
  'savings',
  'riskComfort',
  'goals',
];

export const moneyKeys = [
  'sideIncome',
  'takeHome',
  'essentialExpenses',
  'familySupportMonthly',
  'debtRepayments',
  'savings',
] as const satisfies readonly FieldKey[];

export const fieldLabels: Record<FieldKey, string> = {
  decision: 'The decision',
  ageBand: 'Age band',
  province: 'Province',
  takeHome: 'Monthly take-home pay',
  essentialExpenses: 'Essential monthly expenses',
  familySupportMonthly: 'Monthly support to family',
  debtRepayments: 'Monthly debt repayments',
  savings: 'Savings',
  riskComfort: 'Comfort with risk',
  goals: 'Top priorities',
  sideIncome: 'Side business profit each month',
};

// One follow-up at a time, in this order (F2: at most three are asked before the form).
export const followUps: Record<FieldKey, string> = {
  decision: 'What decision are you weighing up?',
  ageBand: 'Which age band are you in?',
  province: 'Which province do you live in?',
  takeHome: 'Roughly how much do you take home each month?',
  essentialExpenses: 'What do your essentials cost each month: rent, food, transport?',
  familySupportMonthly: 'Do you support family each month? How much?',
  debtRepayments: 'Do you pay off any debt each month? How much?',
  savings: 'How much do you have saved?',
  riskComfort: 'How comfortable are you with risk: low, medium or high?',
  goals: 'What matters most to you right now? Pick up to three.',
  sideIncome: 'Do you make money on the side? Roughly how much a month?',
};

export const intakeRequest = z.object({
  text: z.string().trim().min(1, 'Tell us about your decision first').max(4000, 'Please keep it under 4,000 characters'),
});
