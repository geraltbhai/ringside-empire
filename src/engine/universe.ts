/**
 * Universe state transitions. Every function mutates the universe object it is
 * given; callers (the store) pass a structured clone so React state stays immutable.
 */
import { ensureWeekShows, isPleWeek } from "./calendar";
import { recommendCard, validateShow, hasErrors } from "./booking";
import { recordTransaction, showEconomics, weeklyPayroll, FIXED_WEEKLY_OVERHEAD, starPower } from "./finance";
import { nextId, slugify } from "./ids";
import { formulaOverall, overall } from "./rating";
import { clamp, createRng } from "./rng";
import { rivalryForSegment, sideName, wrestler } from "./queries";
import { simulateSegment } from "./simulation";
import { decayRivalries, progressRivalry, reactToResult } from "./storyline";
import { createUniverse, type NewUniverseOptions } from "../data/seed";
import type {
  Attributes,
  BrandId,
  Championship,
  MatchHistoryEntry,
  PopularityChange,
  Segment,
  SegmentResult,
  Show,
  ShowResult,
  Universe,
  Wrestler,
} from "./types";

const popGain = (pop: number, delta: number) => (delta > 0 ? delta * (1 - pop / 125) : delta * (0.6 + pop / 250));

/** Moves a championship to new holders and maintains lineage. */
export function changeTitleHolders(universe: Universe, title: Championship, newHolders: string[], how: "match" | "vacated") {
  const current = title.reigns.find((r) => r.endWeek == null);
  if (current) {
    current.endWeek = universe.week;
    current.endedBy = how;
  }
  title.holderIds = [...newHolders];
  if (newHolders.length) {
    title.reigns.push({ holderIds: [...newHolders], holderName: sideName(universe, newHolders), startWeek: universe.week, endWeek: null, defenses: 0, endedBy: null });
  }
}

export function vacateTitle(universe: Universe, titleId: string, reason: string) {
  const title = universe.championships[titleId];
  if (!title || !title.holderIds.length) return;
  const holder = sideName(universe, title.holderIds);
  changeTitleHolders(universe, title, [], "vacated");
  title.prestige = clamp(title.prestige - 3);
  universe.news.push({ week: universe.week, text: `The ${title.name} has been vacated (${holder}: ${reason}).`, tone: "title" });
}

export function awardTitle(universe: Universe, titleId: string, holderIds: string[]) {
  const title = universe.championships[titleId];
  changeTitleHolders(universe, title, holderIds, "match");
  universe.news.push({ week: universe.week, text: `${sideName(universe, holderIds)} ${holderIds.length > 1 ? "were" : "was"} awarded the ${title.name}.`, tone: "title" });
}

