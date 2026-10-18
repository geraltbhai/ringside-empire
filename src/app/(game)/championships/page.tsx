"use client";

import { weekLabel } from "@/engine/calendar";
import { Crown } from "lucide-react";
import { useState } from "react";
import { BrandBadge } from "@/components/game";
import { Portrait } from "@/components/Portrait";
import { Button, Meter, PageHeader, Panel } from "@/components/ui/primitives";
import { useAction } from "@/components/WeekControls";
import { sideName, weeksSinceDefense } from "@/engine/queries";
import type { Championship } from "@/engine/types";
import { awardTitle, vacateTitle } from "@/engine/universe";
import { cn } from "@/lib/cn";
import { useUniverse } from "@/store/game";

const TIER_LABEL: Record<Championship["tier"], string> = {
  world: "World title",
  midcard: "Midcard title",
  tag: "Tag-team titles",
  "womens-world": "Women's world title",
  "womens-tag": "Women's tag-team titles",
};

export default function ChampionshipsPage() {
  const u = useUniverse();
  const run = useAction();
  const [selected, setSelected] = useState(Object.keys(u.championships)[0]);
  const [award, setAward] = useState("");
  const title = u.championships[selected];

  const eligible = (() => {
    const pool = Object.values(u.wrestlers).filter((w) => (w.brand === "mayhem" || w.brand === "fury") && w.division === title.division && (title.brand === "shared" || w.brand === title.brand));
    if (title.isTag) return Object.values(u.teams).filter((t) => t.memberIds.every((m) => pool.some((p) => p.id === m))).map((t) => ({ id: t.memberIds.join("+"), label: t.name }));
    return pool.map((w) => ({ id: w.id, label: w.ringName }));
  })();

  return (
    <div className="space-y-6">
      <PageHeader title="Championships" subtitle="Titles change hands only on decisive finishes in title matches. Prestige rises with great defences and falls when a title is vacated." />
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {Object.values(u.championships).map((c) => {
          const holders = c.holderIds.map((id) => u.wrestlers[id]);
          return (
            <button
              key={c.id}
              onClick={() => setSelected(c.id)}
              aria-pressed={selected === c.id}
              className={cn("flex items-center gap-3 rounded-lg border p-3 text-left transition-colors", selected === c.id ? "border-gold bg-gold/10" : "border-rope bg-canvas hover:border-gold/50")}
            >
              <div className="flex -space-x-3">{holders.length ? holders.map((h) => <Portrait key={h.id} w={h} className="w-12" />) : <div className="grid aspect-[5/6] w-12 place-items-center rounded-md bg-rope text-[10px] text-muted">VACANT</div>}</div>
              <div className="min-w-0 flex-1">
                <div className="truncate text-xs text-gold-light">{c.name}</div>
                <div className="truncate font-semibold">{holders.length ? sideName(u, c.holderIds) : "Vacant"}</div>
                <div className="mt-1 flex items-center gap-2 text-xs text-muted">
                  Prestige <Meter value={c.prestige} tone="gold" /> {Math.round(c.prestige)}
                </div>
              </div>
            </button>
          );
        })}
      </div>

      <Panel tone="gold">
        <div className="grid gap-6 lg:grid-cols-[1fr_1.4fr]">
          <div>
            <div className="flex items-center gap-2 text-gold-light">
              <Crown size={18} /> {TIER_LABEL[title.tier]}
            </div>
            <h2 className="font-display gold-text mt-2 text-4xl sm:text-5xl">{title.name}</h2>
            <div className="mt-3 flex flex-wrap gap-2">
              <BrandBadge universe={u} brand={title.brand} />
              <span className="text-sm text-muted">Prestige {Math.round(title.prestige)}</span>
              {title.holderIds.length > 0 && <span className="text-sm text-muted">· last defended {weeksSinceDefense(u, title.id)} wk ago</span>}
            </div>
            <div className="mt-5 flex items-end gap-3">
              {title.holderIds.map((id) => (
                <Portrait key={id} w={u.wrestlers[id]} className="w-32" />
              ))}
              {!title.holderIds.length && <p className="text-muted">This title is vacant. Book a title match between two contenders, or award it below.</p>}
            </div>
            <div className="mt-6 space-y-3 border-t border-rope pt-4">
              {title.holderIds.length > 0 && (
                <Button
                  variant="danger"
                  onClick={() => {
                    const reason = window.prompt("Reason for vacating the title", "Stripped by management");
                    if (reason) run((d) => vacateTitle(d, title.id, reason), "Title vacated");
                  }}
                >
                  Vacate title
                </Button>
              )}
              <div className="flex flex-wrap items-center gap-2">
                <select className="h-10 min-w-48 flex-1 rounded-md border border-rope bg-arena px-2 text-sm" value={award} onChange={(e) => setAward(e.target.value)} aria-label="Award title to">
                  <option value="">Award the title to…</option>
                  {eligible.map((o) => (
                    <option key={o.id} value={o.id}>
                      {o.label}
                    </option>
                  ))}
                </select>
                <Button
                  disabled={!award}
                  onClick={() => {
                    if (!window.confirm("Award the title without a match? Fans prefer titles won in the ring.")) return;
                    run((d) => {
                      awardTitle(d, title.id, award.split("+"));
                      d.championships[title.id].prestige = Math.max(0, d.championships[title.id].prestige - 2);
                    }, "Title awarded");
                    setAward("");
                  }}
                >
                  Award
                </Button>
              </div>
            </div>
          </div>
          <div>
            <h3 className="font-cond mb-2 text-lg font-semibold">Lineage</h3>
            <ol className="divide-y divide-rope rounded-md border border-rope">
              {[...title.reigns].reverse().map((r, i) => (
                <li key={i} className="flex items-center gap-3 px-3 py-2 text-sm">
                  <span className="w-6 text-right text-muted">{title.reigns.length - i}</span>
                  <div className="min-w-0 flex-1">
                    <div className="truncate font-semibold">{r.holderName}</div>
                    <div className="text-xs text-muted">
                      {weekLabel(r.startWeek)} → {r.endWeek == null ? "present" : weekLabel(r.endWeek)} · {(r.endWeek ?? u.week) - r.startWeek} weeks · {r.defenses} defences
                      {r.endedBy === "vacated" && " · vacated"}
                    </div>
                  </div>
                  {r.endWeek == null && <span className="gold-plate rounded px-1.5 text-xs font-bold">Current</span>}
                </li>
              ))}
            </ol>
          </div>
        </div>
      </Panel>
    </div>
  );
}
