"use client";

import { ArrowDown, ArrowUp, Dumbbell, Plus, Search } from "lucide-react";
import Link from "next/link";
import { useMemo, useState } from "react";
import { BrandBadge, OverallBadge } from "@/components/game";
import { Portrait } from "@/components/Portrait";
import { Button, inputClass, PageHeader } from "@/components/ui/primitives";
import { ratingCard } from "@/engine/rating";
import { championshipsHeldBy } from "@/engine/queries";
import { type BrandId, STYLES, type Wrestler } from "@/engine/types";
import { cn } from "@/lib/cn";
import { useUniverse } from "@/store/game";

type SortKey = "name" | "overall" | "inRing" | "entertainment" | "popularity" | "form" | "potential" | "morale" | "fatigue" | "age" | "contract";

const COLUMNS: { key: SortKey; label: string; className?: string }[] = [
  { key: "overall", label: "OVR" },
  { key: "inRing", label: "In-ring", className: "hidden md:table-cell" },
  { key: "entertainment", label: "Ent.", className: "hidden md:table-cell" },
  { key: "popularity", label: "Pop." },
  { key: "form", label: "Form", className: "hidden lg:table-cell" },
  { key: "potential", label: "Pot.", className: "hidden lg:table-cell" },
  { key: "morale", label: "Morale", className: "hidden xl:table-cell" },
  { key: "fatigue", label: "Fatigue", className: "hidden xl:table-cell" },
  { key: "age", label: "Age", className: "hidden lg:table-cell" },
  { key: "contract", label: "Contract", className: "hidden xl:table-cell" },
];

function SortIcon({ sort, k }: { sort: { key: SortKey; dir: 1 | -1 }; k: SortKey }) {
  if (sort.key !== k) return null;
  return sort.dir === 1 ? <ArrowUp size={12} /> : <ArrowDown size={12} />;
}