function applySegmentResult(universe: Universe, show: Show, seg: Segment, res: SegmentResult, popularity: Map<string, number>) {
  const rng = createRng(universe.seed, "story", show.id, seg.id);
  const all = [...seg.sideA, ...seg.sideB, ...seg.sideC];
  const bump = (id: string, d: number) => popularity.set(id, (popularity.get(id) ?? 0) + d);
  const stakes = (seg.titleId ? 1.5 : 1) * (show.type === "ple" ? 1.4 : 1) * (seg.isMainEvent ? 1.2 : 1);

  if (res.kind === "match") {
    for (const id of all) {
      const w = wrestler(universe, id);
      w.fatigue = clamp(w.fatigue + res.durationMin * 1.1 + (seg.stipulation === "standard" ? 0 : 6));
      w.lastMatchWeek = universe.week;
      w.recentMatches = [...w.recentMatches.filter((wk) => wk > universe.week - 4), universe.week];
      w.morale = clamp(w.morale + 1);
      const won = res.winnerIds.includes(id);
      const draw = res.winnerSide === "draw";
      if (draw) w.record.draws++;
      else if (won) w.record.wins++;
      else w.record.losses++;
      const upset = (res.qualityBreakdown.winProbability ?? 50) < 35;
      if (won) {
        w.momentum = clamp(w.momentum + 6 + (upset ? 6 : 0));
        w.morale = clamp(w.morale + 3);
        bump(id, (1 + (res.quality - 55) * 0.05) * stakes + (upset ? 1.5 : 0));
      } else if (!draw) {
        w.momentum = clamp(w.momentum - (res.quality >= 75 ? 2 : 5));
        w.morale = clamp(w.morale - 2);
        bump(id, (res.quality - 65) * 0.03 * stakes - 0.4);
      } else {
        bump(id, (res.quality - 60) * 0.02);
      }
    }
    // Tag-team records
    for (const side of [seg.sideA, seg.sideB]) {
      if (side.length !== 2) continue;
      const team = Object.values(universe.teams).find((t) => t.memberIds.every((m) => side.includes(m)));
      if (!team) continue;
      if (res.winnerSide === "draw") team.record.draws++;
      else if (side.every((id) => res.winnerIds.includes(id))) {
        team.record.wins++;
        team.chemistry = clamp(team.chemistry + 1);
      } else team.record.losses++;
    }
    // Championships
    if (seg.titleId) {
      const title = universe.championships[seg.titleId];
      if (res.titleChange) {
        changeTitleHolders(universe, title, res.titleChange.newHolderIds, "match");
        title.prestige = clamp(title.prestige + (res.quality - 60) * 0.06 + 1);
        for (const id of res.titleChange.newHolderIds) {
          bump(id, 3 * (title.prestige / 80));
          wrestler(universe, id).morale = clamp(wrestler(universe, id).morale + 10);
        }
        universe.news.push({ week: universe.week, text: `${sideName(universe, res.titleChange.newHolderIds)} won the ${title.name} at ${show.name}!`, tone: "title" });
      } else if (title.holderIds.length) {
        const reign = title.reigns.find((r) => r.endWeek == null);
        if (reign && res.winnerIds.length && res.finish !== "Disqualification / count-out") reign.defenses++;
        title.prestige = clamp(title.prestige + (res.quality - 62) * 0.04);
      }
    }
    // Injuries
    for (const inj of res.injuries) {
      const w = wrestler(universe, inj.wrestlerId);
      w.injury = { description: inj.description, weeksRemaining: inj.weeks };
      universe.news.push({ week: universe.week, text: `${w.ringName} suffered a ${inj.description.toLowerCase()} and is out ~${inj.weeks} week${inj.weeks > 1 ? "s" : ""}.`, tone: "bad" });
    }
    const entry: MatchHistoryEntry = {
      id: nextId(universe, "m"),
      week: universe.week,
      showId: show.id,
      showName: show.name,
      source: res.source,
      matchType: seg.matchType,
      stipulation: seg.stipulation,
      sideA: [...seg.sideA],
      sideB: [...seg.sideB],
      sideC: [...seg.sideC],
      winnerIds: [...res.winnerIds],
      quality: res.quality,
      stars: res.stars,
      titleId: seg.titleId,
      titleChange: res.titleChange != null,
      summary: res.summary,
    };
    universe.history.push(entry);
  } else {
    for (const id of all) {
      const w = wrestler(universe, id);
      bump(id, (res.quality - 60) * 0.04 * (show.type === "ple" ? 1.3 : 1));
      w.morale = clamp(w.morale + (res.quality >= 70 ? 2 : 0));
      w.momentum = clamp(w.momentum + (res.quality - 60) * 0.05);
    }
  }

  // Storylines
  const rivalry = rivalryForSegment(universe, seg);
  if (rivalry && rivalry.status !== "resolved") progressRivalry(universe, rivalry, res, show.type === "ple", rng);
  reactToResult(universe, res);
}

