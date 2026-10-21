import { describe, expect, it } from "vitest";
import { newSegment } from "@/engine/booking";
import { createRng } from "@/engine/rng";
import { qualityToStars, simulateSegment, softCap, winProbabilities } from "@/engine/simulation";
import type { Segment, Universe } from "@/engine/types";
import { startUniverse } from "@/engine/universe";

const make = (seed = 11) => startUniverse({ name: "T", promotionName: "P", startDate: "2026-01-05", startingCash: 5_000_000, difficulty: "normal", seed });
const weekly = (u: Universe, brand: "mayhem" | "fury" = "mayhem") => u.shows.find((s) => s.week === 0 && s.brand === brand)!;
const singles = (u: Universe, a: string, b: string, extra: Partial<Segment> = {}) => newSegment(u, "match", { sideA: [a], sideB: [b], durationMin: 12, ...extra });

describe("win probabilities", () => {
  it("sum to 1, favour the stronger side, and never shut the underdog out", () => {
    const p = winProbabilities([95, 60]);
    expect(p[0] + p[1]).toBeCloseTo(1);
    expect(p[0]).toBeGreaterThan(p[1]);
    expect(p[1]).toBeGreaterThanOrEqual(0.07);
    const three = winProbabilities([80, 80, 80]);
    three.forEach((x) => expect(x).toBeCloseTo(1 / 3));
  });
});

describe("match simulator", () => {
  it("is deterministic for the same seed", () => {
    const u = make();
    const show = weekly(u);
    const seg = singles(u, "marcus-vale", "jax-rourke");
    const a = simulateSegment({ universe: u, show, rng: createRng("x") }, seg);
    const b = simulateSegment({ universe: u, show, rng: createRng("x") }, seg);
    expect(a).toEqual(b);
  });

  it("lets a much lower-rated wrestler win occasionally, but not usually", () => {
    const u = make();
    const show = weekly(u);
    const seg = singles(u, "drago-kessler", "zane-parker"); // 92 vs 73
    let upsets = 0;
    const N = 400;
    for (let i = 0; i < N; i++) {
      const r = simulateSegment({ universe: u, show, rng: createRng("upset", i) }, seg);
      if (r.winnerIds.includes("zane-parker")) upsets++;
    }
    expect(upsets).toBeGreaterThan(N * 0.03);
    expect(upsets).toBeLessThan(N * 0.35);
  });

  it("does not decide match quality by overall alone (stakes and crowd matter)", () => {
    const u = make();
    const show = weekly(u);
    const plain = singles(u, "marcus-vale", "drago-kessler", { durationMin: 16 });
    const big = singles(u, "marcus-vale", "drago-kessler", { durationMin: 16, titleId: "apex-world", rivalryId: "riv-vale-kessler", isMainEvent: true, stipulation: "steel-cage" });
    const avg = (seg: Segment) => {
      let s = 0;
      for (let i = 0; i < 60; i++) s += simulateSegment({ universe: u, show, rng: createRng("q", i) }, seg).quality;
      return s / 60;
    };
    expect(avg(big)).toBeGreaterThan(avg(plain) + 3);
  });

  it("respects booked (manual) outcomes and labels them", () => {
    const u = make();
    const r = simulateSegment({ universe: u, show: weekly(u), rng: createRng("m") }, singles(u, "drago-kessler", "benji-moss", { outcome: { mode: "manual", winnerSide: "B" } }));
    expect(r.winnerIds).toEqual(["benji-moss"]);
    expect(r.source).toBe("manual");
  });

  it("changes a title only on a decisive finish, never on a DQ", () => {
    const u = make();
    const show = weekly(u);
    let changes = 0;
    let dqChanges = 0;
    for (let i = 0; i < 300; i++) {
      const seg = singles(u, "drago-kessler", "marcus-vale", { titleId: "apex-world" });
      const r = simulateSegment({ universe: u, show, rng: createRng("title", i) }, seg);
      if (r.titleChange) {
        changes++;
        expect(r.titleChange.newHolderIds).toEqual(["marcus-vale"]);
        expect(r.titleChange.previousHolderIds).toEqual(["drago-kessler"]);
        if (r.finish.startsWith("Disqualification")) dqChanges++;
      } else if (r.winnerIds.includes("marcus-vale")) {
        expect(r.finish.startsWith("Disqualification") || r.finish.startsWith("Double")).toBe(true);
      }
    }
    expect(changes).toBeGreaterThan(0);
    expect(dqChanges).toBe(0);
  });

  it("maps quality onto a 0–5 star scale with a soft cap", () => {
    expect(qualityToStars(100)).toBe(5);
    expect(qualityToStars(35)).toBe(0.25);
    expect(qualityToStars(71)).toBe(3);
    expect(softCap(80)).toBe(80);
    expect(softCap(105)).toBe(95);
  });
});

