// The founder's world, built from their own story by /api/scene: Muse Spark names the room's places and objects for
// this business, and Muse Image draws the founder's portrait there. Best-effort and in the background: until it
// arrives, and whenever it cannot, the app keeps the plain room and path-coloured silhouettes.
import type { SceneDressing } from "../../../shared/scene/dressing";

export type { SceneDressing };

export interface WorldContext {
  business?: string;
  location?: string;
  decision?: string;
  decisionType?: "contract" | "hire" | "pricing";
  story?: string;
}

export interface World {
  /** Null when the scene was refused but the portrait was still drawn; the room keeps its built labels. */
  dressing: SceneDressing | null;
  /** A small JPEG data URL, so it can be saved with the decision. Null when no portrait could be drawn. */
  portrait: string | null;
}

/** Scales a generated portrait down to a square JPEG small enough to save with the decision (about 25 KB). */
async function shrink(dataUrl: string, size = 320): Promise<string | null> {
  try {
    const blob = await (await fetch(dataUrl)).blob();
    const bitmap = await createImageBitmap(blob);
    const canvas = document.createElement("canvas");
    canvas.width = canvas.height = size;
    const ctx = canvas.getContext("2d");
    if (!ctx) return null;
    const side = Math.min(bitmap.width, bitmap.height);
    ctx.drawImage(bitmap, (bitmap.width - side) / 2, (bitmap.height - side) / 2, side, side, 0, 0, size, size);
    return canvas.toDataURL("image/jpeg", 0.82);
  } catch {
    return null;
  }
}

/** Null when no model is connected or the scene failed; the caller keeps the demo room. Never throws. */
export async function buildWorld(context: WorldContext): Promise<World | null> {
  try {
    const res = await fetch("/api/scene", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ context }) });
    const data = (await res.json()) as { ok?: boolean; mode?: string; dressing?: SceneDressing | null; portrait?: unknown } | null;
    if (!data?.ok || data.mode !== "model") return null;
    const portrait = typeof data.portrait === "string" && data.portrait.startsWith("data:image/") ? await shrink(data.portrait) : null;
    const dressing = data.dressing && typeof data.dressing === "object" ? data.dressing : null;
    if (!dressing && !portrait) return null;
    return { dressing, portrait };
  } catch {
    return null;
  }
}