/** Simulates a planned show, applies every consequence and returns the result. */
export function runShow(universe: Universe, showId: string): ShowResult {
  const show = universe.shows.find((s) => s.id === showId);
  if (!show) throw new Error("Show not found");
  if (show.status === "completed") throw new Error("Show already completed");
  const issues = validateShow(universe, show);
  if (hasErrors(issues)) throw new Error(issues.filter((i) => i.level === "error").map((i) => i.message).join(" "));

  const rng = createRng(universe.seed, "show", show.id);
  // Implicit main event: the last match.
  if (!show.segments.some((s) => s.isMainEvent)) {
    const lastMatch = [...show.segments].reverse().find((s) => s.kind === "match");
    if (lastMatch) lastMatch.isMainEvent = true;
  }
  const booked = [...new Set(show.segments.flatMap((s) => [...s.sideA, ...s.sideB, ...s.sideC]))];
  const preStarPower = starPower(universe, booked);
  const popularity = new Map<string, number>();
  const results: SegmentResult[] = [];
  const notes: string[] = [];

  for (const seg of show.segments) {
    const res = simulateSegment({ universe, show, rng }, seg);
    results.push(res);
    applySegmentResult(universe, show, seg, res, popularity);
  }

  // Show rating
  const matchResults = results.filter((r) => r.kind === "match");
  const avgMatchQuality = matchResults.length ? matchResults.reduce((s, r) => s + r.quality, 0) / matchResults.length : 0;
  const mainSeg = show.segments.find((s) => s.isMainEvent) ?? show.segments[show.segments.length - 1];
  const mainEventQuality = results.find((r) => r.segmentId === mainSeg?.id)?.quality ?? 0;
  let weightSum = 0;
  let weighted = 0;
  results.forEach((r, i) => {
    const seg = show.segments[i];
    const w = seg.isMainEvent ? 2 : r.kind === "match" ? 1 : 0.6;
    weighted += r.quality * w;
    weightSum += w;
  });
  const segmentScore = weightSum ? weighted / weightSum : 0;
  const storyScore = (() => {
    const featured = show.segments.map((s) => rivalryForSegment(universe, s)).filter(Boolean);
    if (!featured.length) return 35;
    return featured.reduce((sum, r) => sum + r!.intensity, 0) / featured.length;
  })();
  let rating = segmentScore * 0.45 + mainEventQuality * 0.25 + preStarPower * 0.15 + storyScore * 0.15;
  const minSegments = show.type === "ple" ? 5 : 4;
  if (show.segments.length < minSegments) {
    rating -= (minSegments - show.segments.length) * 4;
    notes.push(`A thin card (${show.segments.length} segments) disappointed fans.`);
  }
  if (show.type === "ple" && !show.segments.some((s) => s.titleId)) {
    rating -= 6;
    notes.push("No championship was on the line at a premium live event.");
  }
  const repeats = matchResults.filter((r) => (r.qualityBreakdown.repetition ?? 0) < 0).length;
  if (repeats) notes.push(`${repeats} rematch${repeats > 1 ? "es" : ""} felt repetitive.`);
  if (mainEventQuality < 55 && mainSeg) notes.push("The main event fell flat.");
  if (mainEventQuality >= 85) notes.push("The main event was a classic.");
  rating = clamp(Math.round(rating));

  const injuriesCount = results.reduce((s, r) => s + r.injuries.length, 0);
  const econ = showEconomics(universe, show, rating, booked, injuriesCount, rng.normal(0, 0.03));
  const expectation = 45 + universe.audienceDemand * 0.3;
  const fanSatisfaction = clamp(Math.round(50 + (rating - expectation) * 1.4));

  // Popularity changes
  const popularityChanges: PopularityChange[] = [];
  for (const [id, raw] of popularity) {
    const w = wrestler(universe, id);
    const delta = popGain(w.popularity, raw);
    w.popularity = clamp(w.popularity + delta, 1, 100);
    popularityChanges.push({ wrestlerId: id, delta: Math.round(delta * 10) / 10 });
  }
  popularityChanges.sort((a, b) => b.delta - a.delta);

  // Brand + audience demand
  const brandIds: BrandId[] = show.brand === "joint" ? ["mayhem", "fury"] : [show.brand as BrandId];
  const brandDelta = clamp((rating - 70) * 0.07, -3, 3);
  for (const id of brandIds) {
    const brand = universe.brands[id];
    brand.popularity = clamp(brand.popularity + popGain(brand.popularity, brandDelta));
    brand.reputation = clamp(brand.reputation + (rating - 70) * 0.03);
    brand.history.push({ week: universe.week, rating, viewership: econ.viewership, profit: econ.profit / brandIds.length });
  }
  universe.audienceDemand = clamp(universe.audienceDemand + (rating - 68) * 0.06 - repeats * 0.4, 20, 95);

  // Money
  const txBrand = show.brand;
  for (const [k, v] of Object.entries(econ.revenue)) recordTransaction(universe, k as never, v, `${show.name} ${k}`, txBrand);
  for (const [k, v] of Object.entries(econ.expenses)) recordTransaction(universe, k as never, -v, `${show.name} ${k}`, txBrand);

  const result: ShowResult = {
    rating,
    stars: Math.round((rating / 20) * 4) / 4,
    avgMatchQuality: Math.round(avgMatchQuality),
    mainEventQuality,
    attendance: econ.attendance,
    viewership: econ.viewership,
    fanSatisfaction,
    revenue: econ.revenue,
    expenses: econ.expenses,
    profit: econ.profit,
    brandPopularityDelta: Math.round(brandDelta * 10) / 10,
    popularityChanges,
    segments: results,
    notes,
  };
  show.result = result;
  show.status = "completed";
  universe.news.push({ week: universe.week, text: `${show.name} drew ${econ.attendance.toLocaleString()} fans and scored a ${rating} rating (${result.stars}★).`, tone: rating >= 70 ? "good" : rating < 50 ? "bad" : "neutral" });
  return result;
}