export default function RosterPage() {
  const u = useUniverse();
  const [q, setQ] = useState("");
  const [brand, setBrand] = useState<BrandId | "all" | "signed">("all");
  const [style, setStyle] = useState<"all" | Wrestler["style"]>("all");
  const [alignment, setAlignment] = useState<"all" | Wrestler["alignment"]>("all");
  const [status, setStatus] = useState<"all" | "healthy" | "injured" | "champions">("all");
  const [sort, setSort] = useState<{ key: SortKey; dir: 1 | -1 }>({ key: "overall", dir: -1 });

  const rows = useMemo(() => {
    const needle = q.trim().toLowerCase();
    const list = Object.values(u.wrestlers)
      .filter((w) => {
        if (needle && ![w.ringName, w.name, w.nickname, w.finisher, w.style].some((s) => s.toLowerCase().includes(needle))) return false;
        if (brand === "signed" ? !(w.brand === "mayhem" || w.brand === "fury") : brand !== "all" && w.brand !== brand) return false;
        if (style !== "all" && w.style !== style) return false;
        if (alignment !== "all" && w.alignment !== alignment) return false;
        if (status === "healthy" && w.injury) return false;
        if (status === "injured" && !w.injury) return false;
        if (status === "champions" && championshipsHeldBy(u, w.id).length === 0) return false;
        return true;
      })
      .map((w) => ({ w, r: ratingCard(w, u.settings) }));
    const val = (row: (typeof list)[number]): number | string => {
      switch (sort.key) {
        case "name":
          return row.w.ringName;
        case "age":
          return row.w.age;
        case "morale":
          return row.w.morale;
        case "fatigue":
          return row.w.fatigue;
        case "contract":
          return row.w.contract.weeksRemaining;
        default:
          return row.r[sort.key];
      }
    };
    return list.sort((a, b) => {
      const va = val(a);
      const vb = val(b);
      if (typeof va === "string") return va.localeCompare(vb as string) * sort.dir;
      return ((va as number) - (vb as number)) * sort.dir;
    });
  }, [u, q, brand, style, alignment, status, sort]);

  const toggleSort = (key: SortKey) => setSort((s) => (s.key === key ? { key, dir: (s.dir * -1) as 1 | -1 } : { key, dir: key === "name" ? 1 : -1 }));

  const select = "h-10 rounded-md border border-rope bg-arena px-2 text-sm";

  return (
    <div>
      <PageHeader
        title="Roster"
        subtitle={`${rows.length} of ${Object.keys(u.wrestlers).length} wrestlers. Ratings are subjective gameplay estimates you can edit.`}
        actions={
          <Link href="/roster/new">
            <Button variant="gold">
              <Plus size={16} /> Create wrestler
            </Button>
          </Link>
        }
      />
      <div className="mb-4 flex flex-wrap gap-2">
        <label className="relative min-w-56 flex-1">
          <Search size={16} className="absolute left-3 top-3 text-muted" />
          <input className={cn(inputClass, "pl-9")} placeholder="Search name, finisher or style" value={q} onChange={(e) => setQ(e.target.value)} aria-label="Search roster" />
        </label>
        <select className={select} value={brand} onChange={(e) => setBrand(e.target.value as typeof brand)} aria-label="Brand">
          <option value="all">All brands</option>
          <option value="signed">Under contract</option>
          <option value="mayhem">WWE</option>
          <option value="fury">AEW</option>
          <option value="legends">Legends &amp; Icons</option>
          <option value="free-agents">Free agents</option>
        </select>
        <select className={select} value={style} onChange={(e) => setStyle(e.target.value as typeof style)} aria-label="Style">
          <option value="all">All styles</option>
          {STYLES.map((s) => (
            <option key={s} value={s}>
              {s}
            </option>
          ))}
        </select>
        <select className={select} value={alignment} onChange={(e) => setAlignment(e.target.value as typeof alignment)} aria-label="Alignment">
          <option value="all">Face & heel</option>
          <option value="face">Faces</option>
          <option value="heel">Heels</option>
          <option value="tweener">Tweeners</option>
        </select>
        <select className={select} value={status} onChange={(e) => setStatus(e.target.value as typeof status)} aria-label="Status">
          <option value="all">Any status</option>
          <option value="healthy">Healthy</option>
          <option value="injured">Injured</option>
          <option value="champions">Champions</option>
        </select>
      </div>

      <div className="overflow-x-auto rounded-lg border border-rope bg-canvas">
        <table className="w-full text-sm">
          <thead className="bg-canvas-2 text-left text-xs text-muted">
            <tr>
              <th className="px-3 py-2">
                <button onClick={() => toggleSort("name")} className="flex items-center gap-1 font-semibold">
                  Wrestler <SortIcon sort={sort} k="name" />
                </button>
              </th>
              <th className="hidden px-3 py-2 sm:table-cell">Brand</th>
              {COLUMNS.map((c) => (
                <th key={c.key} className={cn("px-2 py-2 text-right", c.className)} aria-sort={sort.key === c.key ? (sort.dir === 1 ? "ascending" : "descending") : "none"}>
                  <button onClick={() => toggleSort(c.key)} className="ml-auto flex items-center gap-1 font-semibold">
                    {c.label} <SortIcon sort={sort} k={c.key} />
                  </button>
                </th>
              ))}
              <th className="px-2 py-2 pr-3 text-right">
                <span className="sr-only">Look</span>
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-rope">
            {rows.map(({ w, r }) => {
              const titles = championshipsHeldBy(u, w.id);
              return (
                <tr key={w.id} className="hover:bg-canvas-2/60">
                  <td className="px-3 py-1.5">
                    <Link href={`/roster/${w.id}`} className="flex items-center gap-3">
                      <Portrait w={w} className="w-9 shrink-0" rounded="rounded" />
                      <span className="min-w-0">
                        <span className="block truncate font-semibold">
                          {w.ringName}
                          {w.versionLabel && <span className="ml-1 text-xs font-normal text-muted">{w.versionLabel}</span>}
                          {titles.length > 0 && <span className="ml-1.5 text-xs text-gold-light" title={titles.map((t) => t.name).join(", ")}>♛</span>}
                        </span>
                        <span className="block truncate text-xs text-muted">
                          {w.style} · {w.alignment}
                          {w.injury && <span className="ml-1 text-bad">· injured {w.injury.weeksRemaining}w</span>}
                        </span>
                      </span>
                    </Link>
                  </td>
                  <td className="hidden px-3 sm:table-cell">
                    <BrandBadge universe={u} brand={w.brand} />
                  </td>
                  <td className="px-2 text-right">
                    <OverallBadge value={r.overall} size="sm" />
                  </td>
                  <td className="hidden px-2 text-right tabular-nums md:table-cell">{r.inRing}</td>
                  <td className="hidden px-2 text-right tabular-nums md:table-cell">{r.entertainment}</td>
                  <td className="px-2 text-right tabular-nums">{r.popularity}</td>
                  <td className="hidden px-2 text-right tabular-nums lg:table-cell">{r.form}</td>
                  <td className="hidden px-2 text-right tabular-nums lg:table-cell">{r.potential}</td>
                  <td className="hidden px-2 text-right tabular-nums xl:table-cell">{Math.round(w.morale)}</td>
                  <td className={cn("hidden px-2 text-right tabular-nums xl:table-cell", w.fatigue >= 70 && "text-bad")}>{Math.round(w.fatigue)}</td>
                  <td className="hidden px-2 text-right tabular-nums lg:table-cell">{w.age}</td>
                  <td className="hidden px-2 text-right text-xs text-muted xl:table-cell">{w.contract.status === "signed" || (w.contract.status === "legend-deal" && w.contract.weeksRemaining > 0) ? `${w.contract.weeksRemaining} wk` : w.contract.status === "legend-deal" ? "Legend" : "Free agent"}</td>
                  <td className="px-2 pr-3 text-right">
                    <Link href={`/roster/${w.id}/look`} className="inline-grid h-8 w-8 place-items-center rounded-md text-muted hover:bg-canvas-2 hover:text-gold-light" title={`Edit ${w.ringName}'s look in 3D`} aria-label={`Edit ${w.ringName}'s look in 3D`}>
                      <Dumbbell size={16} />
                    </Link>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
        {rows.length === 0 && <p className="p-6 text-center text-muted">No wrestlers match those filters.</p>}
      </div>
    </div>
  );
}
