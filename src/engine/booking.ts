/**
 * Booking engine: segment factory, validation, and the heuristic AI Booker.
 * The AI Booker is fully deterministic (no external API) and explains its picks.
 */
import { overall } from "./rating";
import { clamp } from "./rng";
import { combineQuality, expectedQualityBreakdown } from "./simulation";
import { lastMeeting, matchesInLastWeeks, sideName, weeksSinceDefense } from "./queries";
import { nextId } from "./ids";
import type { BrandId, Segment, SegmentKind, Show, Universe, Wrestler } from "./types";

export function newSegment(universe: Universe, kind: SegmentKind, partial: Partial<Segment> = {}): Segment {
  return {
    id: nextId(universe, "seg"),
    kind,
    label: kind === "match" ? "Match" : kind === "promo" ? "Promo" : kind === "interview" ? "Interview" : "Rivalry segment",
    matchType: "singles",
    stipulation: "standard",
    sideA: [],
    sideB: [],
    sideC: [],
    titleId: null,
    rivalryId: null,
    durationMin: kind === "match" ? 12 : 5,
    outcome: { mode: "simulate" },
    isMainEvent: false,
    playedResult: null,
    ...partial,
  };
}

export interface BookingIssue {
  level: "error" | "warning";
  segmentId: string | null;
  message: string;
}

export function eligibleForShow(universe: Universe, show: Show, w: Wrestler) {
  if (w.brand !== "mayhem" && w.brand !== "fury") return false;
  if (show.brand === "joint" || universe.settings.allowCrossBrand) return true;
  return w.brand === show.brand;
}

