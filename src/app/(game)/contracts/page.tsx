"use client";

import { useSearchParams } from "next/navigation";
import { Suspense, useMemo, useState } from "react";
import { BrandBadge, OverallBadge } from "@/components/game";
import { Portrait } from "@/components/Portrait";
import { Button, Field, inputClass, Meter, Modal, PageHeader, Stat, Tabs } from "@/components/ui/primitives";
import { useAction } from "@/components/WeekControls";
import { weeklyPayroll } from "@/engine/finance";
import { overall } from "@/engine/rating";
import type { Universe, Wrestler } from "@/engine/types";
import { askingSalary, evaluateOffer, type OfferEvaluation, releaseWrestler, renewContract, signWrestler } from "@/engine/universe";
import { cn, money } from "@/lib/cn";
import { useGame, useUniverse } from "@/store/game";

type Tab = "signed" | "free-agents" | "legends";

function Negotiation({ u, w, onClose }: { u: Universe; w: Wrestler; onClose: () => void }) {
  const run = useAction();
  const toast = useGame((st) => st.toast);
  const signed = w.brand === "mayhem" || w.brand === "fury";
  const legend = w.contract.status === "legend-deal";
  const asking = askingSalary(u, w);
  const [salary, setSalary] = useState(asking);
  const [weeks, setWeeks] = useState(legend ? 12 : 52);
  const [bonus, setBonus] = useState(legend ? Math.round(asking * 2) : 0);
  const [brand, setBrand] = useState<"mayhem" | "fury">(signed ? (w.brand as "mayhem" | "fury") : u.brands.mayhem.popularity < u.brands.fury.popularity ? "mayhem" : "fury");
  const [result, setResult] = useState<OfferEvaluation | null>(null);
  const preview = evaluateOffer(u, w, { weeklySalary: salary, weeks, signingBonus: bonus, brand });

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3">
        <Portrait w={w} className="w-16" />
        <div>
          <div className="font-display text-2xl">{w.ringName}</div>
          <div className="text-sm text-muted">
            Overall {overall(w, u.settings)} · popularity {Math.round(w.popularity)} · morale {Math.round(w.morale)}
          </div>
          <div className="text-sm">
            Asking about <span className="font-semibold">{money(asking, false)}</span>/week{legend && " · legends only take deals of 26 weeks or less"}
          </div>
        </div>
      </div>
      <div className="grid gap-3 sm:grid-cols-2">
        <Field label="Weekly salary ($)">
          <input type="number" step={100} min={0} className={inputClass} value={salary} onChange={(e) => setSalary(Math.max(0, Number(e.target.value) || 0))} />
        </Field>
        <Field label="Length (weeks)">
          <input type="number" min={4} max={260} className={inputClass} value={weeks} onChange={(e) => setWeeks(Number(e.target.value) || 4)} />
        </Field>
        <Field label="Signing bonus ($)" hint="Paid now; spread over the deal when they judge it.">
          <input type="number" step={1000} min={0} className={inputClass} value={bonus} onChange={(e) => setBonus(Math.max(0, Number(e.target.value) || 0))} />
        </Field>
        {!signed && (
          <Field label="Brand">
            <select className="h-10 w-full rounded-md border border-rope bg-arena px-2 text-sm" value={brand} onChange={(e) => setBrand(e.target.value as "mayhem" | "fury")}>
              <option value="mayhem">{u.brands.mayhem.showName}</option>
              <option value="fury">{u.brands.fury.showName}</option>
            </select>
          </Field>
        )}
      </div>
      <div>
        <div className="flex justify-between text-sm">
          <span className="text-muted">Their interest</span>
          <span className={cn("font-semibold", preview.interest >= 1 ? "text-good" : preview.interest >= 0.85 ? "text-gold-light" : "text-bad")}>{preview.interest >= 1 ? "Likely to accept" : preview.interest >= 0.85 ? "Close" : "Unlikely"}</span>
        </div>
        <Meter value={Math.min(1.3, preview.interest) * 100} max={130} tone={preview.interest >= 1 ? "good" : preview.interest >= 0.85 ? "gold" : "bad"} />
        <p className="mt-1 text-xs text-muted">Total cost over the deal: {money(salary * weeks + bonus)} · payroll impact {money(salary - (signed ? w.contract.weeklySalary : 0))}/week</p>
      </div>
      {result && !result.accepted && (
        <div className="rounded-md border border-bad/40 bg-bad/10 p-3 text-sm">
          {result.message}
          {result.counter && (
            <Button size="sm" className="ml-2" onClick={() => setSalary(result.counter!.weeklySalary)}>
              Use counter ({money(result.counter.weeklySalary, false)}/wk)
            </Button>
          )}
        </div>
      )}
      <div className="flex justify-end gap-2">
        <Button variant="ghost" onClick={onClose}>
          Cancel
        </Button>
        <Button
          variant="gold"
          onClick={() => {
            const ev = run((d) => (signed ? renewContract(d, w.id, { weeklySalary: salary, weeks, signingBonus: bonus }) : signWrestler(d, w.id, { weeklySalary: salary, weeks, signingBonus: bonus, brand })));
            if (!ev) return;
            setResult(ev);
            if (ev.accepted) {
              toast(ev.message, "good");
              onClose();
            }
          }}
        >
          {signed ? "Offer renewal" : "Offer contract"}
        </Button>
      </div>
    </div>
  );
}

