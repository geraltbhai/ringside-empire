import { describe, expect, it } from "vitest";
import { ROSTER_WRESTLERS } from "@/data/seed";
import { createMatch, FLOOR_INNER, type MatchEvent, type MatchInput, MAT_Y, RING_LIMIT, stepMatch } from "@/engine/live-match";

const get = (id: string) => ROSTER_WRESTLERS.find((w) => w.id === id)!;
const idle: MatchInput = { moveX: 0, moveZ: 0, run: false, pressed: {} };

/** Run with every wrestler (including "the player") left to the AI-ish bot below. */
function play(ids: string[], seed: string, limit = 480, drive?: (m: ReturnType<typeof createMatch>) => MatchInput) {
  const m = createMatch(
    ids.map((id, i) => ({ wrestler: get(id), isPlayer: i === 0 })),
    { timeLimitSec: limit, difficulty: "normal", seed },
  );
  const events: MatchEvent[] = [];
  let guard = 0;
  while (!m.over && guard++ < limit * 60 + 10) {
    stepMatch(m, drive ? drive(m) : idle, 1 / 60);
    events.push(...m.events);
  }
  return { m, events };
}

describe("live match engine", () => {
  it("runs a triple threat to a decision with every wrestler AI-driven", () => {
    // the player stands still; the two AIs fight each other and the player
    const { m, events } = play(["cody-rhodes", "roman-reigns", "drew-mcintyre"], "tt-1");
    expect(m.over).toBe(true);
    expect(m.fighters).toHaveLength(3);
    expect(events.some((e) => e.type === "hit")).toBe(true);
    expect(m.rules.countOut).toBe(false);
  });

  it("keeps wrestlers inside the ring or out on the floor, never inside the ring apron", () => {
    const { m } = play(["cody-rhodes", "roman-reigns", "drew-mcintyre", "cm-punk"], "f4-2", 120);
    for (const f of m.fighters) {
      if (f.zone === "ring") {
        expect(Math.abs(f.x)).toBeLessThanOrEqual(RING_LIMIT + 1e-6);
        expect(f.y).toBeCloseTo(MAT_Y, 5);
      } else if (f.state !== "transition") {
        expect(Math.max(Math.abs(f.x), Math.abs(f.z))).toBeGreaterThanOrEqual(FLOOR_INNER - 1e-6);
      }
    }
  });

  it("rolls the player out under the ropes and counts them out", () => {
    // walk the player into the east ropes and stay out there
    const { m, events } = play(["cody-rhodes", "cedric-alexander"], "co-3", 480, (match) => {
      const p = match.fighters[0];
      return { moveX: p.zone === "ring" ? 1 : 1, moveZ: 0, run: false, pressed: {} };
    });
    expect(events.some((e) => e.type === "move-zone" && e.who === "cody-rhodes" && e.kind === "roll-out")).toBe(true);
    expect(events.some((e) => e.type === "outcount")).toBe(true);
    expect(m.winner).toBe("cedric-alexander");
    expect(m.method).toBe("Count-out");
  });

  it("tracks damage per body part", () => {
    const { m } = play(["gunther", "rey-mysterio"], "bp-4", 120);
    const total = m.fighters.flatMap((f) => Object.values(f.parts)).reduce((s, v) => s + v, 0);
    expect(total).toBeGreaterThan(0);
  });
});