export function validateShow(universe: Universe, show: Show): BookingIssue[] {
  const issues: BookingIssue[] = [];
  const err = (segmentId: string | null, message: string) => issues.push({ level: "error", segmentId, message });
  const warn = (segmentId: string | null, message: string) => issues.push({ level: "warning", segmentId, message });

  if (show.segments.length === 0) err(null, "The card is empty — add at least one segment.");
  if (show.segments.length > 10) err(null, "A show can have at most 10 segments.");
  if (show.ticketPrice < 5 || show.ticketPrice > 500) err(null, "Ticket price must be between $5 and $500.");
  if (show.marketingSpend < 0) err(null, "Marketing spend cannot be negative.");
  const mainEvents = show.segments.filter((s) => s.isMainEvent);
  if (mainEvents.length > 1) err(null, "Only one segment can be the main event.");
  if (show.segments.length > 0 && mainEvents.length === 0) warn(null, "No main event selected — the last match will be treated as the main event.");
  if (!universe.venues.some((v) => v.id === show.venueId)) err(null, "Choose a valid venue.");

  const appearances = new Map<string, number>();
  for (const seg of show.segments) {
    const ids = [...seg.sideA, ...seg.sideB, ...seg.sideC];
    if (seg.kind === "match") {
      for (const id of ids) appearances.set(id, (appearances.get(id) ?? 0) + 1);
    }
    for (const id of ids) {
      const w = universe.wrestlers[id];
      if (!w) {
        err(seg.id, `Unknown wrestler id "${id}".`);
        continue;
      }
      if (!eligibleForShow(universe, show, w)) {
        err(seg.id, w.brand === "legends" || w.brand === "free-agents" ? `${w.ringName} is not under contract — sign them first.` : `${w.ringName} is on ${universe.brands[w.brand].showName}. Enable cross-brand booking or use a joint event.`);
      }
      if (w.injury && seg.kind === "match") err(seg.id, `${w.ringName} is injured (${w.injury.description}, ${w.injury.weeksRemaining} wk) and cannot wrestle.`);
      if (w.injury && seg.kind !== "match") warn(seg.id, `${w.ringName} is injured — they can appear in a talking segment only.`);
      if (seg.kind === "match" && w.fatigue >= 75) warn(seg.id, `${w.ringName} is exhausted (fatigue ${Math.round(w.fatigue)}). Match quality and injury risk will suffer.`);
      if (seg.kind === "match" && matchesInLastWeeks(w, universe.week) >= universe.settings.maxMatchesPerMonth) warn(seg.id, `${w.ringName} is overworked this month.`);
    }

    if (seg.kind === "match") {
      if (seg.durationMin < 3 || seg.durationMin > 60) err(seg.id, "Match duration must be between 3 and 60 minutes.");
      const expected = seg.matchType === "tag" ? [2, 2, 0] : seg.matchType === "triple-threat" ? [1, 1, 1] : [1, 1, 0];
      const actual = [seg.sideA.length, seg.sideB.length, seg.sideC.length];
      if (actual.some((n, i) => n !== expected[i])) {
        err(seg.id, seg.matchType === "tag" ? "Tag matches need exactly two wrestlers per side." : seg.matchType === "triple-threat" ? "Triple threats need one wrestler on each of three sides." : "Singles matches need one wrestler on each side.");
      }
      const divisions = new Set(ids.map((id) => universe.wrestlers[id]?.division));
      if (divisions.size > 1) err(seg.id, "Mixed-division matches are not supported — keep men's and women's matches separate.");
      if (new Set(ids).size !== ids.length) err(seg.id, "The same wrestler is on more than one side.");
      if (seg.titleId) {
        const title = universe.championships[seg.titleId];
        if (!title) err(seg.id, "Unknown championship.");
        else {
          if (title.isTag !== (seg.matchType === "tag")) err(seg.id, title.isTag ? `The ${title.shortName} title needs a tag-team match.` : `The ${title.shortName} title cannot be defended in a tag match.`);
          if (title.holderIds.length && !title.holderIds.every((h) => ids.includes(h))) err(seg.id, `The champion${title.holderIds.length > 1 ? "s" : ""} (${sideName(universe, title.holderIds)}) must be in a title match.`);
          if (divisions.size === 1 && !divisions.has(title.division)) err(seg.id, `The ${title.shortName} title belongs to the ${title.division}'s division.`);
          if (show.brand !== "joint" && title.brand !== "shared" && title.brand !== show.brand) err(seg.id, `The ${title.shortName} title belongs to ${universe.brands[title.brand as BrandId].showName}.`);
          const dupe = show.segments.find((o) => o.id !== seg.id && o.titleId === seg.titleId);
          if (dupe) err(seg.id, `The ${title.shortName} title is already on the line elsewhere on this card.`);
        }
      }
      if (seg.outcome.mode === "manual") {
        const w = seg.outcome.winnerSide;
        if (w === "C" && seg.matchType !== "triple-threat") err(seg.id, "Side C does not exist in this match.");
        if (w === "draw" && seg.titleId) warn(seg.id, "A draw means the champion retains.");
      }
      if (seg.sideA.length && seg.sideB.length) {
        const last = lastMeeting(universe, seg.sideA, seg.sideB);
        if (last && universe.week - last.week <= 1) warn(seg.id, `${sideName(universe, seg.sideA)} vs ${sideName(universe, seg.sideB)} happened last week — fans may tire of it.`);
      }
    } else {
      if (seg.sideA.length === 0) err(seg.id, "Talking segments need at least one participant.");
      if (seg.kind === "rivalry" && seg.sideB.length === 0) err(seg.id, "A rivalry segment needs someone on each side.");
    }
  }
  for (const [id, count] of appearances) {
    if (count > 1) err(null, `${universe.wrestlers[id]?.ringName ?? id} is booked in ${count} matches on the same show.`);
  }
  // Same-week conflict: one wrestler on two different shows' matches the same night is impossible (different nights are fine).
  return issues;
}

export const hasErrors = (issues: BookingIssue[]) => issues.some((i) => i.level === "error");

export interface Suggestion {
  segment: Segment;
  score: number;
  expectedQuality: number;
  reasons: string[];
}

function available(universe: Universe, show: Show) {
  return Object.values(universe.wrestlers).filter((w) => eligibleForShow(universe, show, w) && !w.injury && w.fatigue < 85);
}

function quickScore(universe: Universe, show: Show, seg: Segment) {
  const q = clamp(combineQuality(expectedQualityBreakdown(universe, show, seg)));
  return q;
}

