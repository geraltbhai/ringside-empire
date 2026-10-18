/**
 * Match & segment simulation. Pure functions: they read the universe and return
 * a result; applying the consequences is done by universe.ts.
 */
import { entertainmentRating, formRating, inRingRating, overall } from "./rating";
import { clamp, type Rng } from "./rng";
import {
  averageOverall,
  lastMeeting,
  matchesInLastWeeks,
  recentForm,
  rivalryForSegment,
  sideName,
  wrestler,
} from "./queries";
import type { Segment, SegmentResult, Show, Stipulation, Universe, Wrestler, WrestlingStyle } from "./types";

export const STIPULATION_LABELS: Record<Stipulation, string> = {
  standard: "Standard",
  "no-dq": "No Disqualification",
  "steel-cage": "Steel Cage",
  ladder: "Ladder",
  submission: "Submission",
  "last-man-standing": "Last Man Standing",
};

/** Stipulation affinity: which attributes help win under each rule set. */
const STIP_AFFINITY: Record<Stipulation, (w: Wrestler) => number> = {
  standard: () => 0,
  "no-dq": (w) => (w.attributes.striking + w.attributes.durability) / 2 - 70,
  "steel-cage": (w) => (w.attributes.strength + w.attributes.agility) / 2 - 70,
  ladder: (w) => (w.attributes.aerial + w.attributes.agility) / 2 - 70,
  submission: (w) => (w.attributes.submission + w.attributes.technical) / 2 - 70,
  "last-man-standing": (w) => (w.attributes.durability + w.attributes.strength) / 2 - 70,
};

const STIP_HYPE: Record<Stipulation, number> = {
  standard: 0,
  "no-dq": 4,
  "steel-cage": 7,
  ladder: 8,
  submission: 3,
  "last-man-standing": 6,
};

/** Style pairings that tend to produce good matches. */
function styleChemistry(a: WrestlingStyle, b: WrestlingStyle): number {
  const pair = [a, b].sort().join("+");
  const table: Record<string, number> = {
    "giant+high-flyer": 6,
    "high-flyer+powerhouse": 5,
    "technician+technician": 6,
    "high-flyer+high-flyer": 5,
    "brawler+brawler": 4,
    "striker+technician": 4,
    "all-rounder+showman": 4,
    "brawler+showman": 3,
    "giant+giant": -4,
    "giant+powerhouse": -1,
    "high-flyer+technician": 3,
    "showman+showman": 3,
    "striker+striker": 4,
  };
  return table[pair] ?? 1;
}

export interface SideStrength {
  ids: string[];
  score: number;
  factors: Record<string, number>;
}

export function sideStrength(universe: Universe, show: Show, seg: Segment, ids: string[]): SideStrength {
  const team = ids.length === 2 ? Object.values(universe.teams).find((t) => t.memberIds.every((m) => ids.includes(m))) : null;
  const members = ids.map((id) => wrestler(universe, id));
  const avg = (fn: (w: Wrestler) => number) => members.reduce((s, w) => s + fn(w), 0) / members.length;
  const stakes = seg.titleId != null || show.type === "ple" || seg.isMainEvent;
  const factors: Record<string, number> = {
    ability: averageOverall(universe, ids),
    popularity: avg((w) => (w.popularity - 70) * 0.08),
    momentum: avg((w) => (w.momentum - 50) * 0.12),
    form: avg((w) => (formRating(w) - 50) * 0.1),
    bigMatch: stakes ? avg((w) => (w.attributes.bigMatch - 75) * 0.1) : 0,
    recentRecord: avg((w) => (recentForm(universe, w.id) - 0.5) * 4),
    stipulation: avg((w) => STIP_AFFINITY[seg.stipulation](w) * 0.12),
    champion: seg.titleId && universe.championships[seg.titleId]?.holderIds.some((h) => ids.includes(h)) ? 4 : 0,
    chemistry: ids.length > 1 ? (team ? (team.chemistry - 70) * 0.15 : avg((w) => (w.attributes.tagChemistry - 70) * 0.08) - 2) : 0,
    injury: avg((w) => (w.injury ? -12 : 0)),
  };
  const score = Object.values(factors).reduce((s, v) => s + v, 0);
  return { ids, score, factors };
}

