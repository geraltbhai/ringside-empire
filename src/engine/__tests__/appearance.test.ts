import { describe, expect, it } from "vitest";
import { ROSTER_WRESTLERS } from "@/data/seed";
import { defaultBuild } from "@/engine/appearance";

describe("default physiques", () => {
  it("is deterministic and in range", () => {
    const input = { id: "x", style: "powerhouse" as const, division: "men" as const, weightLbs: 280, heightIn: 76, age: 30, bulk: 0.6 };
    expect(defaultBuild(input)).toEqual(defaultBuild(input));
    for (const w of ROSTER_WRESTLERS) {
      for (const k of ["muscle", "definition", "bodyFat", "shoulderWidth", "armSize", "legSize"] as const) {
        expect(w.appearance[k]).toBeGreaterThanOrEqual(0);
        expect(w.appearance[k]).toBeLessThanOrEqual(1);
      }
    }
  });

  it("makes powerhouses more muscular than high-flyers and giants softer than strikers", () => {
    const base = { id: "same", division: "men" as const, weightLbs: 230, heightIn: 74, age: 30, bulk: 0.4 };
    expect(defaultBuild({ ...base, style: "powerhouse" }).muscle).toBeGreaterThan(defaultBuild({ ...base, style: "high-flyer" }).muscle);
    expect(defaultBuild({ ...base, style: "giant", weightLbs: 360 }).bodyFat).toBeGreaterThan(defaultBuild({ ...base, style: "striker" }).bodyFat);
  });
});
