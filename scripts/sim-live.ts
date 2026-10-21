import { createMatch, stepMatch, playedMatchQuality, type MatchInput } from "../src/engine/live-match";
import roster from "../src/data/roster.json";
import { createRng } from "../src/engine/rng";
const ws = roster.wrestlers as unknown as Parameters<typeof createMatch>[0][];
const get = (id: string) => ws.find((w) => w.id === id)!;
let pw = 0, ow = 0, draws = 0;
for (let g = 0; g < 20; g++) {
  const m = createMatch(get("marcus-vale"), get(g % 2 ? "drago-kessler" : "benji-moss"), { timeLimitSec: 480, difficulty: "normal", seed: "t" + g });
  const rng = createRng("bot", g);
  const counts = { hit: 0, rev: 0, kick: 0 };
  while (!m.over) {
    const [p, o] = m.fighters;
    const ang = Math.atan2(o.x - p.x, o.z - p.z);
    const d = Math.hypot(o.x - p.x, o.z - p.z);
    const input: MatchInput = { moveX: d > 1 ? Math.sin(ang) : 0, moveZ: d > 1 ? Math.cos(ang) : 0, run: false, pressed: {} };
    if (p.state === "pinned" || p.state === "submitted") { if (rng.chance(0.1)) input.pressed.pin = true; } else if (rng.chance(0.08)) { const k = rng.pick(["light","heavy","grapple","pin","signature","finisher","reverse","pin"] as const); input.pressed[k] = true; }
    stepMatch(m, input, 1 / 60);
    for (const e of m.events) { if (e.type === "hit") counts.hit++; if (e.type === "reversal") counts.rev++; if (e.type === "kickout") counts.kick++; }
  }
  if (m.winner === m.fighters[0].id) pw++; else if (m.winner) ow++; else draws++;
  console.log(g, m.fighters[1].name.padEnd(14), "winner", (m.winner ?? "draw").padEnd(14), m.method.padEnd(12), "t", m.time.toFixed(0), "hp", m.fighters.map(f=>f.health.toFixed(0)).join("/"), counts, "q", playedMatchQuality(m));
}
console.log({ pw, ow, draws });
