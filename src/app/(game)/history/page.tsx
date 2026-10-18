"use client";

import { Crown, Gamepad2 } from "lucide-react";
import Link from "next/link";
import { useMemo, useState } from "react";
import { Badge, inputClass, PageHeader, Panel, Stars, Stat } from "@/components/ui/primitives";
import { sideName } from "@/engine/queries";
import { STIPULATION_LABELS } from "@/engine/simulation";
import type { MatchHistoryEntry } from "@/engine/types";
import { cn } from "@/lib/cn";
import { useUniverse } from "@/store/game";

const PAGE = 40;

export default function HistoryPage() {
  const u = useUniverse();
  const [q, setQ] = useState("");
  const [source, setSource] = useState<"all" | MatchHistoryEntry["source"]>("all");
  const [titleOnly, setTitleOnly] = useState(false);
  const [minStars, setMinStars] = useState(0);
  const [sort, setSort] = useState<"recent" | "best">("recent");
  const [limit, setLimit] = useState(PAGE);

  const rows = useMemo(() => {
    const needle = q.trim().toLowerCase();
    const list = u.history.filter((h) => {
      if (source !== "all" && h.source !== source) return false;
      if (titleOnly && !h.titleId) return false;
      if (h.stars < minStars) return false;
      if (needle) {
        const names = [...h.sideA, ...h.sideB, ...h.sideC].map((id) => u.wrestlers[id]?.ringName.toLowerCase() ?? "");
        if (!names.some((n) => n.includes(needle)) && !h.showName.toLowerCase().includes(needle)) return false;
      }
      return true;
    });
    return sort === "best" ? [...list].sort((a, b) => b.quality - a.quality) : [...list].reverse();
  }, [u, q, source, titleOnly, minStars, sort]);

  const best = u.history.reduce<MatchHistoryEntry | null>((acc, h) => (!acc || h.quality > acc.quality ? h : acc), null);
  const avgStars = u.history.length ? u.history.reduce((s, h) => s + h.stars, 0) / u.history.length : 0;
  const select = "h-10 rounded-md border border-rope bg-arena px-2 text-sm";

  return (
    <div className="space-y-6">
      <PageHeader title="Match history" subtitle="Every match in this universe: simulated, booked, played in the ring and exhibitions." />
      <div className="grid gap-4 sm:grid-cols-4">
        <Panel className="p-4">
          <Stat label="Matches" value={u.history.length} />
        </Panel>
        <Panel className="p-4">
          <Stat label="Average rating" value={<Stars value={Math.round(avgStars * 4) / 4} />} hint={`${avgStars.toFixed(2)} stars`} />
        </Panel>
        <Panel className="p-4">
          <Stat label="Title changes" value={u.history.filter((h) => h.titleChange).length} />
        </Panel>
        <Panel className="p-4">
          <Stat label="Match of the universe" value={best ? <Stars value={best.stars} /> : "—"} hint={best ? `${sideName(u, best.sideA)} vs ${sideName(u, best.sideB)}` : "no matches yet"} />
        </Panel>
      </div>

      <div className="flex flex-wrap gap-2">
        <input className={cn(inputClass, "min-w-56 flex-1")} placeholder="Search wrestler or show" value={q} onChange={(e) => setQ(e.target.value)} aria-label="Search history" />
        <select className={select} value={source} onChange={(e) => setSource(e.target.value as typeof source)} aria-label="Result source">
          <option value="all">All results</option>
          <option value="simulated">AI-simulated</option>
          <option value="manual">Booked finishes</option>
          <option value="played">Played in the ring</option>
        </select>
        <select className={select} value={minStars} onChange={(e) => setMinStars(Number(e.target.value))} aria-label="Minimum stars">
          <option value={0}>Any rating</option>
          <option value={3}>3★ and up</option>
          <option value={4}>4★ and up</option>
          <option value={4.5}>4½★ and up</option>
        </select>
        <select className={select} value={sort} onChange={(e) => setSort(e.target.value as typeof sort)} aria-label="Sort">
          <option value="recent">Most recent</option>
          <option value="best">Highest rated</option>
        </select>
        <label className="flex items-center gap-2 px-2 text-sm">
          <input type="checkbox" checked={titleOnly} onChange={(e) => setTitleOnly(e.target.checked)} /> Title matches only
        </label>
      </div>

      <Panel className="p-0 sm:p-0">
        <ul className="divide-y divide-rope">
          {rows.slice(0, limit).map((h) => {
            const sides = [h.sideA, h.sideB, h.sideC].filter((s) => s.length);
            const show = h.showId ? u.shows.find((s) => s.id === h.showId) : null;
            return (
              <li key={h.id} className="px-4 py-3">
                <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
                  <div className="min-w-0 flex-1">
                    <div className="font-semibold">
                      {sides.map((s, i) => (
                        <span key={i}>
                          {i > 0 && <span className="text-muted"> vs </span>}
                          <span className={cn(s.every((id) => h.winnerIds.includes(id)) && "text-gold-light")}>{sideName(u, s)}</span>
                        </span>
                      ))}
                    </div>
                    <div className="mt-0.5 flex flex-wrap items-center gap-2 text-xs text-muted">
                      <span>Week {h.week + 1}</span>·
                      {show ? (
                        <Link href={`/shows/${show.id}`} className="hover:underline">
                          {h.showName}
                        </Link>
                      ) : (
                        <span>{h.showName}</span>
                      )}
                      {h.stipulation !== "standard" && <span>· {STIPULATION_LABELS[h.stipulation]}</span>}
                      {h.titleId && (
                        <span className="flex items-center gap-1 text-gold-light">
                          <Crown size={11} /> {u.championships[h.titleId]?.shortName}
                          {h.titleChange && " — new champion"}
                        </span>
                      )}
                      {h.source === "played" && (
                        <Badge tone="gold">
                          <Gamepad2 size={11} /> Played
                        </Badge>
                      )}
                      {h.source === "manual" && <Badge tone="fury">Booked finish</Badge>}
                      {!h.winnerIds.length && <Badge>Draw</Badge>}
                    </div>
                  </div>
                  <div className="text-right">
                    <Stars value={h.stars} />
                    <div className="text-xs text-muted">{h.quality}/100</div>
                  </div>
                </div>
                <p className="mt-1 text-sm text-muted">{h.summary}</p>
              </li>
            );
          })}
        </ul>
        {rows.length === 0 && <p className="p-6 text-center text-muted">{u.history.length ? "No matches fit those filters." : "No matches yet. Run a show or play a match."}</p>}
        {rows.length > limit && (
          <div className="border-t border-rope p-3 text-center">
            <button className="text-sm font-semibold text-gold-light hover:underline" onClick={() => setLimit((l) => l + PAGE)}>
              Show {Math.min(PAGE, rows.length - limit)} more of {rows.length - limit}
            </button>
          </div>
        )}
      </Panel>
    </div>
  );
}