/** Fills an empty planned show with the AI Booker's recommended card. */
export function autoBookShow(universe: Universe, showId: string) {
  const show = universe.shows.find((s) => s.id === showId);
  if (!show || show.status !== "planned") return;
  show.segments = recommendCard(universe, show).map((s) => s.segment);
}

/** Drops segments that are no longer valid (e.g. a wrestler got injured earlier in the week). */
export function repairShow(universe: Universe, showId: string): string[] {
  const show = universe.shows.find((s) => s.id === showId);
  if (!show) return [];
  const removed: string[] = [];
  for (let i = 0; i < 12; i++) {
    const errors = validateShow(universe, show).filter((x) => x.level === "error" && x.segmentId);
    if (!errors.length) break;
    const bad = new Set(errors.map((e) => e.segmentId));
    removed.push(...show.segments.filter((s) => bad.has(s.id)).map((s) => s.label));
    show.segments = show.segments.filter((s) => !bad.has(s.id));
  }
  return removed;
}

/**
 * Plays out the rest of the week in day order: books any empty card with the AI
 * Booker, repairs cards invalidated by earlier injuries, and runs each show.
 */
export function simulateRemainingWeek(universe: Universe) {
  const results: { showId: string; name: string; rating: number; removed: string[] }[] = [];
  const planned = universe.shows
    .filter((s) => s.week === universe.week && s.status === "planned")
    .sort((a, b) => a.dayOffset - b.dayOffset);
  for (const show of planned) {
    if (show.segments.length === 0) autoBookShow(universe, show.id);
    const removed = repairShow(universe, show.id);
    if (show.segments.length === 0) autoBookShow(universe, show.id);
    const result = runShow(universe, show.id);
    results.push({ showId: show.id, name: show.name, rating: result.rating, removed });
  }
  return results;
}

export function canAdvance(universe: Universe) {
  return universe.shows.filter((s) => s.week === universe.week).every((s) => s.status === "completed");
}

/** Weekly tick: payroll, recovery, injuries, contracts, development, rivalries, next week's shows. */
export function advanceWeek(universe: Universe) {
  if (!canAdvance(universe)) throw new Error("Complete or simulate this week's shows before advancing.");
  const rng = createRng(universe.seed, "week", universe.week);
  const bookedThisWeek = new Set(
    universe.shows.filter((s) => s.week === universe.week).flatMap((s) => s.segments.flatMap((g) => [...g.sideA, ...g.sideB, ...g.sideC])),
  );

  // Payroll and overhead
  for (const brand of ["mayhem", "fury"] as const) {
    recordTransaction(universe, "salaries", -weeklyPayroll(universe, brand), `${universe.brands[brand].showName} payroll`, brand);
  }
  recordTransaction(universe, "production", -FIXED_WEEKLY_OVERHEAD, "Office, travel & staff overhead", null);

  for (const w of Object.values(universe.wrestlers)) {
    const signed = w.brand === "mayhem" || w.brand === "fury";
    // Recovery
    w.fatigue = clamp(w.fatigue - (14 + w.attributes.recovery * 0.08));
    if (w.injury) {
      w.injury.weeksRemaining -= 1;
      if (w.injury.weeksRemaining <= 0) {
        universe.news.push({ week: universe.week, text: `${w.ringName} has been medically cleared.`, tone: "good" });
        w.injury = null;
      }
    }
    if (!signed) continue;
    // Morale & visibility
    if (!bookedThisWeek.has(w.id)) {
      w.morale = clamp(w.morale - (w.popularity >= 80 ? 3 : 1.5));
      w.momentum = clamp(w.momentum - 1.5);
      if (w.lastMatchWeek != null && universe.week - w.lastMatchWeek >= 3) w.popularity = clamp(w.popularity - 0.5);
    }
    w.momentum = clamp(w.momentum + (50 - w.momentum) * 0.04);
    // Contracts
    w.contract.weeksRemaining -= 1;
    if (w.contract.weeksRemaining === 4) universe.news.push({ week: universe.week, text: `${w.ringName}'s contract expires in 4 weeks.`, tone: "neutral" });
    if (w.contract.weeksRemaining <= 0) {
      if (universe.settings.autoRenewContracts && w.morale >= 45 && w.contract.status === "signed") {
        w.contract = { ...w.contract, weeklySalary: askingSalary(universe, w), weeksRemaining: 52, signedWeek: universe.week };
        universe.news.push({ week: universe.week, text: `${w.ringName} auto-renewed for 52 weeks at $${w.contract.weeklySalary.toLocaleString()}/week.`, tone: "neutral" });
      } else expireContract(universe, w);
    }
  }

  // Development every 4 weeks (age-based, toward potential).
  if (universe.week % 4 === 3) {
    for (const w of Object.values(universe.wrestlers)) {
      if (w.brand !== "mayhem" && w.brand !== "fury") continue;
      const ovr = formulaOverall(w.attributes, w.style, universe.settings);
      const keys = Object.keys(w.attributes) as (keyof Attributes)[];
      if (w.age <= 30 && w.potential > ovr && rng.chance(0.55 + (w.morale - 50) / 200)) {
        for (let i = 0; i < 2; i++) {
          const k = rng.pick(keys);
          w.attributes[k] = clamp(w.attributes[k] + 1, 1, 99);
        }
        w.trend = "rising";
      } else if (w.age >= 36 && rng.chance(0.35)) {
        for (const k of ["speed", "agility", "stamina", "recovery"] as const) {
          if (rng.chance(0.5)) w.attributes[k] = clamp(w.attributes[k] - 1, 1, 99);
        }
        w.trend = "declining";
      }
    }
  }
  // Age a year every 52 weeks.
  if (universe.week > 0 && universe.week % 52 === 51) for (const w of Object.values(universe.wrestlers)) w.age += 1;

  decayRivalries(universe);
  universe.week += 1;
  ensureWeekShows(universe, universe.week);
  ensureWeekShows(universe, universe.week + 1);
  universe.updatedAt = new Date().toISOString();
  // Keep news bounded
  if (universe.news.length > 300) universe.news = universe.news.slice(-300);
}