/** Converts side strengths into win probabilities (softmax, temperature 6, clamped). */
export function winProbabilities(strengths: number[]): number[] {
  const max = Math.max(...strengths);
  const exps = strengths.map((s) => Math.exp((s - max) / 6));
  const total = exps.reduce((a, b) => a + b, 0);
  let probs = exps.map((e) => e / total);
  const floor = strengths.length === 2 ? 0.08 : 0.05;
  probs = probs.map((p) => Math.max(floor, p));
  const norm = probs.reduce((a, b) => a + b, 0);
  return probs.map((p) => p / norm);
}

export function expectedQualityBreakdown(universe: Universe, show: Show, seg: Segment) {
  const ids = [...seg.sideA, ...seg.sideB, ...seg.sideC];
  const members = ids.map((id) => wrestler(universe, id));
  const avg = (fn: (w: Wrestler) => number) => members.reduce((s, w) => s + fn(w), 0) / Math.max(1, members.length);
  const stakesHigh = seg.titleId != null || show.type === "ple" || seg.isMainEvent;
  const rivalry = rivalryForSegment(universe, seg);
  const title = seg.titleId ? universe.championships[seg.titleId] : null;

  const performance =
    avg((w) => inRingRating(w.attributes, w.style, universe.settings) - w.fatigue * 0.12 - (w.injury ? 15 : 0)) +
    (stakesHigh ? avg((w) => (w.attributes.bigMatch - 75) * 0.15) : 0);

  const idealMinutes = seg.matchType === "tag" ? 14 : show.type === "ple" ? 18 : 12;
  const staminaCap = avg((w) => w.attributes.stamina) / 4; // ~20 minutes for 80 stamina
  const durationFit = -Math.abs(seg.durationMin - idealMinutes) * 0.6 - Math.max(0, seg.durationMin - staminaCap) * 1.2;
  const psychology = avg((w) => (w.attributes.psychology + w.attributes.selling) / 2) + durationFit;

  const alignments = new Set(members.map((w) => w.alignment));
  const faceVsHeel = alignments.has("face") && alignments.has("heel") ? 6 : alignments.size === 1 ? -3 : 2;
  const crowd = avg((w) => w.popularity * 0.55 + w.attributes.crowdConnection * 0.45) + faceVsHeel;

  const sides = [seg.sideA, seg.sideB, seg.sideC].filter((s) => s.length);
  const lead = sides.map((s) => wrestler(universe, s[0]).style);
  let chem = 0;
  for (let i = 0; i < lead.length; i++) for (let j = i + 1; j < lead.length; j++) chem += styleChemistry(lead[i], lead[j]);
  const closeness = sides.length > 1 ? -Math.abs(averageOverall(universe, sides[0]) - averageOverall(universe, sides[1])) * 0.35 : 0;
  const reversals = avg((w) => w.attributes.reversal) * 0.8 + chem * 2 + closeness + 12;

  const stakes =
    45 +
    (title ? title.prestige * 0.3 : 0) +
    (rivalry ? rivalry.intensity * 0.25 : 0) +
    (seg.isMainEvent ? 6 : 0) +
    (show.type === "ple" ? 8 : 0) +
    STIP_HYPE[seg.stipulation];

  let repetition = 0;
  if (sides.length >= 2) {
    const last = lastMeeting(universe, sides[0], sides[1]);
    if (last && universe.week - last.week <= 1) repetition -= 8;
    else if (last && universe.week - last.week <= 3) repetition -= 4;
  }
  const overworked = members.filter((w) => matchesInLastWeeks(w, universe.week) >= universe.settings.maxMatchesPerMonth).length;
  const fatiguePenalty = -overworked * 4 - avg((w) => Math.max(0, w.fatigue - 60) * 0.15);

  return {
    performance: clamp(performance),
    psychology: clamp(psychology),
    crowd: clamp(crowd),
    reversals: clamp(reversals),
    stakes: clamp(stakes),
    repetition,
    fatigue: fatiguePenalty,
  };
}

export const QUALITY_WEIGHTS = { performance: 0.36, psychology: 0.14, crowd: 0.18, reversals: 0.12, stakes: 0.2 } as const;

