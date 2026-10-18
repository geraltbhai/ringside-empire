"use client";

import { ArrowLeftRight, Shuffle } from "lucide-react";
import { useMemo, useState } from "react";
import { CartesianGrid, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { TitlePlate, WrestlerChip } from "@/components/game";
import { Button, Field, Meter, PageHeader, Panel, Stat } from "@/components/ui/primitives";
import { useAction } from "@/components/WeekControls";
import { brandProfit, weeklyPayroll } from "@/engine/finance";
import { overall } from "@/engine/rating";
import { brandRoster, sideName } from "@/engine/queries";
import { runDraft, tradeWrestlers, transferWrestler } from "@/engine/universe";
import { money } from "@/lib/cn";
import { useUniverse } from "@/store/game";

const selectClass = "h-10 w-full rounded-md border border-rope bg-arena px-2 text-sm";

export default function BrandsPage() {
  const u = useUniverse();
  const run = useAction();
  const [moveId, setMoveId] = useState("");
  const [tradeA, setTradeA] = useState("");
  const [tradeB, setTradeB] = useState("");

  const rosters = useMemo(
    () => ({
      mayhem: brandRoster(u, "mayhem").sort((a, b) => overall(b, u.settings) - overall(a, u.settings)),
      fury: brandRoster(u, "fury").sort((a, b) => overall(b, u.settings) - overall(a, u.settings)),
    }),
    [u],
  );

  return (
    <div className="space-y-6">
      <PageHeader title="Brands" subtitle="Two weekly shows with separate rosters, titles, budgets and audiences. Move talent with transfers, trades or a full draft." />

      <div className="grid gap-6 lg:grid-cols-2">
        {(["mayhem", "fury"] as const).map((id) => {
          const b = u.brands[id];
          const roster = rosters[id];
          const titles = Object.values(u.championships).filter((c) => c.brand === id);
          const rivalries = Object.values(u.rivalries).filter((r) => r.brand === id && r.status === "active");
          const history = b.history.slice(-12).map((h) => ({ week: `W${h.week + 1}`, rating: h.rating, viewers: Math.round(h.viewership / 10_000) / 100 }));
          const avgRating = b.history.length ? Math.round(b.history.slice(-4).reduce((s, h) => s + h.rating, 0) / Math.min(4, b.history.length)) : null;
          return (
            <Panel key={id} tone={id} title={<span className="font-display text-3xl">{b.showName}</span>}>
              <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
                <Stat label="Popularity" value={Math.round(b.popularity)} hint={<Meter value={b.popularity} tone={id} />} />
                <Stat label="Reputation" value={Math.round(b.reputation)} hint={<Meter value={b.reputation} tone="gold" />} />
                <Stat label="Weekly payroll" value={money(weeklyPayroll(u, id))} hint={`${roster.length} wrestlers`} />
                <Stat label="Profit to date" value={money(brandProfit(u, id))} tone={brandProfit(u, id) >= 0 ? "good" : "bad"} hint={avgRating != null ? `4-wk avg rating ${avgRating}` : "no shows yet"} />
              </div>
              <div className="mt-4 h-40">
                {history.length > 1 ? (
                  <ResponsiveContainer>
                    <LineChart data={history} margin={{ left: -20, right: 8, top: 8 }}>
                      <CartesianGrid stroke="#262c39" vertical={false} />
                      <XAxis dataKey="week" stroke="#8b93a7" fontSize={11} />
                      <YAxis stroke="#8b93a7" fontSize={11} domain={[0, 100]} />
                      <Tooltip contentStyle={{ background: "#12151d", border: "1px solid #262c39" }} cursor={{ stroke: "#3a4256" }} />
                      <Line type="monotone" dataKey="rating" name="Show rating" stroke={b.color} strokeWidth={2} dot={false} />
                    </LineChart>
                  </ResponsiveContainer>
                ) : (
                  <div className="grid h-full place-items-center rounded-md border border-dashed border-rope text-sm text-muted">Ratings history appears after two shows.</div>
                )}
              </div>
              <div className="mt-4 grid gap-2 sm:grid-cols-2">
                {titles.map((t) => (
                  <TitlePlate key={t.id} universe={u} title={t} compact />
                ))}
              </div>
              <div className="mt-4 text-sm text-muted">
                {rivalries.length} active rivalr{rivalries.length === 1 ? "y" : "ies"}: {rivalries.map((r) => `${sideName(u, r.sideA)} vs ${sideName(u, r.sideB)}`).join("; ") || "none"}
              </div>
              <details className="mt-4">
                <summary className="cursor-pointer text-sm font-semibold">Roster ({roster.length})</summary>
                <div className="mt-2 grid max-h-96 gap-1 overflow-y-auto sm:grid-cols-2">
                  {roster.map((w) => (
                    <WrestlerChip key={w.id} universe={u} w={w} />
                  ))}
                </div>
              </details>
            </Panel>
          );
        })}
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        <Panel title="Transfer">
          <div className="space-y-3">
            <Field label="Wrestler">
              <select className={selectClass} value={moveId} onChange={(e) => setMoveId(e.target.value)}>
                <option value="">Choose…</option>
                {[...rosters.mayhem, ...rosters.fury].map((w) => (
                  <option key={w.id} value={w.id}>
                    {w.ringName} ({u.brands[w.brand].name})
                  </option>
                ))}
              </select>
            </Field>
            <Button
              disabled={!moveId}
              onClick={() => {
                const w = u.wrestlers[moveId];
                const to = w.brand === "mayhem" ? "fury" : "mayhem";
                run((d) => transferWrestler(d, moveId, to), `${w.ringName} moved to ${u.brands[to].showName}`);
                setMoveId("");
              }}
            >
              <ArrowLeftRight size={15} /> Move to the other brand
            </Button>
            <p className="text-xs text-muted">Tag partners move together. Brand-exclusive titles are vacated when their holder leaves.</p>
          </div>
        </Panel>
        <Panel title="Trade">
          <div className="space-y-3">
            <Field label="From Monday Mayhem">
              <select className={selectClass} value={tradeA} onChange={(e) => setTradeA(e.target.value)}>
                <option value="">Choose…</option>
                {rosters.mayhem.map((w) => (
                  <option key={w.id} value={w.id}>
                    {w.ringName} ({overall(w, u.settings)})
                  </option>
                ))}
              </select>
            </Field>
            <Field label="From Friday Fury">
              <select className={selectClass} value={tradeB} onChange={(e) => setTradeB(e.target.value)}>
                <option value="">Choose…</option>
                {rosters.fury.map((w) => (
                  <option key={w.id} value={w.id}>
                    {w.ringName} ({overall(w, u.settings)})
                  </option>
                ))}
              </select>
            </Field>
            <Button
              disabled={!tradeA || !tradeB}
              onClick={() => {
                run((d) => tradeWrestlers(d, tradeA, tradeB), "Trade completed");
                setTradeA("");
                setTradeB("");
              }}
            >
              <ArrowLeftRight size={15} /> Swap them
            </Button>
          </div>
        </Panel>
        <Panel title="Brand draft">
          <p className="text-sm text-muted">Re-deal every non-champion between the brands in snake order by star value. Tag teams are drafted together; the less popular brand picks first. Rivalries split by the draft are paused.</p>
          <Button className="mt-4" variant="danger" onClick={() => window.confirm("Run a full brand draft? This reshuffles both rosters.") && run((d) => runDraft(d), (n) => `Draft complete — ${n} wrestlers changed brands`)}>
            <Shuffle size={15} /> Run the draft
          </Button>
          <label className="mt-4 flex items-center gap-2 text-sm">
            <input type="checkbox" checked={u.settings.allowCrossBrand} onChange={(e) => run((d) => void (d.settings.allowCrossBrand = e.target.checked))} />
            Allow cross-brand appearances on weekly shows
          </label>
        </Panel>
      </div>
    </div>
  );
}
