import { describe, expect, it } from "vitest";
import { generateDialogue } from "@/engine/dialogue";
import { createRng } from "@/engine/rng";
import { createRivalry } from "@/engine/storyline";
import { startUniverse } from "@/engine/universe";

const make = () => startUniverse({ name: "T", promotionName: "P", startDate: "2026-01-05", startingCash: 5_000_000, difficulty: "normal", seed: 7 });

describe("promo dialogue", () => {
  it("writes a confrontation between both sides with no unfilled placeholders", () => {
    const u = make();
    const r = createRivalry(u, { sideA: ["cody-rhodes"], sideB: ["roman-reigns"], payoff: "stipulation-match", titleId: null, origin: "test", theme: "betrayal", stipulation: "steel-cage" });
    for (const stage of [0, 2, 3, 4] as const) {
      r.stage = stage;
      const lines = generateDialogue(u, { kind: "rivalry", sideA: r.sideA, sideB: r.sideB, rivalry: r }, createRng("d", stage));
      const speakers = new Set(lines.map((l) => l.speakerId).filter(Boolean));
      expect(speakers).toEqual(new Set(["cody-rhodes", "roman-reigns"]));
      for (const l of lines) expect(l.text).not.toMatch(/\{\w+\}/);
    }
  });

  it("has a solo promo address the speaker's rival", () => {
    const u = make();
    createRivalry(u, { sideA: ["cm-punk"], sideB: ["drew-mcintyre"], payoff: "grudge-match", titleId: null, origin: "test", theme: "personal", intensity: 99 });
    const lines = generateDialogue(u, { kind: "promo", sideA: ["cm-punk"], sideB: [], rivalry: null }, createRng("p"));
    expect(lines.some((l) => l.speakerId === "cm-punk" && /Drew/.test(l.text))).toBe(true);
  });
});
