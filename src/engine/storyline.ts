/**
 * Storyline engine: rivalry progression, event narration and context-aware
 * suggestions. Templates are chosen by stage and event type with a seeded RNG,
 * and recent events are excluded so the same sentence is not repeated.
 */
import { overall } from "./rating";
import { clamp, createRng, type Rng } from "./rng";
import { isChampion, sideName, wrestler } from "./queries";
import { nextId } from "./ids";
import type { Rivalry, RivalryPayoff, RivalryStage, RivalryTheme, SegmentResult, Stipulation, Universe } from "./types";

type EventKind = "match-win" | "match-loss" | "draw" | "talk" | "title-change" | "upset" | "decay";

const TEMPLATES: Record<EventKind, string[][]> = {
  // index = stage at the time of the event
  "match-win": [
    ["{w} drew first blood against {l}.", "{w} sent a message to {l} with a clean win."],
    ["{w} answered {l}'s taunts with a hard-fought victory.", "{l} is reeling after another loss to {w}."],
    ["{w} gained the upper hand in the war with {l}.", "{w} beat {l} and stood tall with the crowd on their feet."],
    ["{w} won the biggest battle yet against {l}.", "{w} conquered {l} on the grandest stage."],
    ["{w} put the final exclamation point on the rivalry with {l}."],
  ],
  "match-loss": [["{l} came up short against {w}."]],
  draw: [["{a} and {b} fought to a standstill — nothing is settled."], ["Neither {a} nor {b} would stay down; the score remains unsettled."]],
  talk: [
    ["{a} made it personal with {b} in front of a live crowd.", "{a} called out {b}, and the gauntlet is down."],
    ["Tempers boiled over between {a} and {b}.", "{a} and {b} had to be separated by officials."],
    ["{a} and {b} came face to face in a tense confrontation.", "A contract signing between {a} and {b} turned violent."],
    ["{a} and {b} made final statements before their showdown."],
    ["{a} and {b} shared a moment of respect after everything they've been through."],
  ],
  "title-change": [["{w} took the gold from {l} — the war has changed shape."]],
  upset: [["{w} shocked the world by beating {l}!", "Nobody gave {w} a chance against {l}. Nobody."]],
  decay: [["The heat between {a} and {b} is cooling off."]],
};

function narrate(rng: Rng, rivalry: Rivalry, kind: EventKind, vars: Record<string, string>) {
  const pool = TEMPLATES[kind][Math.min(rivalry.stage, TEMPLATES[kind].length - 1)];
  const recent = new Set(rivalry.events.slice(-4).map((e) => e.text));
  const options = pool.map((t) => t.replace(/\{(\w+)\}/g, (_, k) => vars[k] ?? k));
  const fresh = options.filter((o) => !recent.has(o));
  return rng.pick(fresh.length ? fresh : options);
}

/** Story theme, inferred for rivalries saved before themes existed. */
export function rivalryTheme(r: Pick<Rivalry, "theme" | "titleId">): RivalryTheme {
  return r.theme ?? (r.titleId ? "title-pursuit" : "personal");
}

export function sideOf(rivalry: Rivalry, ids: string[]): "A" | "B" | null {
  if (rivalry.sideA.some((x) => ids.includes(x))) return "A";
  if (rivalry.sideB.some((x) => ids.includes(x))) return "B";
  return null;
}

/** Advances a rivalry based on a segment result. Mutates the rivalry. */
export function progressRivalry(universe: Universe, rivalry: Rivalry, result: SegmentResult, isPle: boolean, rng: Rng) {
  const a = sideName(universe, rivalry.sideA);
  const b = sideName(universe, rivalry.sideB);
  const qualityBoost = (result.quality - 55) * 0.15;
  rivalry.lastActiveWeek = universe.week;
  if (rivalry.status === "paused") rivalry.status = "active";

  if (result.kind === "match") {
    const winSide = sideOf(rivalry, result.winnerIds);
    if (winSide === "A") rivalry.aWins++;
    if (winSide === "B") rivalry.bWins++;
    const w = winSide === "A" ? a : b;
    const l = winSide === "A" ? b : a;
    const kind: EventKind = result.titleChange ? "title-change" : (result.qualityBreakdown.winProbability ?? 50) < 35 ? "upset" : winSide ? "match-win" : "draw";
    rivalry.events.push({ week: universe.week, text: narrate(rng, rivalry, kind, { w, l, a, b }) });
    rivalry.intensity = clamp(rivalry.intensity + 6 + qualityBoost + (result.titleChange ? 8 : 0));
    rivalry.fanInterest = clamp(rivalry.fanInterest + qualityBoost * 1.2 + 2);
    // A decisive match at a premium event (or a title change) resolves a mature rivalry.
    if ((isPle && rivalry.stage >= 3 && winSide) || (rivalry.stage >= 3 && result.titleChange)) {
      rivalry.stage = 4;
      rivalry.status = "resolved";
      rivalry.events.push({ week: universe.week, text: `Resolution: ${w} won the rivalry ${Math.max(rivalry.aWins, rivalry.bWins)}–${Math.min(rivalry.aWins, rivalry.bWins)}.` });
      return;
    }
    if (rivalry.stage < 3) rivalry.stage = (rivalry.stage + (isPle ? 2 : 1) > 3 ? 3 : rivalry.stage + (isPle ? 2 : 1)) as RivalryStage;
  } else {
    const quote = result.dialogue?.find((l) => l.speakerId);
    const said = quote ? ` ${universe.wrestlers[quote.speakerId!]?.ringName}: "${quote.text}"` : "";
    rivalry.events.push({ week: universe.week, text: narrate(rng, rivalry, "talk", { a, b }) + said });
    rivalry.intensity = clamp(rivalry.intensity + 8 + qualityBoost);
    rivalry.fanInterest = clamp(rivalry.fanInterest + qualityBoost + 3);
    if (rivalry.stage < 2) rivalry.stage = (rivalry.stage + 1) as RivalryStage;
    else if (rivalry.stage === 2 && rivalry.intensity >= 70) rivalry.stage = 3;
  }
}

