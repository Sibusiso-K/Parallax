// A what-if in the founder's words, read into the futures screen's levers: by Muse Spark when it is connected, else by
// the plain reader in code. Either way the engine, not the model, reruns the futures.
import { readInCode, toResult, type WhatIfResult } from "../../../shared/whatif/read";

export interface WhatIfRead extends WhatIfResult {
  /** "model": Muse Spark read it. "code": demo mode, or the model could not be reached. */
  by: "model" | "code";
  model?: string;
  /** Why the code reader was used when a model is connected. */
  fallback?: string;
}

export async function readWhatIf(text: string): Promise<WhatIfRead> {
  const inCode = (fallback?: string): WhatIfRead => ({ ...toResult(readInCode(text)), by: "code", fallback });
  try {
    const res = await fetch("/api/whatif", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ text }) });
    const data = (await res.json().catch(() => null)) as (Partial<WhatIfResult> & { ok?: boolean; mode?: string; model?: string; error?: string }) | null;
    if (data?.ok && data.mode === "model" && data.changes) {
      return { changes: data.changes, outOfScope: !!data.outOfScope, clamped: !!data.clamped, by: "model", model: data.model };
    }
    if (data?.mode === "fixture") return inCode();
    return inCode(data?.error ?? "The model could not be reached");
  } catch {
    return inCode("The model could not be reached");
  }
}
