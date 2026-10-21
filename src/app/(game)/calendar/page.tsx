"use client";

import { Crown, FileWarning, HeartPulse } from "lucide-react";
import Link from "next/link";
import { BrandBadge } from "@/components/game";
import { Badge, Button, PageHeader, Panel, Stars } from "@/components/ui/primitives";
import { formatGameDate, upcomingEvents } from "@/engine/calendar";
import { sideName } from "@/engine/queries";
import { cn } from "@/lib/cn";
import { useUniverse } from "@/store/game";

export default function CalendarPage() {
  const u = useUniverse();
  const events = upcomingEvents(u, 8);
  const weeks = [...new Set(events.map((e) => e.week))];
  const signed = Object.values(u.wrestlers).filter((w) => w.brand === "mayhem" || w.brand === "fury");
  const past = u.shows.filter((s) => s.status === "completed").sort((a, b) => b.week - a.week || b.dayOffset - a.dayOffset).slice(0, 10);

  return (
    <div className="space-y-6">
      <PageHeader title="Calendar" subtitle="Monday Night Raw (WWE) and AEW Dynamite air every week. A joint premium live event closes every fourth week." />
      <div className="grid gap-6 lg:grid-cols-[1.5fr_1fr]">
        <div className="space-y-3">
          {weeks.map((week) => {
            const expiring = signed.filter((w) => w.contract.weeksRemaining === week - u.week + 1);
            const returning = signed.filter((w) => w.injury && w.injury.weeksRemaining === week - u.week + 1);
            return (
              <Panel key={week} className={cn(week === u.week && "border-gold/50")}>
                <div className="mb-2 flex items-baseline justify-between">
                  <h2 className="font-display text-2xl">
                    Week {week + 1} {week === u.week && <span className="ml-2 align-middle text-xs font-semibold text-gold-light">This week</span>}
                  </h2>
                  <span className="text-sm text-muted">{formatGameDate(u.startDate, week)}</span>
                </div>
                <ul className="space-y-2">
                  {events
                    .filter((e) => e.week === week)
                    .map((e) => {
                      const show = e.showId ? u.shows.find((s) => s.id === e.showId) : null;
                      const titleMatches = show?.segments.filter((s) => s.titleId) ?? [];
                      return (
                        <li key={`${e.week}-${e.name}`} className={cn("rounded-md border p-3", e.type === "ple" ? "border-gold/40 bg-gold/5" : "border-rope")}>
                          <div className="flex flex-wrap items-center gap-2">
                            <span className="text-xs text-muted">{formatGameDate(u.startDate, e.week, e.dayOffset).split(",")[0]}</span>
                            <span className={cn("font-semibold", e.type === "ple" && "gold-text font-display text-lg")}>{e.name}</span>
                            <BrandBadge universe={u} brand={e.brand} />
                            <span className="ml-auto">
                              {e.status === "completed" && show ? (
                                <Link href={`/shows/${show.id}`} className="text-sm text-good hover:underline">
                                  Results
                                </Link>
                              ) : show ? (
                                <Link href={`/booking/${show.id}`}>
                                  <Button size="sm">{show.segments.length ? `${show.segments.length} booked` : "Book"}</Button>
                                </Link>
                              ) : (
                                <span className="text-xs text-muted">Opens for booking soon</span>
                              )}
                            </span>
                          </div>
                          {titleMatches.map((s) => (
                            <div key={s.id} className="mt-1 flex items-center gap-1.5 text-xs text-gold-light">
                              <Crown size={12} /> {u.championships[s.titleId!].shortName}: {sideName(u, s.sideA)} vs {sideName(u, s.sideB)}
                            </div>
                          ))}
                        </li>
                      );
                    })}
                </ul>
                {(expiring.length > 0 || returning.length > 0) && (
                  <div className="mt-3 flex flex-wrap gap-2 text-xs">
                    {expiring.map((w) => (
                      <Badge key={w.id} tone="bad">
                        <FileWarning size={12} /> {w.ringName}&apos;s contract ends
                      </Badge>
                    ))}
                    {returning.map((w) => (
                      <Badge key={w.id} tone="good">
                        <HeartPulse size={12} /> {w.ringName} returns
                      </Badge>
                    ))}
                  </div>
                )}
              </Panel>
            );
          })}
        </div>
        <Panel title="Recent shows">
          <ul className="divide-y divide-rope">
            {past.map((s) => (
              <li key={s.id}>
                <Link href={`/shows/${s.id}`} className="flex items-center gap-2 py-2 text-sm hover:text-gold-light">
                  <span className="w-12 text-xs text-muted">Wk {s.week + 1}</span>
                  <span className="flex-1 font-semibold">{s.name}</span>
                  <Stars value={s.result?.stars ?? 0} />
                </Link>
              </li>
            ))}
            {past.length === 0 && <li className="py-2 text-sm text-muted">No shows yet.</li>}
          </ul>
        </Panel>
      </div>
    </div>
  );
}
