"use client";

import { Crown } from "lucide-react";
import Link from "next/link";
import type { ReactNode } from "react";
import { overall, ratingTier } from "@/engine/rating";
import type { BrandId, Championship, Universe, Wrestler } from "@/engine/types";
import { sideName } from "@/engine/queries";
import { cn } from "@/lib/cn";
import { Portrait } from "./Portrait";
import { Badge } from "./ui/primitives";

export const BRAND_TONE: Record<BrandId | "joint" | "shared", "mayhem" | "fury" | "legend" | "neutral" | "gold"> = {
  mayhem: "mayhem",
  fury: "fury",
  legends: "legend",
  "free-agents": "neutral",
  joint: "gold",
  shared: "gold",
};

export function BrandBadge({ universe, brand }: { universe: Universe; brand: BrandId | "joint" | "shared" }) {
  const label = brand === "joint" ? "Joint event" : brand === "shared" ? "Cross-brand" : universe.brands[brand].showName;
  return <Badge tone={BRAND_TONE[brand]}>{label}</Badge>;
}

export function OverallBadge({ value, size = "md" }: { value: number; size?: "sm" | "md" | "lg" }) {
  const tier = ratingTier(value);
  return (
    <span
      title={tier.label}
      className={cn(
        "inline-grid place-items-center rounded font-cond font-bold tabular-nums",
        size === "sm" && "h-6 min-w-7 px-1 text-sm",
        size === "md" && "h-8 min-w-9 px-1.5 text-lg",
        size === "lg" && "h-14 min-w-16 px-2 text-4xl",
        tier.tone === "gold" && "gold-plate",
        tier.tone === "emerald" && "bg-emerald-500/20 text-emerald-300",
        tier.tone === "sky" && "bg-sky-500/20 text-sky-300",
        tier.tone === "violet" && "bg-violet-500/20 text-violet-300",
        tier.tone === "zinc" && "bg-rope text-ink/80",
      )}
    >
      {value}
    </span>
  );
}

export function WrestlerChip({ universe, w, sub, href = true }: { universe: Universe; w: Wrestler; sub?: ReactNode; href?: boolean }) {
  const inner = (
    <span className="flex min-w-0 items-center gap-2.5">
      <Portrait w={w} className="w-9 shrink-0" rounded="rounded" />
      <span className="min-w-0">
        <span className="block truncate font-semibold leading-tight">
          {w.ringName}
          {w.versionLabel && <span className="ml-1 text-xs font-normal text-muted">({w.versionLabel})</span>}
        </span>
        <span className="block truncate text-xs text-muted">{sub ?? `${w.style} · ${w.alignment}`}</span>
      </span>
      <span className="ml-auto shrink-0">
        <OverallBadge value={overall(w, universe.settings)} size="sm" />
      </span>
    </span>
  );
  return href ? (
    <Link href={`/roster/${w.id}`} className="block rounded-md p-1 hover:bg-canvas-2">
      {inner}
    </Link>
  ) : (
    <div className="p-1">{inner}</div>
  );
}

export function TitlePlate({ universe, title, compact }: { universe: Universe; title: Championship; compact?: boolean }) {
  const holders = title.holderIds.map((id) => universe.wrestlers[id]).filter(Boolean);
  const reign = title.reigns.find((r) => r.endWeek == null);
  return (
    <Link href="/championships" className="group block overflow-hidden rounded-lg border border-gold/30 bg-gradient-to-br from-[#2a1f06] via-canvas to-canvas hover:border-gold/60">
      <div className="flex items-center gap-3 p-3">
        <div className="flex -space-x-3">
          {holders.length ? holders.map((h) => <Portrait key={h.id} w={h} className={cn(compact ? "w-10" : "w-12", "ring-2 ring-[#2a1f06]")} />) : <div className="grid aspect-[5/6] w-12 place-items-center rounded-md bg-rope text-xs text-muted">Vacant</div>}
        </div>
        <div className="min-w-0">
          <div className="flex items-center gap-1.5 text-xs text-gold-light">
            <Crown size={12} /> {title.shortName}
          </div>
          <div className="truncate font-semibold">{holders.length ? sideName(universe, title.holderIds) : "Vacant"}</div>
          {reign && !compact && (
            <div className="text-xs text-muted">
              {universe.week - reign.startWeek} weeks · {reign.defenses} defense{reign.defenses === 1 ? "" : "s"}
            </div>
          )}
        </div>
      </div>
    </Link>
  );
}

/** Fight-card style match-up: two portraits split by a diagonal slash. */
export function MatchupCard({
  universe,
  sides,
  title,
  footer,
  highlightWinner,
  label,
}: {
  universe: Universe;
  sides: string[][];
  title?: string | null;
  footer?: ReactNode;
  highlightWinner?: string[];
  label?: ReactNode;
}) {
  const valid = sides.filter((s) => s.length);
  const lead = (ids: string[]) => universe.wrestlers[ids[0]];
  const tone = (w: Wrestler | undefined) => (w?.brand === "fury" ? "from-fury/50" : w?.brand === "mayhem" ? "from-mayhem/50" : "from-legend/40");
  const championship = title ? universe.championships[title] : null;
  return (
    <div className={cn("overflow-hidden rounded-lg border bg-canvas", championship ? "border-gold/50" : "border-rope")}>
      {(label || championship) && (
        <div className={cn("flex items-center justify-between px-3 py-1.5 text-xs font-semibold", championship ? "gold-plate" : "bg-canvas-2 text-muted")}>
          <span>{label}</span>
          {championship && (
            <span className="flex items-center gap-1">
              <Crown size={12} /> {championship.shortName}
            </span>
          )}
        </div>
      )}
      <div className="relative flex h-28 sm:h-32">
        {valid.map((ids, i) => {
          const w = lead(ids);
          const won = highlightWinner && ids.every((id) => highlightWinner.includes(id));
          const lost = highlightWinner && highlightWinner.length > 0 && !won;
          return (
            <div
              key={i}
              className={cn(
                "relative flex flex-1 items-end overflow-hidden bg-gradient-to-t to-transparent",
                tone(w),
                valid.length === 2 && i === 0 && "slash-left -mr-6",
                valid.length === 2 && i === 1 && "slash-right -ml-6 justify-end",
                lost && "opacity-45 grayscale",
              )}
            >
              <div className={cn("absolute bottom-0 flex h-full", i === 1 && valid.length === 2 ? "right-2" : "left-2")}>
                {ids.map((id) => (
                  <Portrait key={id} w={universe.wrestlers[id]} className="h-full w-auto" rounded="rounded-none" />
                ))}
              </div>
              <div className={cn("relative z-10 w-full bg-gradient-to-t from-black/85 to-transparent p-2 pt-8", i === 1 && valid.length === 2 && "text-right")}>
                <div className="font-display text-lg leading-none sm:text-xl">{sideName(universe, ids)}</div>
                {won && <div className="mt-1 text-xs font-bold text-gold-light">WINNER</div>}
              </div>
            </div>
          );
        })}
        {valid.length >= 2 && (
          <div className="pointer-events-none absolute left-1/2 top-1/2 z-20 -translate-x-1/2 -translate-y-1/2 font-display text-2xl text-white/90 drop-shadow-[0_2px_6px_rgba(0,0,0,0.8)]">vs</div>
        )}
        {valid.length === 0 && <div className="grid flex-1 place-items-center text-sm text-muted">No participants yet</div>}
      </div>
      {footer && <div className="border-t border-rope px-3 py-2 text-sm">{footer}</div>}
    </div>
  );
}