export function combineQuality(b: ReturnType<typeof expectedQualityBreakdown>) {
  return (
    b.performance * QUALITY_WEIGHTS.performance +
    b.psychology * QUALITY_WEIGHTS.psychology +
    b.crowd * QUALITY_WEIGHTS.crowd +
    b.reversals * QUALITY_WEIGHTS.reversals +
    b.stakes * QUALITY_WEIGHTS.stakes +
    b.repetition +
    b.fatigue
  );
}

export const qualityToStars = (quality: number) => clamp(Math.round(((quality - 40) / 11.5) * 4) / 4, 0.25, 5);

function injuryRoll(universe: Universe, seg: Segment, rng: Rng): SegmentResult["injuries"] {
  const ids = [...seg.sideA, ...seg.sideB, ...seg.sideC];
  const stipRisk = seg.stipulation === "standard" || seg.stipulation === "submission" ? 1 : 2;
  const injuries: SegmentResult["injuries"] = [];
  for (const id of ids) {
    const w = wrestler(universe, id);
    const risk = (0.008 + w.fatigue * 0.0003 + (80 - w.attributes.durability) * 0.0002) * stipRisk * (seg.durationMin / 12);
    if (rng.chance(Math.max(0.002, risk))) {
      const weeks = rng.int(1, rng.chance(0.25) ? 8 : 3);
      injuries.push({ wrestlerId: id, weeks, description: rng.pick(["Knee sprain", "Shoulder strain", "Concussion protocol", "Rib injury", "Ankle sprain", "Neck stinger", "Torn pectoral"]) });
    }
  }
  return injuries;
}

const OPENERS = [
  "{a} and {b} locked up at a frantic pace from the bell.",
  "A cautious feeling-out process gave way to a fierce exchange between {a} and {b}.",
  "{b} jumped {a} before the bell, setting a chaotic tone.",
  "The crowd split down the middle as {a} and {b} traded holds early.",
  "{a} controlled the opening minutes, grounding {b} with methodical offence.",
];
const MIDDLES = [
  "{loser} rallied with a {loserSig} that drew a huge near-fall.",
  "Momentum swung back and forth; {winner} survived a {loserSig} at two and nine-tenths.",
  "{winner} countered a {loserSig} into a {winnerSig}, but {loser} kicked out.",
  "Both competitors were down after a double clothesline, and the crowd rallied behind them.",
  "{loser} took the fight to the outside and nearly won by count-out.",
  "{winner} weathered a long beatdown before firing up with a {winnerSig}.",
];
const FINISHES_PIN = [
  "{winner} hit the {finisher} and covered for the three-count.",
  "A second {finisher} put {loser} away for good.",
  "{winner} reversed a desperate roll-up and planted {loser} with the {finisher}.",
];
const FINISHES_SUB = [
  "{winner} locked in the {finisher} and {loser} had no choice but to tap.",
  "{loser} fought the {finisher} for nearly a minute before tapping out.",
];
const FINISHES_UPSET = [
  "{winner} caught {loser} in a sudden small package for a stunning upset.",
  "Out of nowhere, {winner} rolled {loser} up and stole the win.",
];
const FINISHES_DQ = [
  "{loser} grabbed a chair and the referee called for the disqualification.",
  "Both men brawled to the floor; {loser} was counted out.",
];
const FINISHES_LMS = ["{loser} could not answer the ten-count after the {finisher} through the announce table."];
const FINISHES_LADDER = ["{winner} climbed over {loser} to pull down the prize after a {finisher} off the ladder."];

function fill(template: string, vars: Record<string, string>) {
  return template.replace(/\{(\w+)\}/g, (_, k) => vars[k] ?? k);
}

export interface SimulationContext {
  universe: Universe;
  show: Show;
  rng: Rng;
}

