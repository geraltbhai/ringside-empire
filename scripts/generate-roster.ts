/**
 * Expands the compact roster definitions into the fixed attribute database.
 * Deterministic: running it twice produces byte-identical output.
 *   npx tsx scripts/generate-roster.ts
 */
import { writeFileSync } from "node:fs";
import path from "node:path";
import { TEAM_DEFS, WRESTLER_DEFS, type WrestlerDef } from "../src/data/roster-source";
import { entertainmentRating, formulaOverall } from "../src/engine/rating";
import { hashString } from "../src/engine/rng";
import {
  ATTRIBUTE_KEYS,
  type Appearance,
  type Attributes,
  type AttributeKey,
  IN_RING_KEYS,
  type Wrestler,
  type WrestlingStyle,
} from "../src/engine/types";

const STYLE_SHAPE: Record<WrestlingStyle, Partial<Record<AttributeKey, number>>> = {
  "all-rounder": { psychology: 6, stamina: 6, reversal: 4, aerial: -6, submission: -3 },
  powerhouse: { strength: 22, durability: 14, grappling: 10, striking: 4, aerial: -26, speed: -10, agility: -14, submission: -8, technical: -6 },
  technician: { technical: 20, grappling: 14, submission: 14, reversal: 12, psychology: 10, strength: -6, aerial: -14, striking: -4 },
  "high-flyer": { aerial: 24, agility: 20, speed: 16, reversal: 6, strength: -18, durability: -10, submission: -10, grappling: -6 },
  brawler: { striking: 16, durability: 14, strength: 8, selling: 4, technical: -10, aerial: -18, submission: -10, agility: -4 },
  striker: { striking: 22, speed: 10, defense: 10, reversal: 6, aerial: -14, submission: -8, grappling: -4 },
  showman: { selling: 14, psychology: 10, agility: 4, striking: 2, technical: -6, submission: -8 },
  giant: { strength: 26, durability: 20, striking: 6, speed: -22, agility: -24, aerial: -32, stamina: -6, submission: -10, technical: -8 },
};

const SKIN = ["#f5d0b5", "#e8b48f", "#c98e62", "#a86b45", "#7d4a2d", "#5a341f"];
const HAIR = ["#1c1917", "#3f2a1d", "#6b4423", "#a16207", "#d6d3d1", "#7f1d1d"];

const jitter = (seed: string, spread: number) => (hashString(seed) % (spread * 2 + 1)) - spread;
const clampN = (v: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, Math.round(v)));

function buildAttributes(def: WrestlerDef): Attributes {
  const shape = STYLE_SHAPE[def.style];
  const attrs = {} as Attributes;
  for (const key of ATTRIBUTE_KEYS) {
    attrs[key] = 60 + (shape[key] ?? 0) + jitter(`${def.id}:${key}`, 4) + (def.boosts?.[key] ?? 0);
  }
  // Women's division: modest strength/durability shape, more speed/agility. Ratings stay comparable within a division.
  if (def.division === "women") {
    attrs.strength -= 4;
    attrs.agility += 3;
    attrs.speed += 3;
  }
  // Veterans: experience up, physical tools down.
  if (def.age >= 38) {
    attrs.psychology += 6;
    attrs.speed -= 6;
    attrs.recovery -= 6;
    attrs.stamina -= 4;
  }
  // Entertainment attributes centred on the entertainment target.
  const entShape: Partial<Record<AttributeKey, number>> = def.style === "showman" ? { charisma: 3, promo: 2 } : {};
  for (const key of ["charisma", "promo", "crowdConnection"] as AttributeKey[]) {
    attrs[key] = def.ent + (entShape[key] ?? 0) + jitter(`${def.id}:ent:${key}`, 3);
  }
  attrs.crowdConnection = Math.round((attrs.crowdConnection + def.pop) / 2);
  attrs.bigMatch = def.ovr + jitter(`${def.id}:big`, 3) + (def.brand === "legends" ? 2 : 0);
  attrs.tagChemistry = def.team ? 78 + jitter(`${def.id}:tag`, 6) : 58 + jitter(`${def.id}:tag`, 8);

  // Calibrate in-ring attributes until the formula overall hits the target.
  for (let i = 0; i < 60; i++) {
    for (const key of ATTRIBUTE_KEYS) attrs[key] = clampN(attrs[key], 25, 99);
    const current = formulaOverall(attrs, def.style);
    if (current === def.ovr) break;
    const step = current < def.ovr ? 1 : -1;
    for (const key of IN_RING_KEYS) attrs[key] += step;
  }
  for (const key of ATTRIBUTE_KEYS) attrs[key] = clampN(attrs[key], 25, 99);
  return attrs;
}

