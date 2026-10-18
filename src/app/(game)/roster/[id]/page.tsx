"use client";

import { weekLabel } from "@/engine/calendar";
import { Copy, Dumbbell, Gamepad2, Pencil } from "lucide-react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { BrandBadge, OverallBadge } from "@/components/game";
import { Portrait } from "@/components/Portrait";
import { Badge, Button, EmptyState, Meter, Panel, Stars } from "@/components/ui/primitives";
import { useAction } from "@/components/WeekControls";
import { overallContributions, ratingCard, ratingTier } from "@/engine/rating";
import { activeRivalriesFor, sideName } from "@/engine/queries";
import { ATTRIBUTE_LABELS, RIVALRY_STAGES } from "@/engine/types";
import { ATTRIBUTE_GROUPS, AttrBar } from "@/components/attributes";
import { createAlternateVersion } from "@/engine/universe";
import { cn, heightLabel, money } from "@/lib/cn";
import { useUniverse } from "@/store/game";

export default function WrestlerProfile() {
  const { id } = useParams<{ id: string }>();
  const u = useUniverse();
  const router = useRouter();
  const run = useAction();
  const w = u.wrestlers[id];
  if (!w) return <EmptyState title="Wrestler not found" action={<Link href="/roster">Back to roster</Link>} />;

  const r = ratingCard(w, u.settings);
  const contributions = overallContributions(w, u.settings).slice(0, 8);
  const reigns = Object.values(u.championships).flatMap((c) => c.reigns.filter((x) => x.holderIds.includes(w.id)).map((x) => ({ c, x })));
  const rivalries = activeRivalriesFor(u, w.id);
  const team = w.teamId ? u.teams[w.teamId] : null;
  const matches = u.history.filter((h) => [...h.sideA, ...h.sideB, ...h.sideC].includes(w.id)).slice(-8).reverse();
  const versions = Object.values(u.wrestlers).filter((o) => o.id !== w.id && (o.baseId === (w.baseId ?? w.id) || o.id === w.baseId));
  const signed = w.brand === "mayhem" || w.brand === "fury";

  return (
    <div className="space-y-6">
      <section className="relative overflow-hidden rounded-xl border border-rope bg-canvas">
        <div className={cn("absolute inset-0 opacity-40", w.brand === "fury" ? "bg-gradient-to-r from-fury/50" : w.brand === "mayhem" ? "bg-gradient-to-r from-mayhem/50" : "bg-gradient-to-r from-legend/40")} />
        <div className="relative grid gap-6 p-5 sm:grid-cols-[220px_1fr] sm:p-6">
          <Portrait w={w} className="w-44 sm:w-full" />
          <div className="flex min-w-0 flex-col">
            <div className="flex flex-wrap items-center gap-2">
              <BrandBadge universe={u} brand={w.brand} />
              <Badge tone={w.alignment === "heel" ? "bad" : w.alignment === "face" ? "good" : "neutral"}>{w.alignment}</Badge>
              {w.versionLabel && <Badge tone="legend">{w.versionLabel}</Badge>}
              {w.isCustom && <Badge>custom</Badge>}
              {w.injury && <Badge tone="bad">Injured: {w.injury.description} ({w.injury.weeksRemaining} wk)</Badge>}
            </div>
            <h1 className="font-display mt-3 text-5xl sm:text-7xl">{w.ringName}</h1>
            <p className="mt-1 text-lg text-muted">“{w.nickname}”</p>
            <dl className="mt-4 grid grid-cols-2 gap-x-6 gap-y-1 text-sm sm:grid-cols-4">
              <div>
                <dt className="text-muted">Height / weight</dt>
                <dd>
                  {heightLabel(w.heightIn)} · {w.weightLbs} lb
                </dd>
              </div>
              <div>
                <dt className="text-muted">Class</dt>
                <dd className="capitalize">{w.weightClass.replace("-", " ")}</dd>
              </div>
              <div>
                <dt className="text-muted">Style</dt>
                <dd className="capitalize">{w.style}</dd>
              </div>
              <div>
                <dt className="text-muted">Age · era</dt>
                <dd className="capitalize">
                  {w.age} · {w.era}
                </dd>
              </div>
              <div>
                <dt className="text-muted">Record</dt>
                <dd>
                  {w.record.wins}–{w.record.losses}–{w.record.draws}
                </dd>
              </div>
              <div>
                <dt className="text-muted">Trajectory</dt>
                <dd className="capitalize">{w.trend}</dd>
              </div>
              <div>
                <dt className="text-muted">Entrance theme</dt>
                <dd>“{w.theme}”</dd>
              </div>
              <div>
                <dt className="text-muted">Real name</dt>
                <dd>{w.name}</dd>
              </div>
            </dl>
            <div className="mt-auto flex flex-wrap gap-2 pt-5">
              <Link href={`/roster/${w.id}/edit`}>
                <Button variant="primary">
                  <Pencil size={15} /> Edit ratings & details
                </Button>
              </Link>
              <Link href={`/roster/${w.id}/look`}>
                <Button variant="gold">
                  <Dumbbell size={15} /> Edit look in 3D
                </Button>
              </Link>
              <Link href={`/match?p=${w.id}`}>
                <Button>
                  <Gamepad2 size={15} /> Play as {w.ringName.split(" ")[0]}
                </Button>
              </Link>
              <Button
                onClick={() => {
                  const label = window.prompt("Label for the alternate version (e.g. “Rookie 2015”, “Monster heel”)", "Alternate");
                  if (!label) return;
                  const copy = run((d) => createAlternateVersion(d, w.id, label), "Alternate version created as a free agent");
                  if (copy) router.push(`/roster/${copy.id}/edit`);
                }}
              >
                <Copy size={15} /> Create alternate version
              </Button>
              {!signed && (
                <Link href={`/contracts?w=${w.id}`}>
                  <Button variant="gold">Offer contract</Button>
                </Link>
              )}
            </div>
          </div>
        </div>
      </section>

      <div className="grid gap-4 sm:grid-cols-3 lg:grid-cols-6">
        {[
          ["Overall", r.overall, r.isOverridden ? `manual (formula ${r.formulaOverall})` : ratingTier(r.overall).label],
          ["In-ring", r.inRing, "style-weighted"],
          ["Entertainment", r.entertainment, "charisma · promo · crowd"],
          ["Popularity", r.popularity, "fan support"],
          ["Current form", r.form, "momentum, morale, fatigue"],
          ["Potential", r.potential, "development ceiling"],
        ].map(([label, value, hint]) => (
          <Panel key={label as string} className="p-4">
            <div className="text-xs text-muted">{label}</div>
            <div className="mt-1 flex items-center gap-2">
              <OverallBadge value={value as number} />
            </div>
            <div className="mt-1 text-xs text-muted">{hint}</div>
          </Panel>
        ))}
      </div>

      <div className="grid gap-6 lg:grid-cols-[1.4fr_1fr]">
        <Panel title="Attributes">
          <div className="grid gap-x-8 gap-y-5 sm:grid-cols-2">
            {ATTRIBUTE_GROUPS.map((g) => (
              <div key={g.label} className="space-y-2">
                <h3 className="font-cond text-sm font-semibold text-gold-light">{g.label}</h3>
                {g.keys.map((k) => (
                  <AttrBar key={k} label={ATTRIBUTE_LABELS[k]} value={w.attributes[k]} />
                ))}
              </div>
            ))}
          </div>
        </Panel>
        <div className="space-y-6">
          <Panel title="Why this overall">
            <p className="mb-3 text-xs text-muted">
              Overall = 78% style-weighted in-ring + 12% entertainment + 10% big-match. As a {w.style}, these attributes carry the most weight:
            </p>
            <ul className="space-y-1.5 text-sm">
              {contributions.map((c) => (
                <li key={c.key} className="flex items-center gap-3">
                  <span className="w-32 shrink-0 text-muted">{ATTRIBUTE_LABELS[c.key]}</span>
                  <div className="flex-1">
                    <Meter value={c.weight * 100} max={20} tone="gold" />
                  </div>
                  <span className="w-12 text-right tabular-nums">{(c.weight * 100).toFixed(1)}%</span>
                </li>
              ))}
            </ul>
          </Panel>
          <Panel title="Moveset">
            <dl className="space-y-2 text-sm">
              <div>
                <dt className="text-muted">Finisher</dt>
                <dd className="font-display text-2xl text-gold-light">{w.finisher}</dd>
              </div>
              <div>
                <dt className="text-muted">Signatures</dt>
                <dd>{w.signatures.join(" · ")}</dd>
              </div>
            </dl>
          </Panel>
          <Panel title="Status">
            <div className="space-y-3 text-sm">
              {(
                [
                  ["Morale", w.morale, w.morale < 45 ? "bad" : "good"],
                  ["Momentum", w.momentum, "gold"],
                  ["Fatigue", w.fatigue, w.fatigue >= 70 ? "bad" : "ink"],
                ] as const
              ).map(([label, v, tone]) => (
                <div key={label}>
                  <div className="flex justify-between">
                    <span className="text-muted">{label}</span>
                    <span className="tabular-nums">{Math.round(v)}</span>
                  </div>
                  <Meter value={v} tone={tone} />
                </div>
              ))}
              <div className="flex justify-between border-t border-rope pt-3">
                <span className="text-muted">Contract</span>
                <span>
                  {w.contract.status === "free-agent"
                    ? `Free agent · asks ~${money(w.contract.weeklySalary)}/wk`
                    : w.contract.status === "legend-deal" && !signed
                      ? `Legend · asks ~${money(w.contract.weeklySalary)}/wk`
                      : `${money(w.contract.weeklySalary)}/wk · ${w.contract.weeksRemaining} wk left`}
                </span>
              </div>
            </div>
          </Panel>
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        <Panel title="Championship history">
          {reigns.length === 0 ? (
            <p className="text-sm text-muted">No title reigns yet.</p>
          ) : (
            <ul className="space-y-2 text-sm">
              {reigns.map(({ c, x }, i) => (
                <li key={i}>
                  <span className="text-gold-light">{c.name}</span>
                  <div className="text-xs text-muted">
                    {weekLabel(x.startWeek)} → {x.endWeek == null ? "present" : weekLabel(x.endWeek)} · {x.defenses} defenses
                    {x.holderIds.length > 1 && ` · with ${sideName(u, x.holderIds.filter((h) => h !== w.id))}`}
                  </div>
                </li>
              ))}
            </ul>
          )}
        </Panel>
        <Panel title="Rivalries & alliances">
          <ul className="space-y-2 text-sm">
            {team && (
              <li>
                Tag team: <span className="font-semibold">{team.name}</span> with {sideName(u, team.memberIds.filter((m) => m !== w.id))} · chemistry {team.chemistry}
              </li>
            )}
            {rivalries.map((r) => (
              <li key={r.id}>
                <Link href="/rivalries" className="hover:underline">
                  vs <span className="font-semibold">{sideName(u, r.sideA.includes(w.id) ? r.sideB : r.sideA)}</span>
                </Link>
                <span className="text-muted"> · {RIVALRY_STAGES[r.stage]} · intensity {Math.round(r.intensity)}</span>
              </li>
            ))}
            {!team && rivalries.length === 0 && <li className="text-muted">No team or active rivalries.</li>}
          </ul>
          {versions.length > 0 && (
            <div className="mt-4 border-t border-rope pt-3 text-sm">
              <div className="mb-1 text-muted">Other versions</div>
              {versions.map((v) => (
                <Link key={v.id} href={`/roster/${v.id}`} className="block hover:underline">
                  {v.ringName} — {v.versionLabel ?? "original"}
                </Link>
              ))}
            </div>
          )}
        </Panel>
        <Panel title="Recent matches">
          <ul className="space-y-2 text-sm">
            {matches.map((m) => (
              <li key={m.id} className="flex items-center gap-2">
                <span className={cn("w-5 font-bold", m.winnerIds.includes(w.id) ? "text-good" : m.winnerIds.length ? "text-bad" : "text-muted")}>{m.winnerIds.includes(w.id) ? "W" : m.winnerIds.length ? "L" : "D"}</span>
                <span className="min-w-0 flex-1 truncate">
                  vs {sideName(u, [m.sideA, m.sideB, m.sideC].find((s) => s.length && !s.includes(w.id)) ?? [])}
                  <span className="text-xs text-muted"> · wk {m.week + 1}</span>
                </span>
                <Stars value={m.stars} />
              </li>
            ))}
            {matches.length === 0 && <li className="text-muted">No matches yet.</li>}
          </ul>
        </Panel>
      </div>
    </div>
  );
}