function expireContract(universe: Universe, w: Wrestler) {
  for (const title of Object.values(universe.championships)) {
    if (title.holderIds.includes(w.id)) vacateTitle(universe, title.id, "contract expired");
  }
  const legend = w.contract.status === "legend-deal";
  w.brand = legend ? "legends" : "free-agents";
  w.contract = { status: legend ? "legend-deal" : "free-agent", weeklySalary: askingSalary(universe, w), weeksRemaining: 0, signedWeek: w.contract.signedWeek };
  w.morale = clamp(w.morale - 5);
  universe.news.push({ week: universe.week, text: `${w.ringName}'s contract expired. They are now ${legend ? "back in the Legends pool" : "a free agent"}.`, tone: "bad" });
}

// ───────── Contracts ─────────

/** Fictional asking salary — derived from overall, popularity and morale. */
export function askingSalary(universe: Universe, w: Wrestler) {
  const ovr = overall(w, universe.settings);
  const legend = w.brand === "legends" || w.contract.status === "legend-deal";
  const base = 1500 + Math.max(0, ovr - 60) ** 2 * 18 + w.popularity * 35;
  const moraleFactor = 1 + (60 - w.morale) / 300;
  return Math.round(((legend ? base * 1.6 : base) * moraleFactor) / 100) * 100;
}

export interface ContractOffer {
  weeklySalary: number;
  weeks: number;
  signingBonus: number;
  brand: "mayhem" | "fury";
}

export interface OfferEvaluation {
  accepted: boolean;
  interest: number;
  asking: number;
  message: string;
  counter: ContractOffer | null;
}

export function evaluateOffer(universe: Universe, w: Wrestler, offer: ContractOffer): OfferEvaluation {
  const asking = askingSalary(universe, w);
  const legend = w.brand === "legends" || w.contract.status === "legend-deal";
  const value = offer.weeklySalary + offer.signingBonus / Math.max(4, offer.weeks);
  const brandPull = (universe.brands[offer.brand].popularity - 60) / 100;
  const lengthPref = legend ? (offer.weeks <= 12 ? 0.05 : -0.15) : w.age >= 33 ? (offer.weeks >= 52 ? 0.08 : 0) : offer.weeks <= 52 ? 0.04 : -0.02;
  const interest = value / asking + brandPull * 0.3 + lengthPref + (w.morale - 60) / 400;
  if (legend && offer.weeks > 26) return { accepted: false, interest, asking, message: `${w.ringName} will only sign short legend deals (26 weeks or fewer).`, counter: { ...offer, weeks: 12 } };
  if (offer.weeks < 4 || offer.weeks > 260) return { accepted: false, interest, asking, message: "Contract length must be between 4 and 260 weeks.", counter: null };
  if (interest >= 1) return { accepted: true, interest, asking, message: `${w.ringName} accepted the offer!`, counter: null };
  const counterSalary = Math.round((asking * (1.02 - brandPull * 0.3 - lengthPref)) / 100) * 100;
  return {
    accepted: false,
    interest,
    asking,
    message: interest > 0.85 ? `${w.ringName} is close — they want about $${counterSalary.toLocaleString()}/week.` : `${w.ringName}'s camp rejected the offer as too low.`,
    counter: { ...offer, weeklySalary: counterSalary },
  };
}

