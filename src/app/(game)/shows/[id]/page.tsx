"use client";

import { DialogueView } from "@/components/DialogueView";
import { Gamepad2, HeartPulse } from "lucide-react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { BrandBadge, MatchupCard } from "@/components/game";
import { Badge, Button, EmptyState, Meter, PageHeader, Panel, Stars, Stat } from "@/components/ui/primitives";
import { formatGameDate } from "@/engine/calendar";
import { STIPULATION_LABELS } from "@/engine/simulation";
import { sideName } from "@/engine/queries";
import { cn, money } from "@/lib/cn";
import { useUniverse } from "@/store/game";

const BREAKDOWN_LABELS: Record<string, string> = {
  performance: "In-ring performance",
  psychology: "Pacing & psychology",
  crowd: "Crowd engagement",
  reversals: "Reversals & momentum shifts",
  stakes: "Stakes (title, rivalry, stipulation)",
  repetition: "Repetition penalty",
  fatigue: "Fatigue / overwork penalty",
  variance: "Night-to-night variance",
  winProbability: "Winner's pre-match odds (%)",
  entertainment: "Entertainment ability",
  popularity: "Popularity",
  rivalry: "Rivalry intensity",
};

export default function ShowResultsPage() {
  const { id } = useParams<{ id: string }>();
  const u = useUniverse();
  const show = u.shows.find((s) => s.id === id);
  if (!show) return <EmptyState title="Show not found" />;
  if (!show.result) {
    return <EmptyState title={`${show.name} hasn't happened yet`} action={<Link href={`/booking/${show.id}`}><Button>Book it</Button></Link>} />;
  }
  const r = show.result;
  const revenue = Object.entries(r.revenue);
  const expenses = Object.entries(r.expenses);
  const venue = u.venues.find((v) => v.id === show.venueId);

  return (
    <div className="space-y-6">
      <PageHeader
        title={show.name}
        subtitle={
          <span className="flex flex-wrap items-center gap-2">
            <BrandBadge universe={u} brand={show.brand} /> {formatGameDate(u.startDate, show.week, show.dayOffset)} · {venue?.name}, {venue?.city}
          </span>
        }
        actions={
          <Link href="/dashboard">
            <Button>Back to dashboard</Button>
          </Link>
        }
      />

      <section className="animate-spotlight grid gap-4 rounded-xl border border-gold/40 bg-gradient-to-br from-[#2a1f06] via-canvas to-canvas p-5 sm:grid-cols-[auto_1fr] sm:p-6">
        <div className="text-center sm:pr-6">
          <div className="text-sm text-muted">Show rating</div>
          <div className="font-display gold-text text-8xl">{r.rating}</div>
          <Stars value={r.stars} className="text-2xl" />
        </div>
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-3">
          <Stat label="Attendance" value={r.attendance.toLocaleString()} hint={venue ? `${Math.round((r.attendance / venue.capacity) * 100)}% of ${venue.capacity.toLocaleString()}` : undefined} />
          <Stat label="Viewership" value={`${(r.viewership / 1_000_000).toFixed(2)}M`} />
          <Stat label="Fan satisfaction" value={r.fanSatisfaction} hint={<Meter value={r.fanSatisfaction} tone={r.fanSatisfaction >= 60 ? "good" : "bad"} />} />
          <Stat label="Average match" value={r.avgMatchQuality} hint="out of 100" />
          <Stat label="Main event" value={r.mainEventQuality} hint="out of 100" />
          <Stat label="Show profit" value={money(r.profit)} tone={r.profit >= 0 ? "good" : "bad"} hint={`Brand popularity ${r.brandPopularityDelta >= 0 ? "+" : ""}${r.brandPopularityDelta}`} />
        </div>
        {r.notes.length > 0 && (
          <ul className="space-y-1 text-sm sm:col-span-2">
            {r.notes.map((n, i) => (
              <li key={i} className="text-muted">
                • {n}
              </li>
            ))}
          </ul>
        )}
      </section>

      <div className="grid gap-6 lg:grid-cols-[1.6fr_1fr]">
        <div className="space-y-4">
          {r.segments.map((res, i) => {
            const seg = show.segments.find((s) => s.id === res.segmentId)!;
            return (
              <Panel key={res.segmentId} className="p-0 sm:p-0">
                {res.kind === "match" ? (
                  <MatchupCard
                    universe={u}
                    sides={[seg.sideA, seg.sideB, seg.sideC]}
                    title={seg.titleId}
                    highlightWinner={res.winnerIds}
                    label={
                      <span>
                        {i + 1}. {seg.label}
                        {seg.stipulation !== "standard" && ` · ${STIPULATION_LABELS[seg.stipulation]}`}
                      </span>
                    }
                  />
                ) : (
                  <div className="border-b border-rope bg-canvas-2 px-4 py-2 text-sm font-semibold">
                    {i + 1}. {seg.label} — {sideName(u, seg.sideA)}
                    {seg.sideB.length > 0 && ` & ${sideName(u, seg.sideB)}`}
                  </div>
                )}
                <div className="space-y-2 p-4">
                  <div className="flex flex-wrap items-center gap-2">
                    <Stars value={res.stars} className="text-lg" />
                    <span className="text-sm text-muted">quality {res.quality}/100 · {res.durationMin} min</span>
                    {res.finish && <Badge>{res.finish}</Badge>}
                    <Badge tone={res.source === "simulated" ? "neutral" : res.source === "played" ? "gold" : "fury"}>
                      {res.source === "simulated" ? "AI-simulated" : res.source === "played" ? <><Gamepad2 size={12} /> Played</> : "Booked finish"}
                    </Badge>
                    {res.titleChange && <Badge tone="gold">Title change</Badge>}
                  </div>
                  <p className="text-sm leading-relaxed">{res.summary}</p>
                  {res.dialogue && res.dialogue.length > 0 && (
                    <details className="text-sm">
                      <summary className="cursor-pointer text-muted">What was said</summary>
                      <div className="mt-2">
                        <DialogueView u={u} lines={res.dialogue} />
                      </div>
                    </details>
                  )}
                  {res.injuries.map((inj) => (
                    <p key={inj.wrestlerId} className="flex items-center gap-2 text-sm text-bad">
                      <HeartPulse size={14} /> {u.wrestlers[inj.wrestlerId]?.ringName}: {inj.description} (~{inj.weeks} wk)
                    </p>
                  ))}
                  <details className="text-sm">
                    <summary className="cursor-pointer text-muted">How this was rated</summary>
                    <dl className="mt-2 grid gap-x-6 gap-y-1 sm:grid-cols-2">
                      {Object.entries(res.qualityBreakdown).map(([k, v]) => (
                        <div key={k} className="flex justify-between">
                          <dt className="text-muted">{BREAKDOWN_LABELS[k] ?? k}</dt>
                          <dd className={cn("tabular-nums", v < 0 && "text-bad")}>{Math.round(v * 10) / 10}</dd>
                        </div>
                      ))}
                    </dl>
                  </details>
                </div>
              </Panel>
            );
          })}
        </div>
        <div className="space-y-6">
          <Panel title="Money">
            <dl className="space-y-1 text-sm">
              {revenue.map(([k, v]) => (
                <div key={k} className="flex justify-between">
                  <dt className="capitalize text-muted">{k}</dt>
                  <dd className="text-good">+{money(v)}</dd>
                </div>
              ))}
              {expenses.map(([k, v]) => (
                <div key={k} className="flex justify-between">
                  <dt className="capitalize text-muted">{k}</dt>
                  <dd className="text-bad">−{money(v)}</dd>
                </div>
              ))}
              <div className="flex justify-between border-t border-rope pt-2 font-semibold">
                <dt>Show profit</dt>
                <dd className={r.profit >= 0 ? "text-good" : "text-bad"}>{money(r.profit)}</dd>
              </div>
              <p className="pt-1 text-xs text-muted">Salaries and overhead are charged when the week advances.</p>
            </dl>
          </Panel>
          <Panel title="Popularity changes">
            <ul className="space-y-1 text-sm">
              {r.popularityChanges.map((c) => (
                <li key={c.wrestlerId} className="flex justify-between">
                  <Link href={`/roster/${c.wrestlerId}`} className="hover:underline">
                    {u.wrestlers[c.wrestlerId]?.ringName}
                  </Link>
                  <span className={cn("tabular-nums", c.delta > 0 ? "text-good" : c.delta < 0 ? "text-bad" : "text-muted")}>
                    {c.delta > 0 ? "+" : ""}
                    {c.delta}
                  </span>
                </li>
              ))}
            </ul>
          </Panel>
        </div>
      </div>
    </div>
  );
}
