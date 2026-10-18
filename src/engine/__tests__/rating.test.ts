import { describe, expect, it } from "vitest";
import { ROSTER_WRESTLERS } from "@/data/seed";
import { DEFAULT_STYLE_WEIGHTS, entertainmentRating, formRating, formulaOverall, inRingRating, overall, ratingCard, styleWeights } from "@/engine/rating";
import { ATTRIBUTE_KEYS, type Attributes } from "@/engine/types";

const flat = (v: number) => Object.fromEntries(ATTRIBUTE_KEYS.map((k) => [k, v])) as Attributes;

describe("rating model", () => {
  it("gives a flat-attribute wrestler an overall equal to that value", () => {
    for (const style of Object.keys(DEFAULT_STYLE_WEIGHTS) as (keyof typeof DEFAULT_STYLE_WEIGHTS)[]) {
      expect(formulaOverall(flat(80), style)).toBe(80);
    }
  });

  it("is a weighted formula, not a simple average", () => {
    const a = { ...flat(70), technical: 95, grappling: 95 };
    const avg = Math.round(Object.values(a).reduce((s, v) => s + v, 0) / ATTRIBUTE_KEYS.length);
    expect(formulaOverall(a, "technician")).toBeGreaterThan(avg);
    expect(formulaOverall(a, "technician")).toBeGreaterThan(formulaOverall(a, "powerhouse"));
  });

  it("rewards strength more for powerhouses than for high-flyers", () => {
    const strong = { ...flat(70), strength: 99, durability: 95 };
    expect(inRingRating(strong, "powerhouse")).toBeGreaterThan(inRingRating(strong, "high-flyer"));
  });

  it("supports configurable weight overrides", () => {
    const a = { ...flat(70), aerial: 99 };
    const base = inRingRating(a, "technician");
    const boosted = inRingRating(a, "technician", { ratingWeightOverrides: { technician: { aerial: 10 } } });
    expect(boosted).toBeGreaterThan(base);
    expect(styleWeights("technician", { ratingWeightOverrides: { technician: { aerial: 10 } } }).aerial).toBe(10);
  });

  it("respects a manual overall override and clamps it", () => {
    const w = { ...ROSTER_WRESTLERS[0], overallOverride: 120 };
    expect(overall(w)).toBe(99);
    expect(overall({ ...w, overallOverride: null })).toBe(formulaOverall(w.attributes, w.style));
  });

  it("keeps in-ring, entertainment, popularity, form and potential separate", () => {
    const w = ROSTER_WRESTLERS.find((x) => x.id === "malik-brooks")!;
    const card = ratingCard(w);
    expect(card.entertainment).toBeGreaterThan(card.inRing);
    expect(card.popularity).toBe(w.popularity);
    expect(card.potential).toBe(w.potential);
    expect(entertainmentRating(w.attributes)).toBeGreaterThan(85);
  });

  it("drops current form for tired, injured or unhappy wrestlers", () => {
    const fresh = { momentum: 70, morale: 70, fatigue: 0, injury: null };
    expect(formRating({ ...fresh, fatigue: 80 })).toBeLessThan(formRating(fresh));
    expect(formRating({ ...fresh, injury: { description: "x", weeksRemaining: 2 } })).toBeLessThan(formRating(fresh));
  });

  it("ships a fixed roster database whose overalls land in sensible tiers", () => {
    const byId = Object.fromEntries(ROSTER_WRESTLERS.map((w) => [w.id, overall(w)]));
    expect(byId["silas-grimm"]).toBe(96);
    expect(byId["solomon-reyes"]).toBe(93);
    expect(byId["benji-moss"]).toBeLessThan(70);
    for (const w of ROSTER_WRESTLERS) for (const k of ATTRIBUTE_KEYS) expect(w.attributes[k]).toBeGreaterThanOrEqual(1);
  });
});
