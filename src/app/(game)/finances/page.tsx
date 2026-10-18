"use client";

import { useMemo, useState } from "react";
import { Bar, BarChart, CartesianGrid, Legend, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { EmptyState, PageHeader, Panel, Stat } from "@/components/ui/primitives";
import { brandProfit, EXPENSE_CATEGORIES, forecast, REVENUE_CATEGORIES, weeklyLedger, weeklyPayroll } from "@/engine/finance";
import type { TransactionCategory } from "@/engine/types";
import { cn, money } from "@/lib/cn";
import { useUniverse } from "@/store/game";

const tooltip = { contentStyle: { background: "#12151d", border: "1px solid #262c39", borderRadius: 6 }, formatter: (v: unknown) => money(Number(v)), cursor: { fill: "rgba(255,255,255,0.04)", stroke: "#3a4256" } };
const axis = { stroke: "#8b93a7", fontSize: 11 };

export default function FinancesPage() {
  const u = useUniverse();
  const [cat, setCat] = useState<"all" | TransactionCategory>("all");
  const ledger = useMemo(() => weeklyLedger(u), [u]);
  const fc = useMemo(() => forecast(u), [u]);
  const last = ledger.filter((r) => r.week < u.week).at(-1);
  const month = ledger.filter((r) => r.week >= u.week - 4 && r.week < u.week);
  const monthProfit = month.reduce((s, r) => s + r.profit, 0);

  const byCategory = useMemo(() => {
    const out: Record<string, number> = {};
    for (const t of u.transactions) out[t.category] = (out[t.category] ?? 0) + t.amount;
    return out;
  }, [u.transactions]);

  const chartWeeks = ledger.map((r) => ({ week: `W${r.week + 1}`, Revenue: r.revenue, Expenses: r.expenses, Profit: r.profit, Cash: r.cash }));
  // Actual end-of-week cash, then a dashed forecast that starts from today's balance.
  const cashSeries: { week: string; Cash?: number; Forecast?: number }[] = [
    ...chartWeeks.map((c) => ({ week: c.week, Cash: c.Cash })),
    { week: `Now`, Cash: u.cash, Forecast: u.cash },
    ...fc.points.map((p) => ({ week: `W${p.week + 1}`, Forecast: p.cash })),
  ];
  const txs = [...u.transactions].reverse().filter((t) => cat === "all" || t.category === cat).slice(0, 60);

  return (
    <div className="space-y-6">
      <PageHeader title="Finances" subtitle="Every number here comes from the transaction ledger. Shows earn money; salaries and overhead are paid weekly." />
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
        <Panel className="p-4">
          <Stat label="Cash balance" value={money(u.cash)} tone={u.cash < 0 ? "bad" : undefined} />
        </Panel>
        <Panel className="p-4">
          <Stat label="Last week" value={last ? money(last.profit) : "—"} tone={last ? (last.profit >= 0 ? "good" : "bad") : undefined} hint="profit / loss" />
        </Panel>
        <Panel className="p-4">
          <Stat label="Last 4 weeks" value={month.length ? money(monthProfit) : "—"} tone={monthProfit >= 0 ? "good" : "bad"} hint="monthly profit / loss" />
        </Panel>
        <Panel className="p-4">
          <Stat label="Weekly payroll" value={money(weeklyPayroll(u))} hint={`Mayhem ${money(weeklyPayroll(u, "mayhem"))} · Fury ${money(weeklyPayroll(u, "fury"))}`} />
        </Panel>
        <Panel className="p-4">
          <Stat label="4-week forecast" value={money(fc.points.at(-1)?.cash ?? u.cash)} hint={`avg ${money(fc.avgProfit)}/week`} />
        </Panel>
      </div>

      {ledger.length === 0 ? (
        <EmptyState title="No money has moved yet">Run your first show to start the ledger.</EmptyState>
      ) : (
        <>
          <div className="grid gap-6 lg:grid-cols-2">
            <Panel title="Revenue vs expenses by week">
              <div className="h-64">
                <ResponsiveContainer>
                  <BarChart data={chartWeeks} margin={{ left: 10, right: 8, top: 8 }}>
                    <CartesianGrid stroke="#262c39" vertical={false} />
                    <XAxis dataKey="week" {...axis} />
                    <YAxis {...axis} tickFormatter={(v) => money(v)} />
                    <Tooltip {...tooltip} />
                    <Legend />
                    <Bar dataKey="Revenue" fill="#22c55e" radius={[3, 3, 0, 0]} />
                    <Bar dataKey="Expenses" fill="#f43f5e" radius={[3, 3, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </Panel>
            <Panel title="Cash balance & forecast">
              <div className="h-64">
                <ResponsiveContainer>
                  <LineChart data={cashSeries} margin={{ left: 10, right: 8, top: 8 }}>
                    <CartesianGrid stroke="#262c39" vertical={false} />
                    <XAxis dataKey="week" {...axis} />
                    <YAxis {...axis} tickFormatter={(v) => money(v)} />
                    <Tooltip {...tooltip} />
                    <Legend />
                    <Line dataKey="Cash" stroke="#d9a520" strokeWidth={2} dot={cashSeries.length <= 6} connectNulls />
                    <Line dataKey="Forecast" stroke="#8b93a7" strokeDasharray="5 4" strokeWidth={2} dot={false} connectNulls />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            </Panel>
          </div>
          <div className="grid gap-6 lg:grid-cols-3">
            <Panel title="Revenue by source">
              <dl className="space-y-1.5 text-sm">
                {REVENUE_CATEGORIES.map((c) => (
                  <div key={c} className="flex justify-between">
                    <dt className="capitalize text-muted">{c === "ple" ? "Premium live events" : c}</dt>
                    <dd className="text-good">{money(byCategory[c] ?? 0)}</dd>
                  </div>
                ))}
              </dl>
            </Panel>
            <Panel title="Expenses by type">
              <dl className="space-y-1.5 text-sm">
                {EXPENSE_CATEGORIES.map((c) => (
                  <div key={c} className="flex justify-between">
                    <dt className="capitalize text-muted">{c === "signing" ? "Signing bonuses" : c === "production" ? "Production & overhead" : c}</dt>
                    <dd className="text-bad">{money(-(byCategory[c] ?? 0))}</dd>
                  </div>
                ))}
              </dl>
            </Panel>
            <Panel title="Profitability by brand">
              <dl className="space-y-1.5 text-sm">
                {(["mayhem", "fury", "joint"] as const).map((b) => {
                  const p = brandProfit(u, b);
                  return (
                    <div key={b} className="flex justify-between">
                      <dt className="text-muted">{b === "joint" ? "Premium live events" : u.brands[b].showName}</dt>
                      <dd className={p >= 0 ? "text-good" : "text-bad"}>{money(p)}</dd>
                    </div>
                  );
                })}
                <p className="pt-2 text-xs text-muted">Brand figures include that brand&apos;s shows and payroll; company overhead is not allocated.</p>
              </dl>
            </Panel>
          </div>
        </>
      )}

      <Panel
        title="Transactions"
        action={
          <select className="h-9 rounded-md border border-rope bg-arena px-2 text-sm" value={cat} onChange={(e) => setCat(e.target.value as typeof cat)} aria-label="Filter transactions">
            <option value="all">All categories</option>
            {[...REVENUE_CATEGORIES, ...EXPENSE_CATEGORIES].map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </select>
        }
      >
        <div className="max-h-[480px] overflow-y-auto">
          <table className="w-full text-sm">
            <thead className="sticky top-0 bg-canvas text-left text-xs text-muted">
              <tr>
                <th className="py-1.5">Week</th>
                <th>Description</th>
                <th className="hidden sm:table-cell">Category</th>
                <th className="text-right">Amount</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-rope">
              {txs.map((t) => (
                <tr key={t.id}>
                  <td className="py-1.5 text-muted">{t.week + 1}</td>
                  <td>{t.note}</td>
                  <td className="hidden capitalize text-muted sm:table-cell">{t.category}</td>
                  <td className={cn("text-right tabular-nums", t.amount >= 0 ? "text-good" : "text-bad")}>{money(t.amount, false)}</td>
                </tr>
              ))}
            </tbody>
          </table>
          {txs.length === 0 && <p className="py-4 text-center text-sm text-muted">No transactions.</p>}
        </div>
      </Panel>
    </div>
  );
}
