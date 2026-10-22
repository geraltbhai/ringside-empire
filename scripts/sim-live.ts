/**
 * Headless AI-vs-AI playtest of the live match engine.
 *   npx tsx scripts/sim-live.ts [entrants] [games]
 */
import roster from "../src/data/roster.json";
import { createMatch, type Entrant, type MatchInput, playedMatchQuality, stepMatch } from "../src/engine/live-match";
import { createRng } from "../src/engine/rng";
import type { Wrestler } from "../src/engine/types";

const ws = roster.wrestlers as unknown as Wrestler[];
const n = Number(process.argv[2] ?? 2);
const games = Number(process.argv[3] ?? 12);
const pool = ["drew-mcintyre", "cody-rhodes", "roman-reigns", "cm-punk", "gunther", "rey-mysterio", "cedric-alexander", "bron-breakker"];
const tally: Record<string, number> = {};
for (let g = 0; g < games; g++) {
  const entrants: Entrant[] = Array.from({ length: n }, (_, i) => ({ wrestler: ws.find((w) => w.id === pool[(g + i) % pool.length])!, isPlayer: i === 0 }));
  const m = createMatch(entrants, { timeLimitSec: 480, difficulty: "normal", seed: `t${n}-${g}` });
  const rng = createRng("bot", g);
  const counts = { hit: 0, rev: 0, kick: 0, out: 0, broken: 0, fired: 0, zone: 0 };
  // the "player" is a simple bot: walk at the nearest opponent and press buttons
  while (!m.over) {
    const p = m.fighters[0];
    const o = m.fighters.filter((f) => f !== p).sort((a, b) => Math.hypot(a.x - p.x, a.z - p.z) - Math.hypot(b.x - p.x, b.z - p.z))[0];
    const ang = Math.atan2(o.x - p.x, o.z - p.z);
    const d = Math.hypot(o.x - p.x, o.z - p.z);
    const input: MatchInput = { moveX: d > 1 ? Math.sin(ang) : 0, moveZ: d > 1 ? Math.cos(ang) : 0, run: false, pressed: {} };
    if (p.state === "pinned" || p.state === "submitted") {
      if (rng.chance(0.1)) input.pressed.pin = true;
    } else if (rng.chance(0.08)) input.pressed[rng.pick(["light", "heavy", "grapple", "pin", "signature", "finisher", "reverse", "pin"] as const)] = true;
    stepMatch(m, input, 1 / 60);
    for (const e of m.events) {
      if (e.type === "hit") counts.hit++;
      if (e.type === "reversal") counts.rev++;
      if (e.type === "kickout") counts.kick++;
      if (e.type === "ringout") counts.out++;
      if (e.type === "broken") counts.broken++;
      if (e.type === "fired-up") counts.fired++;
      if (e.type === "move-zone") counts.zone++;
    }
  }
  tally[m.method] = (tally[m.method] ?? 0) + 1;
  console.log(g, "winner", (m.winner ?? "draw").padEnd(18), m.method.padEnd(16), "t", m.time.toFixed(0).padStart(3), "hp", m.fighters.map((f) => f.health.toFixed(0)).join("/").padEnd(12), JSON.stringify(counts), "q", playedMatchQuality(m));
}
console.log(tally);
