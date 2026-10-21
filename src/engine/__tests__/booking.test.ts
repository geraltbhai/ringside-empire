import { describe, expect, it } from "vitest";
import { hasErrors, newSegment, recommendCard, validateShow } from "@/engine/booking";
import type { Universe } from "@/engine/types";
import { startUniverse } from "@/engine/universe";

const make = () => startUniverse({ name: "T", promotionName: "P", startDate: "2026-01-05", startingCash: 5_000_000, difficulty: "normal", seed: 5 });
const mayhem = (u: Universe) => u.shows.find((s) => s.week === 0 && s.brand === "mayhem")!;
const messages = (u: Universe) => validateShow(u, mayhem(u)).filter((i) => i.level === "error").map((i) => i.message).join(" | ");

describe("booking validation", () => {
  it("rejects an empty card", () => {
    const u = make();
    expect(hasErrors(validateShow(u, mayhem(u)))).toBe(true);
  });

  it("accepts a simple valid card", () => {
    const u = make();
    mayhem(u).segments = [newSegment(u, "match", { sideA: ["marcus-vale"], sideB: ["jax-rourke"] })];
    expect(messages(u)).toBe("");
  });

  it("rejects the same wrestler in two matches on one show", () => {
    const u = make();
    mayhem(u).segments = [newSegment(u, "match", { sideA: ["marcus-vale"], sideB: ["jax-rourke"] }), newSegment(u, "match", { sideA: ["marcus-vale"], sideB: ["kai-moana"] })];
    expect(messages(u)).toMatch(/Marcus Vale is booked in 2 matches/);
  });

  it("rejects injured wrestlers in matches, other brands, unsigned talent and mixed divisions", () => {
    const u = make();
    u.wrestlers["jax-rourke"].injury = { description: "Knee sprain", weeksRemaining: 2 };
    mayhem(u).segments = [newSegment(u, "match", { sideA: ["marcus-vale"], sideB: ["jax-rourke"] })];
    expect(messages(u)).toMatch(/injured/);

    mayhem(u).segments = [newSegment(u, "match", { sideA: ["marcus-vale"], sideB: ["cole-maddox"] })];
    expect(messages(u)).toMatch(/Friday Fury/);

    mayhem(u).segments = [newSegment(u, "match", { sideA: ["marcus-vale"], sideB: ["silas-grimm"] })];
    expect(messages(u)).toMatch(/not under contract/);

    mayhem(u).segments = [newSegment(u, "match", { sideA: ["marcus-vale"], sideB: ["valentina-cruz"] })];
    expect(messages(u)).toMatch(/Mixed-division/);
  });

  it("allows cross-brand talent only when enabled", () => {
    const u = make();
    u.settings.allowCrossBrand = true;
    mayhem(u).segments = [newSegment(u, "match", { sideA: ["marcus-vale"], sideB: ["cole-maddox"] })];
    expect(messages(u)).toBe("");
  });

  it("enforces championship rules", () => {
    const u = make();
    // champion must be in the match
    mayhem(u).segments = [newSegment(u, "match", { sideA: ["marcus-vale"], sideB: ["jax-rourke"], titleId: "apex-world" })];
    expect(messages(u)).toMatch(/must be in a title match/);
    // tag title needs a tag match
    mayhem(u).segments = [newSegment(u, "match", { sideA: ["cain-hollow"], sideB: ["ty-okafor"], titleId: "mayhem-tag" })];
    expect(messages(u)).toMatch(/needs a tag-team match/);
    // another brand's title
    mayhem(u).segments = [newSegment(u, "match", { sideA: ["marcus-vale"], sideB: ["jax-rourke"], titleId: "fury-undisputed" })];
    expect(messages(u)).toMatch(/belongs to Friday Fury/);
    // same title twice on one card
    mayhem(u).segments = [
      newSegment(u, "match", { sideA: ["drago-kessler"], sideB: ["marcus-vale"], titleId: "apex-world" }),
      newSegment(u, "match", { sideA: ["drago-kessler"], sideB: ["jax-rourke"], titleId: "apex-world" }),
    ];
    expect(messages(u)).toMatch(/already on the line/);
  });

  it("checks match shape and talk segments", () => {
    const u = make();
    mayhem(u).segments = [newSegment(u, "match", { matchType: "tag", sideA: ["cain-hollow"], sideB: ["ty-okafor", "lucas-rey"] })];
    expect(messages(u)).toMatch(/two wrestlers per side/);
    mayhem(u).segments = [newSegment(u, "rivalry", { sideA: ["marcus-vale"] })];
    expect(messages(u)).toMatch(/someone on each side/);
  });
});

describe("AI Booker", () => {
  it("produces a valid, scored, explained card for every show type", () => {
    const u = make();
    for (const show of u.shows.filter((s) => s.week <= 3)) {
      const card = recommendCard(u, show);
      expect(card.length).toBeGreaterThanOrEqual(4);
      for (const s of card) {
        expect(s.reasons.length).toBeGreaterThan(0);
        expect(s.score).toBeGreaterThan(0);
      }
      show.segments = card.map((c) => c.segment);
      expect(validateShow(u, show).filter((i) => i.level === "error")).toEqual([]);
      expect(show.segments.filter((s) => s.isMainEvent)).toHaveLength(1);
      if (show.type === "weekly") expect(show.segments.filter((s) => s.kind !== "match").length).toBeLessThanOrEqual(3);
      show.segments = [];
    }
  });

  it("puts a championship on the line at premium live events", () => {
    const u = make();
    const ple = u.shows.find((s) => s.type === "ple")!;
    expect(recommendCard(u, ple).some((s) => s.segment.titleId)).toBe(true);
  });
});