export function simulateSegment({ universe, show, rng }: SimulationContext, seg: Segment): SegmentResult {
  if (seg.kind !== "match") return simulateTalkSegment({ universe, show, rng }, seg);

  const sides = [seg.sideA, seg.sideB, seg.sideC].filter((s) => s.length > 0);
  const labels = ["A", "B", "C"] as const;
  const strengths = sides.map((ids) => sideStrength(universe, show, seg, ids));
  const probs = winProbabilities(strengths.map((s) => s.score));

  // Winner selection
  let winnerSide: "A" | "B" | "C" | "draw";
  let source: SegmentResult["source"] = "simulated";
  if (seg.playedResult) {
    winnerSide = seg.playedResult.winnerSide;
    source = "played";
  } else if (seg.outcome.mode === "manual") {
    winnerSide = seg.outcome.winnerSide;
    source = "manual";
  } else {
    const drawChance = seg.stipulation === "standard" && !seg.titleId ? 0.02 : 0;
    if (rng.chance(drawChance)) winnerSide = "draw";
    else {
      const r = rng.next();
      let acc = 0;
      winnerSide = labels[sides.length - 1];
      for (let i = 0; i < sides.length; i++) {
        acc += probs[i];
        if (r < acc) {
          winnerSide = labels[i];
          break;
        }
      }
    }
  }

  const winnerIndex = winnerSide === "draw" ? -1 : labels.indexOf(winnerSide);
  const winnerIds = winnerIndex >= 0 ? sides[winnerIndex] : [];
  const loserIds = winnerIndex >= 0 ? sides.filter((_, i) => i !== winnerIndex).flat() : sides.flat();
  const upset = winnerIndex >= 0 && probs[winnerIndex] < 0.35;

  // Quality
  const breakdown = expectedQualityBreakdown(universe, show, seg);
  const variance = rng.normal(0, 4.5);
  let quality = combineQuality(breakdown) + variance + (upset ? 2 : 0);
  if (seg.playedResult) quality = quality * 0.5 + seg.playedResult.quality * 0.5;

  // Finish
  const winnerLead = winnerIds.length ? wrestler(universe, winnerIds[0]) : null;
  const loserLead = loserIds.length ? wrestler(universe, loserIds[0]) : null;
  let finishKind: "pin" | "sub" | "upset" | "dq" | "lms" | "ladder" | "draw" = "pin";
  if (winnerSide === "draw") finishKind = "draw";
  else if (seg.playedResult) finishKind = seg.playedResult.finish.includes("ubmi") ? "sub" : "pin";
  else if (seg.stipulation === "submission") finishKind = "sub";
  else if (seg.stipulation === "last-man-standing") finishKind = "lms";
  else if (seg.stipulation === "ladder") finishKind = "ladder";
  else if (upset && rng.chance(0.5)) finishKind = "upset";
  else if (seg.stipulation === "standard" && rng.chance(0.05)) finishKind = "dq";
  else if (winnerLead && winnerLead.attributes.submission >= 82 && rng.chance(0.4)) finishKind = "sub";
  if (finishKind === "dq") quality -= 6;

  const finishLabel = {
    pin: "Pinfall",
    sub: "Submission",
    upset: "Pinfall (roll-up)",
    dq: "Disqualification / count-out",
    lms: "Ten-count",
    ladder: "Retrieved the prize",
    draw: "Double count-out",
  }[finishKind];

  quality = clamp(Math.round(quality), 5, 100);

  const nameA = sideName(universe, sides[0]);
  const nameB = sideName(universe, sides[1] ?? []);
  const vars = {
    a: nameA,
    b: nameB,
    winner: winnerIds.length ? sideName(universe, winnerIds) : nameA,
    loser: loserLead ? sideName(universe, sides.find((s) => s.includes(loserLead.id)) ?? []) : nameB,
    winnerSig: winnerLead ? rng.pick(winnerLead.signatures) : "big move",
    loserSig: loserLead ? rng.pick(loserLead.signatures) : "big move",
    finisher: winnerLead?.finisher ?? "finisher",
  };
  const finishPool =
    finishKind === "sub" ? FINISHES_SUB
    : finishKind === "upset" ? FINISHES_UPSET
    : finishKind === "dq" ? FINISHES_DQ
    : finishKind === "lms" ? FINISHES_LMS
    : finishKind === "ladder" ? FINISHES_LADDER
    : finishKind === "draw" ? ["Neither side could answer the referee's count — a double count-out draw."]
    : FINISHES_PIN;
  const parts = [fill(rng.pick(OPENERS), vars), fill(rng.pick(MIDDLES), vars), fill(rng.pick(finishPool), vars)];
  if (source === "manual") parts.push("(Booked finish.)");
  if (source === "played") parts.push("(Decided in the ring by the player.)");

  // Championship change: only on a decisive finish (not DQ / count-out / draw).
  let titleChange: SegmentResult["titleChange"] = null;
  if (seg.titleId && winnerIds.length && finishKind !== "dq") {
    const title = universe.championships[seg.titleId];
    const holdersWon = title.holderIds.length > 0 && title.holderIds.every((h) => winnerIds.includes(h));
    if (!holdersWon) titleChange = { titleId: title.id, newHolderIds: [...winnerIds], previousHolderIds: [...title.holderIds] };
  }
  if (titleChange) parts.push(`NEW CHAMPION${winnerIds.length > 1 ? "S" : ""}: ${vars.winner} won the ${universe.championships[titleChange.titleId].name}!`);
  else if (seg.titleId && winnerIds.length) parts.push(finishKind === "dq" ? "The title cannot change hands on a disqualification." : `${vars.winner} retained.`);

  const durationMin = seg.playedResult ? Math.max(1, Math.round(seg.playedResult.durationSec / 60)) : Math.max(2, Math.round(seg.durationMin + rng.normal(0, 1.5)));

  return {
    segmentId: seg.id,
    kind: "match",
    source,
    winnerSide,
    winnerIds,
    loserIds,
    quality,
    stars: qualityToStars(quality),
    durationMin,
    finish: finishLabel,
    summary: parts.join(" "),
    titleChange,
    qualityBreakdown: { ...breakdown, variance: Math.round(variance * 10) / 10, winProbability: winnerIndex >= 0 ? Math.round(probs[winnerIndex] * 100) : 0 },
    injuries: injuryRoll(universe, seg, rng),
  };
}

