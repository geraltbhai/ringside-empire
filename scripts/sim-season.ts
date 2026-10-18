/** Headless season simulation for balancing: npx tsx scripts/sim-season.ts [weeks] */
import { startUniverse, simulateRemainingWeek, advanceWeek } from "../src/engine/universe";
const weeks = Number(process.argv[2] ?? 16);
const u = startUniverse({ name: "Test", promotionName: "Apex", startDate: "2026-01-05", startingCash: 5_000_000, difficulty: "normal", seed: 42 });
for (let i = 0; i < weeks; i++) {
  for (const r of simulateRemainingWeek(u)) {
    const s = u.shows.find((x) => x.id === r.showId)!; const res = s.result!;
    console.log(`w${u.week} ${s.name.padEnd(16)} segs=${s.segments.length} rating=${res.rating} avgQ=${res.avgMatchQuality} main=${res.mainEventQuality} att=${res.attendance} view=${(res.viewership/1e6).toFixed(2)}M profit=${Math.round(res.profit/1000)}k${r.removed.length ? " removed=" + r.removed.join(",") : ""}`);
  }
  advanceWeek(u);
  console.log(`  -> cash ${Math.round(u.cash/1000)}k demand ${u.audienceDemand.toFixed(1)} mayhem ${u.brands.mayhem.popularity.toFixed(1)} fury ${u.brands.fury.popularity.toFixed(1)}`);
}
const changes = u.history.filter((h) => h.titleChange).length;
const stars = u.history.map((h) => h.stars);
console.log("matches", u.history.length, "title changes", changes, "avg stars", (stars.reduce((a,b)=>a+b,0)/stars.length).toFixed(2), "max", Math.max(...stars), "min", Math.min(...stars));
console.log("rivalries", Object.values(u.rivalries).map((r) => `${r.id}:${r.status}:s${r.stage}:i${Math.round(r.intensity)}`).join(" "));
console.log("injured", Object.values(u.wrestlers).filter((w) => w.injury).map((w) => w.ringName));
const upsets = u.history.filter(h => h.summary.includes("upset") || h.summary.includes("stole")).length; console.log("upset finishes", upsets);
console.log(Object.values(u.championships).map(c=>`${c.shortName}: ${c.holderIds.join("&")} (${c.reigns.length} reigns)`).join("\n"));