export function signWrestler(universe: Universe, wrestlerId: string, offer: ContractOffer): OfferEvaluation {
  const w = wrestler(universe, wrestlerId);
  const ev = evaluateOffer(universe, w, offer);
  if (!ev.accepted) return ev;
  if (universe.cash < offer.signingBonus) return { ...ev, accepted: false, message: "Not enough cash for the signing bonus." };
  const legend = w.brand === "legends" || w.contract.status === "legend-deal";
  w.brand = offer.brand;
  w.contract = { status: legend ? "legend-deal" : "signed", weeklySalary: offer.weeklySalary, weeksRemaining: offer.weeks, signedWeek: universe.week };
  w.morale = clamp(w.morale + 8);
  recordTransaction(universe, "signing", -offer.signingBonus, `Signing bonus: ${w.ringName}`, offer.brand);
  universe.news.push({ week: universe.week, text: `${w.ringName} signed with ${universe.brands[offer.brand].showName} for ${offer.weeks} weeks.`, tone: "good" });
  return ev;
}

export function renewContract(universe: Universe, wrestlerId: string, offer: Omit<ContractOffer, "brand">): OfferEvaluation {
  const w = wrestler(universe, wrestlerId);
  const brand = w.brand === "fury" ? "fury" : "mayhem";
  const ev = evaluateOffer(universe, w, { ...offer, brand });
  if (!ev.accepted) return ev;
  if (universe.cash < offer.signingBonus) return { ...ev, accepted: false, message: "Not enough cash for the signing bonus." };
  w.contract = { ...w.contract, weeklySalary: offer.weeklySalary, weeksRemaining: offer.weeks, signedWeek: universe.week };
  w.morale = clamp(w.morale + 5);
  recordTransaction(universe, "signing", -offer.signingBonus, `Renewal bonus: ${w.ringName}`, brand);
  universe.news.push({ week: universe.week, text: `${w.ringName} re-signed for ${offer.weeks} weeks.`, tone: "good" });
  return { ...ev, message: `${w.ringName} re-signed!` };
}

export function releaseWrestler(universe: Universe, wrestlerId: string) {
  const w = wrestler(universe, wrestlerId);
  const brand = w.brand as BrandId;
  const severance = Math.round(w.contract.weeklySalary * w.contract.weeksRemaining * 0.25);
  for (const title of Object.values(universe.championships)) if (title.holderIds.includes(w.id)) vacateTitle(universe, title.id, "released");
  recordTransaction(universe, "salaries", -severance, `Severance: ${w.ringName}`, brand);
  const legend = w.contract.status === "legend-deal";
  w.brand = legend ? "legends" : "free-agents";
  w.contract = { status: legend ? "legend-deal" : "free-agent", weeklySalary: askingSalary(universe, w), weeksRemaining: 0, signedWeek: w.contract.signedWeek };
  w.morale = clamp(w.morale - 15);
  for (const other of Object.values(universe.wrestlers)) if (other.brand === brand) other.morale = clamp(other.morale - 1);
  universe.news.push({ week: universe.week, text: `${w.ringName} has been released (severance $${severance.toLocaleString()}).`, tone: "bad" });
  return severance;
}

// ───────── Roster management ─────────

export function transferWrestler(universe: Universe, wrestlerId: string, to: "mayhem" | "fury") {
  const w = wrestler(universe, wrestlerId);
  if (w.brand === to) return;
  if (w.brand !== "mayhem" && w.brand !== "fury") throw new Error("Only contracted wrestlers can be transferred.");
  const from = w.brand;
  for (const title of Object.values(universe.championships)) {
    if (title.holderIds.includes(w.id) && title.brand !== "shared" && title.brand !== to) vacateTitle(universe, title.id, `moved to ${universe.brands[to].showName}`);
  }
  w.brand = to;
  if (w.teamId) {
    const team = universe.teams[w.teamId];
    const partner = team.memberIds.find((m) => m !== w.id);
    if (partner && universe.wrestlers[partner].brand === from) {
      universe.wrestlers[partner].brand = to;
    }
    team.brand = to;
  }
  universe.news.push({ week: universe.week, text: `${w.ringName}${w.teamId ? ` (with ${universe.teams[w.teamId].name})` : ""} moved from ${universe.brands[from].showName} to ${universe.brands[to].showName}.`, tone: "neutral" });
}

