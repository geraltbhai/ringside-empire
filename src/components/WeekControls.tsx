"use client";

import { CheckCircle2, FastForward, Play } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { formatGameDate } from "@/engine/calendar";
import type { Universe } from "@/engine/types";
import { advanceWeek, canAdvance, simulateRemainingWeek } from "@/engine/universe";
import { useGame } from "@/store/game";
import { BrandBadge } from "./game";
import { Button } from "./ui/primitives";

export function useAction() {
  const mutate = useGame((s) => s.mutate);
  const toast = useGame((s) => s.toast);
  return function run<T>(fn: (u: Universe) => T, success?: string | ((v: T) => string)): T | undefined {
    try {
      const value = mutate(fn);
      if (success) toast(typeof success === "function" ? success(value) : success, "good");
      return value;
    } catch (e) {
      toast(e instanceof Error ? e.message : "Something went wrong", "bad");
      return undefined;
    }
  };
}

export function WeekControls({ universe }: { universe: Universe }) {
  const run = useAction();
  const router = useRouter();
  const shows = universe.shows.filter((s) => s.week === universe.week).sort((a, b) => a.dayOffset - b.dayOffset);
  const ready = canAdvance(universe);
  return (
    <div className="space-y-3">
      <ul className="space-y-2">
        {shows.map((s) => {
          const venue = universe.venues.find((v) => v.id === s.venueId);
          return (
            <li key={s.id} className="flex flex-wrap items-center gap-3 rounded-md border border-rope bg-arena/60 p-3">
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="font-display text-xl">{s.name}</span>
                  <BrandBadge universe={universe} brand={s.brand} />
                  {s.type === "ple" && <span className="text-xs font-semibold text-gold-light">Premium live event</span>}
                </div>
                <div className="text-xs text-muted">
                  {formatGameDate(universe.startDate, s.week, s.dayOffset)} · {venue?.name} · {s.segments.length} segment{s.segments.length === 1 ? "" : "s"} booked
                </div>
              </div>
              {s.status === "completed" ? (
                <Link href={`/shows/${s.id}`} className="flex items-center gap-1.5 text-sm font-semibold text-good hover:underline">
                  <CheckCircle2 size={16} /> {s.result?.rating} rating — results
                </Link>
              ) : (
                <Link href={`/booking/${s.id}`}>
                  <Button size="sm" variant="primary">
                    {s.segments.length ? "Edit card" : "Book show"}
                  </Button>
                </Link>
              )}
            </li>
          );
        })}
      </ul>
      <div className="flex flex-wrap gap-2">
        {!ready && (
          <Button
            onClick={() => {
              const res = run((u) => simulateRemainingWeek(u), (r) => `Simulated ${r.length} show${r.length === 1 ? "" : "s"}${r.some((x) => x.removed.length) ? " (some segments dropped due to injuries)" : ""}`);
              if (res && res.length === 1) router.push(`/shows/${res[0].showId}`);
            }}
          >
            <Play size={16} /> Simulate remaining shows
          </Button>
        )}
        <Button variant={ready ? "gold" : "outline"} disabled={!ready} onClick={() => run((u) => advanceWeek(u), "On to the next week")} title={ready ? "" : "Run every show this week first"}>
          <FastForward size={16} /> Advance to week {universe.week + 2}
        </Button>
      </div>
      {!ready && <p className="text-xs text-muted">Empty cards are filled by the AI Booker when you simulate. Book them yourself for full control.</p>}
    </div>
  );
}
