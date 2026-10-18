import { PLE_NAMES } from "../data/seed";
import type { BrandId, Show, Universe } from "./types";
import { nextId } from "./ids";

/** Every 4th week ends with a joint premium live event on Sunday. */
export const isPleWeek = (week: number) => week % 4 === 3;

export function pleNameForWeek(week: number) {
  const index = Math.floor(week / 4) % PLE_NAMES.length;
  return PLE_NAMES[index];
}

export function dateForWeek(startDate: string, week: number, dayOffset = 0): Date {
  const d = new Date(`${startDate}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() + week * 7 + dayOffset);
  return d;
}

export function formatGameDate(startDate: string, week: number, dayOffset = 0) {
  return dateForWeek(startDate, week, dayOffset).toLocaleDateString("en-US", {
    weekday: "short",
    month: "short",
    day: "numeric",
    year: "numeric",
    timeZone: "UTC",
  });
}

function defaultVenueFor(universe: Universe, type: Show["type"], week: number, brand: BrandId | "joint") {
  const arenas = universe.venues.filter((v) => v.tier === "arena");
  const stadiums = universe.venues.filter((v) => v.tier === "stadium");
  if (type === "ple") {
    const big = Math.floor(week / 4) % 3 === 2;
    return (big ? stadiums[stadiums.length - 1] : stadiums[0] ?? arenas[arenas.length - 1]).id;
  }
  const offset = brand === "fury" ? 2 : 0;
  return arenas[(week + offset) % arenas.length].id;
}

/** Ensures the planned shows for a given week exist (idempotent). */
export function ensureWeekShows(universe: Universe, week: number): Show[] {
  const created: Show[] = [];
  const has = (pred: (s: Show) => boolean) => universe.shows.some((s) => s.week === week && pred(s));
  for (const brandId of ["mayhem", "fury"] as const) {
    const brand = universe.brands[brandId];
    if (!has((s) => s.brand === brandId && s.type === "weekly")) {
      const show: Show = {
        id: nextId(universe, "show"),
        name: brand.showName,
        brand: brandId,
        type: "weekly",
        week,
        dayOffset: brand.showDayOffset,
        venueId: defaultVenueFor(universe, "weekly", week, brandId),
        ticketPrice: 45,
        marketingSpend: 40_000,
        segments: [],
        status: "planned",
        result: null,
      };
      universe.shows.push(show);
      created.push(show);
    }
  }
  if (isPleWeek(week) && !has((s) => s.type === "ple")) {
    const show: Show = {
      id: nextId(universe, "show"),
      name: pleNameForWeek(week),
      brand: "joint",
      type: "ple",
      week,
      dayOffset: 6,
      venueId: defaultVenueFor(universe, "ple", week, "joint"),
      ticketPrice: 95,
      marketingSpend: 250_000,
      segments: [],
      status: "planned",
      result: null,
    };
    universe.shows.push(show);
    created.push(show);
  }
  return created;
}

export function upcomingEvents(universe: Universe, weeks = 8) {
  const events: { week: number; dayOffset: number; name: string; brand: BrandId | "joint"; type: Show["type"]; showId: string | null; status: Show["status"] | "scheduled" }[] = [];
  for (let w = universe.week; w < universe.week + weeks; w++) {
    for (const brandId of ["mayhem", "fury"] as const) {
      const existing = universe.shows.find((s) => s.week === w && s.brand === brandId && s.type === "weekly");
      events.push({ week: w, dayOffset: universe.brands[brandId].showDayOffset, name: universe.brands[brandId].showName, brand: brandId, type: "weekly", showId: existing?.id ?? null, status: existing?.status ?? "scheduled" });
    }
    if (isPleWeek(w)) {
      const existing = universe.shows.find((s) => s.week === w && s.type === "ple");
      events.push({ week: w, dayOffset: 6, name: existing?.name ?? pleNameForWeek(w), brand: "joint", type: "ple", showId: existing?.id ?? null, status: existing?.status ?? "scheduled" });
    }
  }
  return events.sort((a, b) => a.week - b.week || a.dayOffset - b.dayOffset);
}

/** Human label for a week number; negative weeks are history from before the universe began. */
export function weekLabel(week: number) {
  return week < 0 ? `${-week} wk before start` : `Week ${week + 1}`;
}