/** Weekly decay for rivalries that were not featured. */
export function decayRivalries(universe: Universe) {
  const rng = createRng(universe.seed, "decay", universe.week);
  for (const r of Object.values(universe.rivalries)) {
    if (r.status !== "active" || r.lastActiveWeek >= universe.week) continue;
    r.intensity = clamp(r.intensity - 4);
    r.fanInterest = clamp(r.fanInterest - 2);
    if (r.intensity < 15) {
      r.status = "resolved";
      r.events.push({ week: universe.week, text: narrate(rng, r, "decay", { a: sideName(universe, r.sideA), b: sideName(universe, r.sideB) }) + " The rivalry fizzled out." });
      universe.news.push({ week: universe.week, text: `The ${sideName(universe, r.sideA)} vs ${sideName(universe, r.sideB)} rivalry fizzled out from neglect.`, tone: "bad" });
    }
  }
}

export function createRivalry(
  universe: Universe,
  input: { sideA: string[]; sideB: string[]; payoff: RivalryPayoff; titleId: string | null; origin: string; intensity?: number; theme?: RivalryTheme; stipulation?: Stipulation },
): Rivalry {
  const brandOf = wrestler(universe, input.sideA[0]).brand;
  const rivalry: Rivalry = {
    id: nextId(universe, "riv"),
    sideA: input.sideA,
    sideB: input.sideB,
    brand: brandOf,
    intensity: input.intensity ?? 35,
    fanInterest: 40,
    stage: 0,
    startWeek: universe.week,
    lastActiveWeek: universe.week,
    status: "active",
    payoff: input.payoff,
    titleId: input.titleId,
    aWins: 0,
    bWins: 0,
    events: [{ week: universe.week, text: input.origin }],
    origin: input.origin,
    theme: input.theme ?? (input.titleId ? "title-pursuit" : "personal"),
    stipulation: input.stipulation,
  };
  universe.rivalries[rivalry.id] = rivalry;
  return rivalry;
}

export function hasActiveRivalry(universe: Universe, a: string[], b: string[]) {
  return Object.values(universe.rivalries).some(
    (r) =>
      r.status !== "resolved" &&
      ((r.sideA.some((x) => a.includes(x)) && r.sideB.some((x) => b.includes(x))) ||
        (r.sideA.some((x) => b.includes(x)) && r.sideB.some((x) => a.includes(x)))),
  );
}

/** Automatic storyline reactions to a result (rematches, upset feuds). */
export function reactToResult(universe: Universe, result: SegmentResult) {
  if (result.kind !== "match" || result.winnerIds.length === 0) return;
  if (result.titleChange && result.titleChange.previousHolderIds.length) {
    const prev = result.titleChange.previousHolderIds;
    const next = result.titleChange.newHolderIds;
    if (!hasActiveRivalry(universe, prev, next)) {
      const title = universe.championships[result.titleChange.titleId];
      createRivalry(universe, {
        sideA: prev,
        sideB: next,
        payoff: title.isTag ? "tag-showdown" : "title-match",
        titleId: title.id,
        origin: `${sideName(universe, prev)} invoked a rematch for the ${title.shortName} title.`,
        intensity: 45,
        theme: "revenge",
      });
    }
  }
  const prob = result.qualityBreakdown.winProbability ?? 50;
  if (prob < 25 && !hasActiveRivalry(universe, result.winnerIds, result.loserIds) && result.loserIds.length <= 2) {
    createRivalry(universe, {
      sideA: result.winnerIds,
      sideB: result.loserIds,
      payoff: "grudge-match",
      titleId: null,
      origin: `${sideName(universe, result.winnerIds)} stunned ${sideName(universe, result.loserIds)}, who now wants revenge.`,
      intensity: 38,
      theme: "jealousy",
    });
  }
}