const PROMO_LINES = {
  promo: [
    "{a} cut a fiery promo that had the crowd hanging on every word.",
    "{a} addressed the audience, laying out their ambitions for the weeks ahead.",
    "{a} delivered a scathing state-of-the-division address.",
  ],
  interview: [
    "In a backstage interview, {a} promised retribution.",
    "{a} sat down for a candid interview about where they stand.",
  ],
  rivalry: [
    "{a} and {b} came face to face; the confrontation exploded into a brawl that took security to separate.",
    "{a} interrupted {b}, and the war of words ended with a cheap shot.",
    "A contract signing between {a} and {b} ended with the table flipped.",
  ],
};

function simulateTalkSegment({ universe, rng }: SimulationContext, seg: Segment): SegmentResult {
  const ids = [...seg.sideA, ...seg.sideB];
  const members = ids.map((id) => wrestler(universe, id));
  const avg = (fn: (w: Wrestler) => number) => members.reduce((s, w) => s + fn(w), 0) / Math.max(1, members.length);
  const rivalry = rivalryForSegment(universe, seg);
  const ent = avg((w) => entertainmentRating(w.attributes));
  const pop = avg((w) => w.popularity);
  const breakdown = {
    entertainment: Math.round(ent),
    popularity: Math.round(pop),
    rivalry: rivalry ? Math.round(rivalry.intensity) : 0,
  };
  const quality = clamp(
    Math.round(ent * 0.62 + pop * 0.23 + (rivalry ? rivalry.intensity * 0.15 + 4 : 6) + (seg.kind === "rivalry" ? 3 : 0) + rng.normal(0, 4)),
    5,
    100,
  );
  const pool = seg.kind === "rivalry" && seg.sideB.length ? PROMO_LINES.rivalry : seg.kind === "interview" ? PROMO_LINES.interview : PROMO_LINES.promo;
  const summary = fill(rng.pick(pool), { a: sideName(universe, seg.sideA), b: sideName(universe, seg.sideB) });
  return {
    segmentId: seg.id,
    kind: seg.kind,
    source: "simulated",
    winnerSide: null,
    winnerIds: [],
    loserIds: [],
    quality,
    stars: qualityToStars(quality),
    durationMin: seg.durationMin,
    finish: "",
    summary,
    titleChange: null,
    qualityBreakdown: breakdown,
    injuries: [],
  };
}

export function overallOf(universe: Universe, id: string) {
  return overall(wrestler(universe, id), universe.settings);
}