/** Builds a recommended card. Every suggestion carries a score and its reasons. */
export function recommendCard(universe: Universe, show: Show): Suggestion[] {
  const s = universe.settings;
  const pool = available(universe, show);
  const used = new Set<string>();
  const out: Suggestion[] = [];
  const isFree = (ids: string[]) => ids.every((id) => !used.has(id) && pool.some((w) => w.id === id));
  const take = (ids: string[]) => ids.forEach((id) => used.add(id));
  const ovr = (w: Wrestler) => overall(w, s);
  const maxSegments = show.type === "ple" ? 8 : 7;
  const brands: BrandId[] = show.brand === "joint" ? ["mayhem", "fury"] : [show.brand as BrandId];

  const push = (seg: Segment, reasons: string[], storyValue: number) => {
    const q = seg.kind === "match" ? quickScore(universe, show, seg) : 55;
    const ids = [...seg.sideA, ...seg.sideB, ...seg.sideC];
    const star = ids.reduce((a, id) => a + universe.wrestlers[id].popularity, 0) / Math.max(1, ids.length);
    const score = Math.round(q * 0.5 + storyValue * 0.3 + star * 0.2);
    out.push({ segment: seg, score, expectedQuality: Math.round(q), reasons });
    take(ids);
  };

  // 1. Active rivalries, by intensity.
  const rivalries = Object.values(universe.rivalries)
    .filter((r) => r.status === "active" && (brands.includes(r.brand) || show.brand === "joint"))
    .sort((a, b) => b.intensity - a.intensity);
  for (const r of rivalries) {
    if (out.length >= maxSegments - 2) break;
    if (!isFree([...r.sideA, ...r.sideB])) continue;
    const tag = r.sideA.length === 2 && r.sideB.length === 2;
    const title = r.titleId ? universe.championships[r.titleId] : null;
    const titleOk = title && title.holderIds.length > 0 && title.holderIds.every((h) => r.sideA.includes(h) || r.sideB.includes(h));
    const payoffNow = show.type === "ple" && r.stage >= 2;
    const metLastWeek = (() => {
      const last = lastMeeting(universe, r.sideA, r.sideB);
      return last != null && universe.week - last.week <= 1;
    })();
    if (show.type === "weekly" && (r.stage <= 1 || metLastWeek)) {
      push(
        newSegment(universe, "rivalry", { label: "Rivalry confrontation", sideA: [...r.sideA], sideB: [...r.sideB], rivalryId: r.id, durationMin: 6 }),
        [`Builds the ${sideName(universe, r.sideA)} vs ${sideName(universe, r.sideB)} story (stage ${r.stage + 1}/5).`, `Rivalry intensity ${Math.round(r.intensity)} — a confrontation escalates it without spending the big match.`],
        60 + r.intensity * 0.4,
      );
      continue;
    }
    const seg = newSegment(universe, "match", {
      label: payoffNow ? "Rivalry payoff" : "Rivalry match",
      matchType: tag ? "tag" : "singles",
      sideA: [...r.sideA],
      sideB: [...r.sideB],
      rivalryId: r.id,
      titleId: payoffNow && titleOk ? title!.id : null,
      stipulation: payoffNow && r.intensity >= 80 ? (r.payoff === "grudge-match" ? "no-dq" : "steel-cage") : "standard",
      durationMin: payoffNow ? 20 : 12,
    });
    // Don't defend titles in weekly rivalry matches unless prestige needs it.
    push(
      seg,
      [
        payoffNow ? `Pays off a stage-${r.stage + 1} rivalry on the big stage.` : `Keeps the ${sideName(universe, r.sideA)}–${sideName(universe, r.sideB)} feud hot.`,
        seg.titleId ? `The ${title!.shortName} title is on the line.` : `Intensity ${Math.round(r.intensity)}, fan interest ${Math.round(r.fanInterest)}.`,
        ...(seg.stipulation !== "standard" ? [`A ${seg.stipulation.replace(/-/g, " ")} stipulation suits a feud this heated.`] : []),
      ],
      70 + r.intensity * 0.3,
    );
  }

  // 2. Title defenses that are overdue.
  for (const title of Object.values(universe.championships)) {
    if (out.length >= maxSegments - 1) break;
    if (!title.holderIds.length || !isFree(title.holderIds)) continue;
    if (title.brand !== "shared" && !brands.includes(title.brand as BrandId)) continue;
    if (title.brand === "shared" && show.brand !== "joint" && show.type !== "ple" && universe.week % 2 === 1) continue;
    const idle = weeksSinceDefense(universe, title.id);
    if (show.type !== "ple" && idle < 3) continue;
    let challengers: string[] | null = null;
    if (title.isTag) {
      const team = Object.values(universe.teams)
        .filter((t) => isFree(t.memberIds) && !t.memberIds.some((m) => title.holderIds.includes(m)) && universe.wrestlers[t.memberIds[0]].division === title.division && (title.brand === "shared" || t.brand === title.brand))
        .sort((a, b) => b.chemistry - a.chemistry)[0];
      challengers = team ? [...team.memberIds] : null;
    } else {
      const champ = universe.wrestlers[title.holderIds[0]];
      const best = pool
        .filter((w) => !used.has(w.id) && w.division === title.division && !title.holderIds.includes(w.id) && (title.brand === "shared" || w.brand === title.brand))
        .filter((w) => title.tier === "world" || title.tier === "womens-world" || !Object.values(universe.championships).some((c) => c.holderIds.includes(w.id)))
        .sort((a, b) => {
          const score = (w: Wrestler) => ovr(w) * 0.5 + w.popularity * 0.35 + w.momentum * 0.15 + (w.alignment !== champ.alignment ? 4 : 0);
          return score(b) - score(a);
        })[0];
      challengers = best ? [best.id] : null;
    }
    if (!challengers) continue;
    push(
      newSegment(universe, "match", {
        label: `${title.shortName} title match`,
        matchType: title.isTag ? "tag" : "singles",
        sideA: [...title.holderIds],
        sideB: challengers,
        titleId: title.id,
        durationMin: show.type === "ple" ? 16 : 14,
      }),
      [`${sideName(universe, title.holderIds)} hasn't defended in ${idle} week${idle === 1 ? "" : "s"}.`, `${sideName(universe, challengers)} is the most credible available challenger.`, `Title prestige ${Math.round(title.prestige)}.`],
      65 + title.prestige * 0.25,
    );
  }

  // 3. Opening promo from the most popular unused star.
  if (show.type === "weekly" && out.length < maxSegments) {
    const talker = pool.filter((w) => !used.has(w.id)).sort((a, b) => b.attributes.promo + b.popularity - (a.attributes.promo + a.popularity))[0];
    if (talker) {
      const seg = newSegment(universe, "promo", { label: "Opening promo", sideA: [talker.id], durationMin: 6 });
      out.unshift({ segment: seg, score: Math.round((talker.attributes.promo + talker.popularity) / 2), expectedQuality: Math.round(talker.attributes.promo * 0.9), reasons: [`${talker.ringName} has the best promo skills (${talker.attributes.promo}) still available.`, "Opens the show hot and keeps them visible."] });
      used.add(talker.id);
    }
  }

  // 4. Fill with well-matched singles and tag matches.
  const free = () => pool.filter((w) => !used.has(w.id));
  let guard = 0;
  while (out.length < maxSegments && guard++ < 20) {
    const teams = Object.values(universe.teams).filter((t) => isFree(t.memberIds) && brands.includes(t.brand));
    if (teams.length >= 2 && !out.some((x) => x.segment.matchType === "tag" && x.segment.kind === "match")) {
      const sorted = teams.sort((a, b) => b.chemistry - a.chemistry);
      const t1 = sorted[0];
      const t2 = sorted.find((t) => t !== t1 && universe.wrestlers[t.memberIds[0]].division === universe.wrestlers[t1.memberIds[0]].division);
      if (!t2) {
        t1.memberIds.forEach((id) => used.add(id));
        continue;
      }
      push(newSegment(universe, "match", { label: "Tag-team match", matchType: "tag", sideA: [...t1.memberIds], sideB: [...t2.memberIds], durationMin: 12 }), [`Gives the tag division TV time.`, `${t1.name} (chemistry ${t1.chemistry}) vs ${t2.name}.`], 55);
      continue;
    }
    const candidates = free().sort((a, b) => b.momentum + b.popularity - (a.momentum + a.popularity));
    const lead = candidates[0];
    if (!lead) break;
    const opp = candidates
      .slice(1)
      .filter((o) => o.division === lead.division)
      .map((o) => {
        const last = lastMeeting(universe, [lead.id], [o.id]);
        const recentPenalty = last && universe.week - last.week <= 3 ? 20 : 0;
        return { o, fit: -Math.abs(ovr(o) - ovr(lead)) + (o.alignment !== lead.alignment ? 6 : 0) - recentPenalty - o.fatigue * 0.1 };
      })
      .sort((a, b) => b.fit - a.fit)[0]?.o;
    if (!opp) {
      used.add(lead.id);
      continue;
    }
    push(
      newSegment(universe, "match", { label: "Singles match", sideA: [lead.id], sideB: [opp.id], durationMin: 10 }),
      [`${lead.ringName} has momentum ${Math.round(lead.momentum)} and needs a showcase.`, `${opp.ringName} is a close match on paper (${ovr(lead)} vs ${ovr(opp)}${lead.alignment !== opp.alignment ? ", face vs heel" : ""}).`],
      45,
    );
  }

  // Main event: best-scoring match goes last.
  const matches = out.filter((x) => x.segment.kind === "match");
  const main = [...matches].sort((a, b) => b.score - a.score)[0];
  if (main) {
    main.segment.isMainEvent = true;
    main.segment.durationMin = Math.max(main.segment.durationMin, show.type === "ple" ? 22 : 16);
    main.reasons.push("Highest projected score on the card — booked as the main event.");
    const rest = out.filter((x) => x !== main);
    return [...rest, main];
  }
  return out;
}