export function tradeWrestlers(universe: Universe, aId: string, bId: string) {
  const a = wrestler(universe, aId);
  const b = wrestler(universe, bId);
  if (a.brand === b.brand) throw new Error("Trades must be between different brands.");
  const aTo = b.brand as "mayhem" | "fury";
  const bTo = a.brand as "mayhem" | "fury";
  transferWrestler(universe, aId, aTo);
  transferWrestler(universe, bId, bTo);
}

export function updateWrestler(universe: Universe, id: string, patch: Partial<Wrestler>) {
  const w = wrestler(universe, id);
  Object.assign(w, patch);
  if (patch.attributes) {
    for (const k of Object.keys(w.attributes) as (keyof Attributes)[]) w.attributes[k] = Math.round(clamp(w.attributes[k], 1, 100));
  }
  w.popularity = clamp(w.popularity, 1, 100);
  w.potential = clamp(w.potential, 1, 100);
  w.morale = clamp(w.morale);
  w.momentum = clamp(w.momentum);
  w.fatigue = clamp(w.fatigue);
}

export function restoreDefaults(universe: Universe, id: string) {
  const w = wrestler(universe, id);
  const d = universe.defaults[id];
  if (!d) return;
  w.attributes = { ...d.attributes };
  w.popularity = d.popularity;
  w.potential = d.potential;
  w.overallOverride = d.overallOverride;
}

/** Brings a wrestler's look (body, hair, gear) back to how they started this universe. */
export function restoreLook(universe: Universe, id: string) {
  const look = universe.defaults[id]?.appearance;
  if (look) wrestler(universe, id).appearance = { ...look };
}

export function createAlternateVersion(universe: Universe, baseId: string, label: string): Wrestler {
  const base = wrestler(universe, baseId);
  const id = `${slugify(base.id)}-${slugify(label) || "alt"}-${universe.counters.nextId}`;
  universe.counters.nextId++;
  const copy: Wrestler = {
    ...structuredClone(base),
    id,
    baseId: base.baseId ?? base.id,
    versionLabel: label,
    brand: "free-agents",
    contract: { status: "free-agent", weeklySalary: askingSalary(universe, base), weeksRemaining: 0, signedWeek: universe.week },
    teamId: null,
    record: { wins: 0, losses: 0, draws: 0 },
    isCustom: true,
    lastMatchWeek: null,
    recentMatches: [],
    injury: null,
  };
  universe.wrestlers[id] = copy;
  universe.defaults[id] = { attributes: { ...copy.attributes }, popularity: copy.popularity, potential: copy.potential, overallOverride: copy.overallOverride, appearance: { ...copy.appearance } };
  return copy;
}

export function createCustomWrestler(universe: Universe, w: Omit<Wrestler, "id">): Wrestler {
  const id = `${slugify(w.ringName) || "custom"}-${universe.counters.nextId}`;
  universe.counters.nextId++;
  const created: Wrestler = { ...w, id, isCustom: true };
  universe.wrestlers[id] = created;
  universe.defaults[id] = { attributes: { ...created.attributes }, popularity: created.popularity, potential: created.potential, overallOverride: created.overallOverride, appearance: { ...created.appearance } };
  return created;
}

export function createTeam(universe: Universe, name: string, a: string, b: string) {
  const wa = wrestler(universe, a);
  const wb = wrestler(universe, b);
  if (wa.division !== wb.division) throw new Error("Tag partners must be in the same division.");
  for (const w of [wa, wb]) if (w.teamId) disbandTeam(universe, w.teamId);
  const id = nextId(universe, "team");
  universe.teams[id] = { id, name, memberIds: [a, b], brand: wa.brand, chemistry: Math.round((wa.attributes.tagChemistry + wb.attributes.tagChemistry) / 2), record: { wins: 0, losses: 0, draws: 0 } };
  wa.teamId = id;
  wb.teamId = id;
  return universe.teams[id];
}

export function disbandTeam(universe: Universe, teamId: string) {
  const team = universe.teams[teamId];
  if (!team) return;
  for (const title of Object.values(universe.championships)) {
    if (title.isTag && title.holderIds.every((h) => team.memberIds.includes(h)) && title.holderIds.length) vacateTitle(universe, title.id, "team disbanded");
  }
  for (const m of team.memberIds) if (universe.wrestlers[m]) universe.wrestlers[m].teamId = null;
  delete universe.teams[teamId];
}