export interface StorySuggestion {
  id: string;
  title: string;
  description: string;
  action:
    | { type: "create-rivalry"; sideA: string[]; sideB: string[]; payoff: RivalryPayoff; titleId: string | null; origin: string; theme?: RivalryTheme }
    | { type: "turn"; wrestlerId: string; to: "face" | "heel" }
    | { type: "split-team"; teamId: string };
}

/** Context-aware suggestions shown on the Rivalries screen. */
export function storySuggestions(universe: Universe): StorySuggestion[] {
  const out: StorySuggestion[] = [];
  const s = universe.settings;
  // 1. Champions without a challenger.
  for (const title of Object.values(universe.championships)) {
    if (!title.holderIds.length) continue;
    const engaged = Object.values(universe.rivalries).some((r) => r.status === "active" && (r.titleId === title.id || r.sideA.concat(r.sideB).some((x) => title.holderIds.includes(x))));
    if (engaged) continue;
    const brand = title.brand;
    const contenders = Object.values(universe.wrestlers)
      .filter((w) => (brand === "shared" ? w.brand === "mayhem" || w.brand === "fury" : w.brand === brand) && w.division === title.division && !title.holderIds.includes(w.id) && !w.injury)
      .filter((w) => (title.isTag ? w.teamId && !universe.teams[w.teamId].memberIds.some((m) => title.holderIds.includes(m)) : true))
      .sort((x, y) => overall(y, s) * 0.6 + y.popularity * 0.4 - (overall(x, s) * 0.6 + x.popularity * 0.4));
    const best = contenders[0];
    if (!best) continue;
    const sideB = title.isTag && best.teamId ? [...universe.teams[best.teamId].memberIds] : [best.id];
    out.push({
      id: `contender-${title.id}`,
      title: `Number-one contender for the ${title.shortName} title`,
      description: `${sideName(universe, sideB)} is the strongest available challenger for ${sideName(universe, title.holderIds)}.`,
      action: { type: "create-rivalry", sideA: sideB, sideB: [...title.holderIds], payoff: title.isTag ? "tag-showdown" : "title-match", titleId: title.id, origin: `${sideName(universe, sideB)} earned a shot at ${sideName(universe, title.holderIds)}.` },
    });
  }
  // 2. Popular heels / unpopular faces → turn suggestions.
  for (const w of Object.values(universe.wrestlers)) {
    if (w.brand !== "mayhem" && w.brand !== "fury") continue;
    if (w.alignment === "heel" && w.popularity >= 86 && w.attributes.charisma >= 85) {
      out.push({ id: `turn-${w.id}`, title: `Face turn for ${w.ringName}?`, description: `Fans are cheering ${w.ringName} despite their villainy (popularity ${Math.round(w.popularity)}).`, action: { type: "turn", wrestlerId: w.id, to: "face" } });
    }
    if (w.alignment === "face" && w.momentum <= 25 && w.popularity < 72) {
      out.push({ id: `turn-${w.id}`, title: `Heel turn for ${w.ringName}?`, description: `${w.ringName} has lost the crowd and their momentum (${Math.round(w.momentum)}). A betrayal could reignite them.`, action: { type: "turn", wrestlerId: w.id, to: "heel" } });
    }
  }
  // 3. Struggling tag teams → split.
  for (const team of Object.values(universe.teams)) {
    const games = team.record.wins + team.record.losses;
    if (games >= 4 && team.record.losses / games >= 0.7) {
      out.push({ id: `split-${team.id}`, title: `${team.name} are falling apart`, description: `They've lost ${team.record.losses} of ${games}. A betrayal would launch a singles rivalry.`, action: { type: "split-team", teamId: team.id } });
    }
  }
  // 4. Rising stars with no program.
  const busy = new Set(Object.values(universe.rivalries).filter((r) => r.status === "active").flatMap((r) => [...r.sideA, ...r.sideB]));
  const risers = Object.values(universe.wrestlers)
    .filter((w) => (w.brand === "mayhem" || w.brand === "fury") && !busy.has(w.id) && w.momentum >= 65 && !isChampion(universe, w.id))
    .slice(0, 3);
  for (const r of risers) {
    const opp = Object.values(universe.wrestlers).find((o) => o.brand === r.brand && o.division === r.division && o.alignment !== r.alignment && !busy.has(o.id) && o.id !== r.id && Math.abs(overall(o, s) - overall(r, s)) <= 5);
    if (!opp) continue;
    out.push({ id: `riser-${r.id}`, title: `Build ${r.ringName} with a program`, description: `${r.ringName} is hot (momentum ${Math.round(r.momentum)}). ${opp.ringName} is a well-matched opponent.`, action: { type: "create-rivalry", sideA: [r.id], sideB: [opp.id], payoff: "grudge-match", titleId: null, origin: `${opp.ringName} took exception to ${r.ringName}'s rise.`, theme: Math.abs(opp.age - r.age) >= 10 ? "legacy" : "jealousy" } });
  }
  return out.slice(0, 10);
}