function ContractsInner() {
  const u = useUniverse();
  const run = useAction();
  const params = useSearchParams();
  // A ?w=<id> link opens straight into that wrestler's negotiation, on the right tab.
  const linked = params.get("w");
  const linkedW = linked ? u.wrestlers[linked] : undefined;
  const [tab, setTab] = useState<Tab>(() => (linkedW?.brand === "legends" ? "legends" : linkedW?.brand === "free-agents" ? "free-agents" : "signed"));
  const [negotiating, setNegotiating] = useState<string | null>(() => (linkedW ? linkedW.id : null));

  const list = useMemo(() => {
    const all = Object.values(u.wrestlers);
    const filtered = tab === "signed" ? all.filter((w) => w.brand === "mayhem" || w.brand === "fury") : all.filter((w) => w.brand === tab);
    return filtered.sort((a, b) => (tab === "signed" ? a.contract.weeksRemaining - b.contract.weeksRemaining : overall(b, u.settings) - overall(a, u.settings)));
  }, [u, tab]);

  const w = negotiating ? u.wrestlers[negotiating] : null;

  return (
    <div className="space-y-6">
      <PageHeader title="Contracts" subtitle="Fictional in-game economics. Wrestlers weigh salary, bonus, length, brand popularity and their morale." />
      <div className="grid gap-4 sm:grid-cols-4">
        <Stat label="Weekly payroll" value={money(weeklyPayroll(u))} />
        <Stat label="Expiring in ≤ 6 weeks" value={Object.values(u.wrestlers).filter((x) => (x.brand === "mayhem" || x.brand === "fury") && x.contract.weeksRemaining <= 6).length} />
        <Stat label="Free agents" value={Object.values(u.wrestlers).filter((x) => x.brand === "free-agents").length} />
        <Stat label="Legends available" value={Object.values(u.wrestlers).filter((x) => x.brand === "legends").length} />
      </div>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <Tabs
          value={tab}
          onChange={setTab}
          options={[
            { value: "signed", label: "Under contract" },
            { value: "free-agents", label: "Free agents" },
            { value: "legends", label: "Legends" },
          ]}
        />
        <label className="flex items-center gap-2 text-sm text-muted">
          <input type="checkbox" checked={u.settings.autoRenewContracts} onChange={(e) => run((d) => void (d.settings.autoRenewContracts = e.target.checked))} />
          Auto-renew happy wrestlers at their asking price
        </label>
      </div>
      <div className="overflow-x-auto rounded-lg border border-rope bg-canvas">
        <table className="w-full text-sm">
          <thead className="bg-canvas-2 text-left text-xs text-muted">
            <tr>
              <th className="px-3 py-2">Wrestler</th>
              <th className="px-2 py-2 text-right">OVR</th>
              <th className="hidden px-2 py-2 text-right sm:table-cell">Pop.</th>
              <th className="hidden px-2 py-2 text-right md:table-cell">Morale</th>
              <th className="px-2 py-2 text-right">{tab === "signed" ? "Salary" : "Asking"}</th>
              {tab === "signed" && <th className="px-2 py-2 text-right">Weeks left</th>}
              <th className="px-3 py-2" />
            </tr>
          </thead>
          <tbody className="divide-y divide-rope">
            {list.map((x) => (
              <tr key={x.id}>
                <td className="px-3 py-1.5">
                  <div className="flex items-center gap-2">
                    <Portrait w={x} className="w-8" rounded="rounded" />
                    <div>
                      <div className="font-semibold">
                        {x.ringName} {x.versionLabel && <span className="text-xs font-normal text-muted">{x.versionLabel}</span>}
                      </div>
                      <BrandBadge universe={u} brand={x.brand} />
                    </div>
                  </div>
                </td>
                <td className="px-2 text-right">
                  <OverallBadge value={overall(x, u.settings)} size="sm" />
                </td>
                <td className="hidden px-2 text-right tabular-nums sm:table-cell">{Math.round(x.popularity)}</td>
                <td className="hidden px-2 text-right tabular-nums md:table-cell">{Math.round(x.morale)}</td>
                <td className="px-2 text-right tabular-nums">{money(tab === "signed" ? x.contract.weeklySalary : askingSalary(u, x))}/wk</td>
                {tab === "signed" && <td className={cn("px-2 text-right tabular-nums", x.contract.weeksRemaining <= 6 && "font-semibold text-gold-light")}>{x.contract.weeksRemaining}</td>}
                <td className="px-3 text-right">
                  <div className="flex justify-end gap-1">
                    <Button size="sm" variant={tab === "signed" ? "outline" : "gold"} onClick={() => setNegotiating(x.id)}>
                      {tab === "signed" ? "Renew" : "Sign"}
                    </Button>
                    {tab === "signed" && (
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => {
                          const cost = Math.round(x.contract.weeklySalary * x.contract.weeksRemaining * 0.25);
                          if (window.confirm(`Release ${x.ringName}? Severance: ${money(cost, false)}. Any titles they hold will be vacated.`)) run((d) => releaseWrestler(d, x.id), `${x.ringName} released`);
                        }}
                      >
                        Release
                      </Button>
                    )}
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {list.length === 0 && <p className="p-6 text-center text-muted">Nobody here right now.</p>}
      </div>
      <Modal open={!!w} onClose={() => setNegotiating(null)} title={w && (w.brand === "mayhem" || w.brand === "fury") ? "Renew contract" : "Contract offer"}>
        {w && <Negotiation key={w.id} u={u} w={w} onClose={() => setNegotiating(null)} />}
      </Modal>
    </div>
  );
}

export default function ContractsPage() {
  return (
    <Suspense fallback={null}>
      <ContractsInner />
    </Suspense>
  );
}
