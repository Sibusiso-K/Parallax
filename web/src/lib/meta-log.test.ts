import { describe, expect, it } from "vitest";
import { modelOf } from "./meta-log";

describe("Meta inside", () => {
  it("finds the model name wherever a route puts it", () => {
    expect(modelOf({ model: "muse-spark-1.3" })).toBe("muse-spark-1.3");
    expect(modelOf({ trace: { model: "muse-spark-1.2" } })).toBe("muse-spark-1.2");
    expect(modelOf({ models: { scene: "muse-spark-1.3", portrait: "muse-image-1.0" } })).toBe("muse-spark-1.3 + muse-image-1.0");
    expect(modelOf({ ok: true, mode: "fixture" })).toBeUndefined();
  });

});