/** Records a playable exhibition match result (not tied to a show). */
export function recordExhibition(
  universe: Universe,
  input: { sideA: string[]; sideB: string[]; winnerIds: string[]; quality: number; titleId: string | null; durationSec: number; finish: string },
) {
  const show: Show = {
    id: "exhibition",
    name: "Exhibition",
    brand: "joint",
    type: "weekly",
    week: universe.week,
    dayOffset: 0,
    venueId: universe.venues[0].id,
    ticketPrice: 0,
    marketingSpend: 0,
    segments: [],
    status: "completed",
    result: null,
  };
  const winnerSide: "A" | "B" = input.sideA.every((id) => input.winnerIds.includes(id)) ? "A" : "B";
  const seg: Segment = {
    id: nextId(universe, "seg"),
    kind: "match",
    label: "Exhibition",
    matchType: input.sideA.length === 2 ? "tag" : "singles",
    stipulation: "standard",
    sideA: input.sideA,
    sideB: input.sideB,
    sideC: [],
    titleId: input.titleId,
    rivalryId: null,
    durationMin: Math.max(1, Math.round(input.durationSec / 60)),
    outcome: { mode: "simulate" },
    isMainEvent: true,
    playedResult: { winnerSide, quality: input.quality, durationSec: input.durationSec, finish: input.finish },
  };
  const res = simulateSegment({ universe, show, rng: createRng(universe.seed, "exhibition", seg.id) }, seg);
  const map = new Map<string, number>();
  applySegmentResult(universe, show, seg, res, map);
  for (const [id, raw] of map) {
    const w = wrestler(universe, id);
    w.popularity = clamp(w.popularity + popGain(w.popularity, raw * 0.5), 1, 100);
  }
  const last = universe.history[universe.history.length - 1];
  if (last) last.source = "played";
  return res;
}

export { isPleWeek };

/** Creates a brand-new universe with its first two weeks of shows scheduled. */
export function startUniverse(options: NewUniverseOptions): Universe {
  const universe = createUniverse(options);
  ensureWeekShows(universe, 0);
  ensureWeekShows(universe, 1);
  return universe;
}


/**
 * Balanced brand draft: champions stay put, tag teams are drafted as a unit,
 * and the two brands pick alternately (snake order) by a star-value score.
 */
export function runDraft(universe: Universe) {
  const champs = new Set(Object.values(universe.championships).flatMap((c) => c.holderIds));
  const units: { ids: string[]; value: number }[] = [];
  const seen = new Set<string>();
  for (const w of Object.values(universe.wrestlers)) {
    if ((w.brand !== "mayhem" && w.brand !== "fury") || seen.has(w.id)) continue;
    const team = w.teamId ? universe.teams[w.teamId] : null;
    const ids = team ? [...team.memberIds] : [w.id];
    ids.forEach((id) => seen.add(id));
    if (ids.some((id) => champs.has(id))) continue;
    const value = ids.reduce((s, id) => s + overall(universe.wrestlers[id], universe.settings) * 0.6 + universe.wrestlers[id].popularity * 0.4, 0) / ids.length;
    units.push({ ids, value });
  }
  units.sort((a, b) => b.value - a.value);
  const order: ("mayhem" | "fury")[] = [];
  const first = universe.brands.mayhem.popularity <= universe.brands.fury.popularity ? "mayhem" : "fury";
  const second = first === "mayhem" ? "fury" : "mayhem";
  units.forEach((_, i) => order.push(Math.floor(i / 2) % 2 === 0 ? (i % 2 === 0 ? first : second) : i % 2 === 0 ? second : first));
  let moved = 0;
  units.forEach((unit, i) => {
    const to = order[i];
    for (const id of unit.ids) {
      if (universe.wrestlers[id].brand !== to) moved++;
      universe.wrestlers[id].brand = to;
    }
    const team = Object.values(universe.teams).find((t) => t.memberIds.every((m) => unit.ids.includes(m)));
    if (team) team.brand = to;
  });
  // Rivalries that now span two brands are paused.
  for (const r of Object.values(universe.rivalries)) {
    if (r.status !== "active") continue;
    const brands = new Set([...r.sideA, ...r.sideB].map((id) => universe.wrestlers[id].brand));
    if (brands.size > 1) {
      r.status = "paused";
      r.events.push({ week: universe.week, text: "The draft split these rivals onto different brands." });
    } else r.brand = [...brands][0];
  }
  universe.news.push({ week: universe.week, text: `The brand draft moved ${moved} wrestlers. ${universe.brands[first].showName} had the first pick.`, tone: "neutral" });
  return moved;
}
