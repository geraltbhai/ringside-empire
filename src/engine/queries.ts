import { overall } from "./rating";
import type { BrandId, Championship, MatchHistoryEntry, Rivalry, Segment, Universe, Wrestler } from "./types";

export function wrestler(universe: Universe, id: string): Wrestler {
  const w = universe.wrestlers[id];
  if (!w) throw new Error(`Unknown wrestler ${id}`);
  return w;
}

export function sideName(universe: Universe, ids: string[]) {
  if (ids.length === 0) return "TBD";
  if (ids.length === 2) {
    const team = Object.values(universe.teams).find((t) => t.memberIds.every((m) => ids.includes(m)));
    if (team) return team.name;
  }
  return ids.map((id) => universe.wrestlers[id]?.ringName ?? "Unknown").join(" & ");
}

export function isSigned(w: Wrestler) {
  return w.brand === "mayhem" || w.brand === "fury";
}

export function brandRoster(universe: Universe, brand: BrandId) {
  return Object.values(universe.wrestlers).filter((w) => w.brand === brand);
}

export function championshipsHeldBy(universe: Universe, id: string): Championship[] {
  return Object.values(universe.championships).filter((c) => c.holderIds.includes(id));
}

export function isChampion(universe: Universe, id: string) {
  return championshipsHeldBy(universe, id).length > 0;
}

export function activeRivalriesFor(universe: Universe, id: string): Rivalry[] {
  return Object.values(universe.rivalries).filter(
    (r) => r.status === "active" && (r.sideA.includes(id) || r.sideB.includes(id)),
  );
}

export function sameSet(a: string[], b: string[]) {
  return a.length === b.length && a.every((x) => b.includes(x));
}

/** Finds an active rivalry whose two sides are both represented in a segment. */
export function rivalryForSegment(universe: Universe, seg: Pick<Segment, "sideA" | "sideB" | "sideC" | "rivalryId">): Rivalry | null {
  if (seg.rivalryId && universe.rivalries[seg.rivalryId]) return universe.rivalries[seg.rivalryId];
  const all = [...seg.sideA, ...seg.sideB, ...seg.sideC];
  return (
    Object.values(universe.rivalries).find(
      (r) => r.status !== "resolved" && r.sideA.some((x) => all.includes(x)) && r.sideB.some((x) => all.includes(x)),
    ) ?? null
  );
}

export function averageOverall(universe: Universe, ids: string[]) {
  if (ids.length === 0) return 0;
  return ids.reduce((s, id) => s + overall(wrestler(universe, id), universe.settings), 0) / ids.length;
}

export function recentForm(universe: Universe, id: string, last = 5) {
  const matches = universe.history.filter((h) => [...h.sideA, ...h.sideB, ...h.sideC].includes(id)).slice(-last);
  if (matches.length === 0) return 0.5;
  const wins = matches.filter((m) => m.winnerIds.includes(id)).length;
  return wins / matches.length;
}

export function lastMeeting(universe: Universe, a: string[], b: string[]): MatchHistoryEntry | null {
  for (let i = universe.history.length - 1; i >= 0; i--) {
    const h = universe.history[i];
    const sides = [h.sideA, h.sideB, h.sideC];
    if (sides.some((s) => sameSet(s, a)) && sides.some((s) => sameSet(s, b))) return h;
  }
  return null;
}

export function matchesInLastWeeks(w: Wrestler, currentWeek: number, weeks = 4) {
  return w.recentMatches.filter((wk) => wk > currentWeek - weeks).length;
}

export function weeksSinceDefense(universe: Universe, titleId: string) {
  const last = [...universe.history].reverse().find((h) => h.titleId === titleId);
  const title = universe.championships[titleId];
  const reign = title?.reigns.find((r) => r.endWeek == null);
  const since = last ? last.week : reign ? reign.startWeek : -10;
  return universe.week - since;
}
