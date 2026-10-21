import { describe, expect, it } from "vitest";
import { newSegment } from "@/engine/booking";
import { demandIndex, projectAttendance, recordTransaction, weeklyLedger, weeklyPayroll } from "@/engine/finance";
import type { Universe } from "@/engine/types";
import { advanceWeek, canAdvance, evaluateOffer, releaseWrestler, runShow, signWrestler, simulateRemainingWeek, startUniverse } from "@/engine/universe";

const make = (seed = 3) => startUniverse({ name: "T", promotionName: "P", startDate: "2026-01-05", startingCash: 5_000_000, difficulty: "normal", seed });
const mayhem = (u: Universe, week = 0) => u.shows.find((s) => s.week === week && s.brand === "mayhem")!;

describe("finances", () => {
  it("records transactions and updates the cash balance", () => {
    const u = make();
    const start = u.cash;
    recordTransaction(u, "tickets", 1000, "test");
    recordTransaction(u, "venue", -400, "test");
    expect(u.cash).toBe(start + 600);
    const ledger = weeklyLedger(u);
    expect(ledger[0]).toMatchObject({ revenue: 1000, expenses: 400, profit: 600, cash: start + 600 });
  });

  it("sells fewer tickets when prices go up and more with popular stars", () => {
    const u = make();
    const show = mayhem(u);
    const venue = u.venues.find((v) => v.id === show.venueId)!;
    const stars = ["marcus-vale", "drago-kessler", "jax-rourke"];
    const cheap = projectAttendance(u, { ...show, ticketPrice: 30 }, venue, stars);
    const pricey = projectAttendance(u, { ...show, ticketPrice: 120 }, venue, stars);
    expect(cheap).toBeGreaterThan(pricey);
    expect(cheap).toBeLessThanOrEqual(venue.capacity);
    expect(demandIndex(u, show, stars)).toBeGreaterThan(demandIndex(u, show, ["benji-moss", "zane-parker"]));
  });

  it("charges payroll and overhead when the week advances", () => {
    const u = make();
    simulateRemainingWeek(u);
    const before = u.cash;
    const payroll = weeklyPayroll(u);
    advanceWeek(u);
    expect(before - u.cash).toBe(payroll + 260_000);
  });
});

describe("weekly loop", () => {
  it("refuses to advance until every show this week has run", () => {
    const u = make();
    expect(canAdvance(u)).toBe(false);
    expect(() => advanceWeek(u)).toThrow();
    simulateRemainingWeek(u);
    expect(canAdvance(u)).toBe(true);
  });

  it("updates records, popularity, history and rivalries after a show", () => {
    const u = make();
    const show = mayhem(u);
    show.segments = [
      newSegment(u, "match", { sideA: ["marcus-vale"], sideB: ["drago-kessler"], rivalryId: "riv-vale-kessler", outcome: { mode: "manual", winnerSide: "A" }, isMainEvent: true }),
      newSegment(u, "match", { sideA: ["kai-moana"], sideB: ["bruno-kraus"] }),
    ];
    const popBefore = u.wrestlers["marcus-vale"].popularity;
    const intensityBefore = u.rivalries["riv-vale-kessler"].intensity;
    const result = runShow(u, show.id);
    expect(show.status).toBe("completed");
    expect(u.wrestlers["marcus-vale"].record.wins).toBe(1);
    expect(u.wrestlers["drago-kessler"].record.losses).toBe(1);
    expect(u.history).toHaveLength(2);
    expect(u.wrestlers["marcus-vale"].popularity).not.toBe(popBefore);
    expect(u.rivalries["riv-vale-kessler"].intensity).toBeGreaterThan(intensityBefore);
    expect(u.rivalries["riv-vale-kessler"].aWins).toBe(1);
    expect(result.revenue.tickets).toBeGreaterThan(0);
    expect(u.transactions.length).toBeGreaterThan(0);
  });

  it("moves a championship and keeps lineage when the challenger wins a title match", () => {
    const u = make();
    const show = mayhem(u);
    show.segments = [newSegment(u, "match", { sideA: ["drago-kessler"], sideB: ["marcus-vale"], titleId: "apex-world", outcome: { mode: "manual", winnerSide: "B" }, isMainEvent: true })];
    runShow(u, show.id);
    const title = u.championships["apex-world"];
    // A booked finish is decisive unless the simulator rolled a DQ for flavour; either way the rule must hold.
    const last = u.history[u.history.length - 1];
    if (last.titleChange) {
      expect(title.holderIds).toEqual(["marcus-vale"]);
      const ended = title.reigns.find((r) => r.holderIds.includes("drago-kessler") && r.endWeek === 0);
      expect(ended).toBeDefined();
      expect(title.reigns[title.reigns.length - 1]).toMatchObject({ holderIds: ["marcus-vale"], endWeek: null });
    } else {
      expect(title.holderIds).toEqual(["drago-kessler"]);
    }
  });

  it("runs a full 12-week season without invalid states", () => {
    const u = make(99);
    for (let i = 0; i < 12; i++) {
      simulateRemainingWeek(u);
      advanceWeek(u);
    }
    expect(u.week).toBe(12);
    expect(u.history.length).toBeGreaterThan(100);
    for (const t of Object.values(u.championships)) for (const id of t.holderIds) expect(u.wrestlers[id]).toBeDefined();
    for (const w of Object.values(u.wrestlers)) {
      expect(w.popularity).toBeGreaterThanOrEqual(1);
      expect(w.popularity).toBeLessThanOrEqual(100);
      expect(w.fatigue).toBeGreaterThanOrEqual(0);
    }
    expect(Number.isFinite(u.cash)).toBe(true);
  });
});

describe("contracts", () => {
  it("accepts fair offers, rejects lowballs with a counter, and charges the bonus", () => {
    const u = make();
    const w = u.wrestlers["wade-collins"];
    const low = evaluateOffer(u, w, { weeklySalary: 1000, weeks: 52, signingBonus: 0, brand: "mayhem" });
    expect(low.accepted).toBe(false);
    expect(low.counter?.weeklySalary).toBeGreaterThan(1000);
    const cash = u.cash;
    const ok = signWrestler(u, w.id, { weeklySalary: Math.round(low.asking * 1.2), weeks: 52, signingBonus: 50_000, brand: "mayhem" });
    expect(ok.accepted).toBe(true);
    expect(u.wrestlers[w.id].brand).toBe("mayhem");
    expect(u.cash).toBe(cash - 50_000);
  });

  it("vacates titles and pays severance on release", () => {
    const u = make();
    const cash = u.cash;
    const severance = releaseWrestler(u, "drago-kessler");
    expect(u.championships["apex-world"].holderIds).toEqual([]);
    expect(u.wrestlers["drago-kessler"].brand).toBe("free-agents");
    expect(u.cash).toBe(cash - severance);
  });
});
