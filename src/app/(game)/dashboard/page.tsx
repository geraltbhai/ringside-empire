"use client";

import { AlertTriangle, HeartPulse, Newspaper } from "lucide-react";
import Link from "next/link";
import { BrandBadge, TitlePlate, WrestlerChip } from "@/components/game";
import { Meter, PageHeader, Panel, Stars, Stat } from "@/components/ui/primitives";
import { WeekControls } from "@/components/WeekControls";
import { weeklyLedger } from "@/engine/finance";
import { sideName } from "@/engine/queries";
import { RIVALRY_STAGES } from "@/engine/types";
import { cn, money } from "@/lib/cn";
import { useUniverse } from "@/store/game";

export default function DashboardPage() {
  const u = useUniverse();
  const signed = Object.values(u.wrestlers).filter((w) => w.brand === "mayhem" || w.brand === "fury");
  const morale = signed.reduce((s, w) => s + w.morale, 0) / Math.max(1, signed.length);
  const ledger = weeklyLedger(u);
  const lastWeek = ledger.filter((r) => r.week < u.week).at(-1);
  const totals = ledger.reduce((acc, r) => ({ rev: acc.rev + r.revenue, exp: acc.exp + r.expenses }), { rev: 0, exp: 0 });
  const injured = signed.filter((w) => w.injury);
  const expiring = signed.filter((w) => w.contract.weeksRemaining <= 6).sort((a, b) => a.contract.weeksRemaining - b.contract.weeksRemaining);
  const exhausted = signed.filter((w) => w.fatigue >= 70);
  const rivalries = Object.values(u.rivalries).filter((r) => r.status === "active").sort((a, b) => b.intensity - a.intensity).slice(0, 5);
  const recent = [...u.history].reverse().slice(0, 6);
  const news = [...u.news].reverse().slice(0, 8);

  return (
    <div className="space-y-6">
      <PageHeader title={u.promotionName} subtitle={`${u.name} — week ${u.week + 1}. Book this week's shows, then advance the calendar.`} />

      <div className="grid gap-4 sm:grid-cols-3 lg:grid-cols-6">
        <Panel className="p-4">
          <Stat label="Cash balance" value={money(u.cash)} tone={u.cash < 0 ? "bad" : undefined} />
        </Panel>
        <Panel className="p-4">
          <Stat label="Last week profit" value={lastWeek ? money(lastWeek.profit) : "—"} tone={lastWeek ? (lastWeek.profit >= 0 ? "good" : "bad") : undefined} />
        </Panel>
        <Panel className="p-4">
          <Stat label="Revenue / expenses" value={<span className="text-lg">{money(totals.rev)} / {money(totals.exp)}</span>} hint="all-time" />
        </Panel>
        <Panel className="p-4">
          <Stat label="Audience demand" value={Math.round(u.audienceDemand)} hint={<Meter value={u.audienceDemand} tone="gold" />} />
        </Panel>
        <Panel className="p-4">
          <Stat label="Roster morale" value={Math.round(morale)} hint={<Meter value={morale} tone={morale >= 60 ? "good" : morale < 45 ? "bad" : "ink"} />} />
        </Panel>
        <Panel className="p-4">
          <div className="space-y-2">
            {(["mayhem", "fury"] as const).map((b) => (
              <div key={b}>
                <div className="flex justify-between text-xs">
                  <span className="text-muted">{u.brands[b].name} popularity</span>
                  <span className="font-semibold">{Math.round(u.brands[b].popularity)}</span>
                </div>
                <Meter value={u.brands[b].popularity} tone={b} />
              </div>
            ))}
          </div>
        </Panel>
      </div>

      <div className="grid gap-6 lg:grid-cols-[1.5fr_1fr]">
        <Panel title={`This week's shows`}>
          <WeekControls universe={u} />
        </Panel>
        <Panel title="Alerts">
          <div className="space-y-3 text-sm">
            {injured.length === 0 && expiring.length === 0 && exhausted.length === 0 && <p className="text-muted">No injuries, expiring contracts or exhausted wrestlers.</p>}
            {injured.map((w) => (
              <div key={w.id} className="flex items-center gap-2">
                <HeartPulse size={15} className="text-bad" />
                <Link href={`/roster/${w.id}`} className="font-semibold hover:underline">
                  {w.ringName}
                </Link>
                <span className="text-muted">
                  {w.injury!.description}, {w.injury!.weeksRemaining} wk
                </span>
              </div>
            ))}
            {expiring.map((w) => (
              <div key={w.id} className="flex items-center gap-2">
                <AlertTriangle size={15} className="text-gold" />
                <Link href={`/contracts?w=${w.id}`} className="font-semibold hover:underline">
                  {w.ringName}
                </Link>
                <span className="text-muted">contract ends in {w.contract.weeksRemaining} wk</span>
              </div>
            ))}
            {exhausted.map((w) => (
              <div key={w.id} className="flex items-center gap-2">
                <AlertTriangle size={15} className="text-muted" />
                <span className="font-semibold">{w.ringName}</span>
                <span className="text-muted">fatigue {Math.round(w.fatigue)} — rest them</span>
              </div>
            ))}
          </div>
        </Panel>
      </div>

      <Panel title="Champions" action={<Link href="/championships" className="text-sm text-muted hover:text-ink">All titles</Link>}>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {Object.values(u.championships).map((c) => (
            <TitlePlate key={c.id} universe={u} title={c} />
          ))}
        </div>
      </Panel>

      <div className="grid gap-6 lg:grid-cols-2">
        <Panel title="Hottest rivalries" action={<Link href="/rivalries" className="text-sm text-muted hover:text-ink">Storylines</Link>}>
          <ul className="space-y-3">
            {rivalries.map((r) => (
              <li key={r.id}>
                <div className="flex items-center justify-between gap-2">
                  <span className="truncate font-semibold">
                    {sideName(u, r.sideA)} <span className="text-muted">vs</span> {sideName(u, r.sideB)}
                  </span>
                  <BrandBadge universe={u} brand={r.brand} />
                </div>
                <div className="mt-1 flex items-center gap-3 text-xs text-muted">
                  <span className="w-28 shrink-0">{RIVALRY_STAGES[r.stage]}</span>
                  <Meter value={r.intensity} tone="bad" label="Intensity" />
                  <span className="w-8 text-right">{Math.round(r.intensity)}</span>
                </div>
              </li>
            ))}
            {rivalries.length === 0 && <p className="text-sm text-muted">No active rivalries. Start one from the Rivalries screen.</p>}
          </ul>
        </Panel>
        <Panel title="Recent results" action={<Link href="/history" className="text-sm text-muted hover:text-ink">History</Link>}>
          <ul className="divide-y divide-rope">
            {recent.map((m) => (
              <li key={m.id} className="flex items-center gap-3 py-2 text-sm">
                <div className="min-w-0 flex-1">
                  <div className="truncate">
                    <span className="font-semibold">{sideName(u, m.winnerIds.length ? m.winnerIds : m.sideA)}</span>
                    <span className="text-muted"> {m.winnerIds.length ? "def." : "drew"} </span>
                    {sideName(u, [m.sideA, m.sideB, m.sideC].find((s) => s.length && !s.every((id) => m.winnerIds.includes(id))) ?? m.sideB)}
                  </div>
                  <div className="text-xs text-muted">
                    Week {m.week + 1} · {m.showName}
                    {m.titleChange && <span className="ml-1 text-gold-light">· title change</span>}
                    {m.source !== "simulated" && <span className="ml-1">· {m.source}</span>}
                  </div>
                </div>
                <Stars value={m.stars} />
              </li>
            ))}
            {recent.length === 0 && <p className="py-2 text-sm text-muted">No matches yet — run your first show.</p>}
          </ul>
        </Panel>
      </div>

      <div className="grid gap-6 lg:grid-cols-[1fr_1.2fr]">
        <Panel title="Top stars">
          <div className="grid gap-1 sm:grid-cols-2">
            {[...signed]
              .sort((a, b) => b.popularity - a.popularity)
              .slice(0, 8)
              .map((w) => (
                <WrestlerChip key={w.id} universe={u} w={w} sub={`Popularity ${Math.round(w.popularity)} · ${u.brands[w.brand].name}`} />
              ))}
          </div>
        </Panel>
        <Panel title={<span className="flex items-center gap-2"><Newspaper size={17} /> News</span>}>
          <ul className="space-y-2 text-sm">
            {news.map((n, i) => (
              <li key={i} className="flex gap-3">
                <span className="w-12 shrink-0 text-xs text-muted">Wk {n.week + 1}</span>
                <span className={cn(n.tone === "title" && "text-gold-light", n.tone === "bad" && "text-[#ff8da1]", n.tone === "good" && "text-good")}>{n.text}</span>
              </li>
            ))}
          </ul>
        </Panel>
      </div>
    </div>
  );
}
