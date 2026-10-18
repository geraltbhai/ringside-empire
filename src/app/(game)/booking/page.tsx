"use client";

import Link from "next/link";
import { BrandBadge } from "@/components/game";
import { Button, PageHeader, Panel, Stars } from "@/components/ui/primitives";
import { WeekControls } from "@/components/WeekControls";
import { formatGameDate } from "@/engine/calendar";
import { useUniverse } from "@/store/game";

export default function BookingIndex() {
  const u = useUniverse();
  const upcoming = u.shows.filter((s) => s.status === "planned").sort((a, b) => a.week - b.week || a.dayOffset - b.dayOffset);
  const done = u.shows.filter((s) => s.status === "completed").sort((a, b) => b.week - a.week || b.dayOffset - a.dayOffset).slice(0, 12);
  return (
    <div className="space-y-6">
      <PageHeader title="Booking" subtitle="Build each card segment by segment, or let the AI Booker suggest one. Every show must be run before the week can advance." />
      <Panel title={`Week ${u.week + 1}`}>
        <WeekControls universe={u} />
      </Panel>
      <div className="grid gap-6 lg:grid-cols-2">
        <Panel title="Planned shows">
          <ul className="divide-y divide-rope">
            {upcoming.map((s) => (
              <li key={s.id} className="flex items-center gap-3 py-2.5">
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <span className="font-semibold">{s.name}</span>
                    <BrandBadge universe={u} brand={s.brand} />
                  </div>
                  <div className="text-xs text-muted">
                    {formatGameDate(u.startDate, s.week, s.dayOffset)} · {s.segments.length} segments
                    {s.week > u.week && " · you can book ahead"}
                  </div>
                </div>
                <Link href={`/booking/${s.id}`}>
                  <Button size="sm" variant={s.week === u.week ? "primary" : "outline"}>
                    {s.segments.length ? "Edit" : "Book"}
                  </Button>
                </Link>
              </li>
            ))}
          </ul>
        </Panel>
        <Panel title="Completed shows">
          {done.length === 0 && <p className="text-sm text-muted">No shows run yet.</p>}
          <ul className="divide-y divide-rope">
            {done.map((s) => (
              <li key={s.id}>
                <Link href={`/shows/${s.id}`} className="flex items-center gap-3 py-2.5 hover:text-gold-light">
                  <div className="min-w-0 flex-1">
                    <div className="font-semibold">{s.name}</div>
                    <div className="text-xs text-muted">
                      Week {s.week + 1} · {s.result?.attendance.toLocaleString()} fans · rating {s.result?.rating}
                    </div>
                  </div>
                  <Stars value={s.result?.stars ?? 0} />
                </Link>
              </li>
            ))}
          </ul>
        </Panel>
      </div>
    </div>
  );
}