function appearance(def: WrestlerDef): Appearance {
  const h = hashString(def.id);
  const bulkFromWeight = Math.max(0, Math.min(1, (def.w - (def.division === "women" ? 110 : 170)) / 200));
  return {
    skinTone: SKIN[h % SKIN.length],
    hairColor: HAIR[(h >> 3) % HAIR.length],
    hairStyle: "short",
    facialHair: "none",
    primaryColor: "#334155",
    secondaryColor: "#f8fafc",
    outfit: "trunks",
    bulk: Math.round(bulkFromWeight * 100) / 100,
    mask: false,
    ...def.look,
  };
}

function weightClass(def: WrestlerDef): Wrestler["weightClass"] {
  if (def.w < 205) return "cruiserweight";
  if (def.w < 235) return "light-heavyweight";
  if (def.w < 300) return "heavyweight";
  return "super-heavyweight";
}

/** Fictional weekly salary in game dollars. Not based on any real contract. */
export function salaryFor(ovr: number, pop: number, legend: boolean) {
  const base = 1500 + Math.max(0, ovr - 60) ** 2 * 18 + pop * 35;
  return Math.round((legend ? base * 1.6 : base) / 100) * 100;
}

const wrestlers: Wrestler[] = WRESTLER_DEFS.map((def) => {
  const attributes = buildAttributes(def);
  const legend = def.brand === "legends";
  const free = def.brand === "free-agents";
  const h = hashString(def.id);
  const trend: Wrestler["trend"] = def.age <= 27 ? "rising" : def.age >= 36 ? "declining" : "peak";
  return {
    id: def.id,
    baseId: def.versionOf ?? null,
    versionLabel: def.versionLabel ?? null,
    name: def.name,
    ringName: def.ringName,
    nickname: def.nickname,
    brand: def.brand,
    division: def.division,
    weightClass: weightClass(def),
    weightLbs: def.w,
    heightIn: def.h,
    age: def.age,
    era: def.era,
    style: def.style,
    alignment: def.alignment,
    attributes,
    overallOverride: null,
    popularity: def.pop,
    potential: Math.max(def.pot, formulaOverall(attributes, def.style)),
    morale: 62 + (h % 25),
    momentum: 45 + ((h >> 5) % 30),
    fatigue: (h >> 9) % 15,
    injury: null,
    finisher: def.finisher,
    signatures: def.sigs,
    theme: def.theme,
    record: { wins: 0, losses: 0, draws: 0 },
    contract: {
      status: legend ? "legend-deal" : free ? "free-agent" : "signed",
      weeklySalary: salaryFor(def.ovr, def.pop, legend),
      weeksRemaining: legend || free ? 0 : 8 + ((h >> 11) % 90),
      signedWeek: 0,
    },
    teamId: def.team ?? null,
    allies: [],
    appearance: appearance(def),
    trend,
    isCustom: false,
    lastMatchWeek: null,
    recentMatches: [],
  } satisfies Wrestler;
});

// Sanity report: target vs produced overall and entertainment.
for (const def of WRESTLER_DEFS) {
  const w = wrestlers.find((x) => x.id === def.id)!;
  const got = formulaOverall(w.attributes, w.style);
  const ent = Math.round(entertainmentRating(w.attributes));
  if (got !== def.ovr) console.warn(`! ${def.id}: target ${def.ovr}, produced ${got}`);
  if (Math.abs(ent - def.ent) > 6) console.warn(`! ${def.id}: entertainment ${ent} vs ${def.ent}`);
}

const out = { generatedFrom: "src/data/roster-source.ts", wrestlers, teams: TEAM_DEFS };
writeFileSync(path.join(__dirname, "../src/data/roster.json"), JSON.stringify(out, null, 1) + "\n");
console.log(`Wrote ${wrestlers.length} wrestlers and ${TEAM_DEFS.length} teams.`);
