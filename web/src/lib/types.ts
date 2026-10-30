export type Source = "you" | "default" | "template" | "ai";

export interface Assumption {
  id: string;
  label: string;
  kind: "income" | "cost";
  low: number;
  base: number;
  high: number;
  source?: Source;
  fromMonth?: number;
  toMonth?: number;
}

export interface PathCard {
  id: string;
  letter: "A" | "B" | "C";
  name: string;
  summary: string;
  startingSavings: number;
  assumptions: Assumption[];
  avatarUrl?: string;
}

export interface MonthRow {
  month: number;
  income: number;
  costs: number;
  net: number;
  savings: number;
}

export interface CaseResult {
  rows: MonthRow[];
  shortfallMonths: number[];
}

export type Simulation = Record<"bad" | "likely" | "good", CaseResult>;

export interface MoneyField {
  low: number;
  high: number;
  base?: number;
  quote: string;
}

export type FieldKey =
  | "decision"
  | "ageBand"
  | "province"
  | "takeHome"
  | "essentialExpenses"
  | "familySupportMonthly"
  | "debtRepayments"
  | "savings"
  | "riskComfort"
  | "goals"
  | "sideIncome";

export interface IntakeResponse {
  ok: true;
  mode: "model" | "fixture";
  fields: Partial<Record<FieldKey, unknown>>;
  missing: FieldKey[];
  notice?: string;
}

export interface ChatChunk {
  type: "token" | "citation" | "done";
  text?: string;
  citation?: { id: string; label: string };
}

/** The confirmed "You, today" profile passed to mockApi.paths. */
export interface Profile {
  fields: Partial<Record<FieldKey, unknown>>;
  /** Fields filled with a default because the user said "I don't know". */
  assumed: FieldKey[];
}
