"use client";

import { AlertTriangle, ArrowDown, ArrowUp, Bot, Check, Crown, Gamepad2, GripVertical, Mic, Play, Plus, Swords, Trash2, X, XCircle } from "lucide-react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useMemo, useState } from "react";
import { BrandBadge, MatchupCard } from "@/components/game";
import { Badge, Button, EmptyState, Field, inputClass, PageHeader, Panel } from "@/components/ui/primitives";
import { useAction } from "@/components/WeekControls";
import { type BookingIssue, eligibleForShow, newSegment, recommendCard, type Suggestion, validateShow } from "@/engine/booking";
import { formatGameDate } from "@/engine/calendar";
import { showEconomics } from "@/engine/finance";
import { overall } from "@/engine/rating";
import { sideName } from "@/engine/queries";
import { STIPULATION_LABELS } from "@/engine/simulation";
import type { MatchType, Segment, SegmentKind, Show, Stipulation, Universe } from "@/engine/types";
import { runShow } from "@/engine/universe";
import { cn, money } from "@/lib/cn";
import { useUniverse } from "@/store/game";

const selectClass = "h-9 w-full rounded-md border border-rope bg-arena px-2 text-sm";

function findShow(u: Universe, id: string) {
  const s = u.shows.find((x) => x.id === id);
  if (!s) throw new Error("Show not found");
  return s;
}

function ParticipantSelect({ u, show, value, onChange, exclude, division, label }: { u: Universe; show: Show; value: string; onChange: (id: string) => void; exclude: string[]; division?: "men" | "women"; label: string }) {
  const options = useMemo(
    () =>
      Object.values(u.wrestlers)
        .filter((w) => eligibleForShow(u, show, w) && (!division || w.division === division) && (w.id === value || !exclude.includes(w.id)))
        .sort((a, b) => overall(b, u.settings) - overall(a, u.settings)),
    [u, show, division, exclude, value],
  );
  return (
    <select className={selectClass} value={value} onChange={(e) => onChange(e.target.value)} aria-label={label}>
      <option value="">{label}…</option>
      {options.map((w) => (
        <option key={w.id} value={w.id}>
          {w.ringName} ({overall(w, u.settings)}){w.injury ? " — INJURED" : w.fatigue >= 70 ? " — exhausted" : ""}
          {show.brand === "joint" ? ` · ${u.brands[w.brand].name}` : ""}
        </option>
      ))}
    </select>
  );
}

function SegmentEditor({ u, show, seg, index, issues, update, remove, move }: { u: Universe; show: Show; seg: Segment; index: number; issues: BookingIssue[]; update: (patch: Partial<Segment>) => void; remove: () => void; move: (dir: -1 | 1) => void }) {
  const isMatch = seg.kind === "match";
  const usedElsewhere = show.segments.filter((s) => s.id !== seg.id && s.kind === "match").flatMap((s) => [...s.sideA, ...s.sideB, ...s.sideC]);
  const all = [...seg.sideA, ...seg.sideB, ...seg.sideC];
  const division = all.length ? u.wrestlers[all[0]]?.division : undefined;
  const sizes = seg.matchType === "tag" ? [2, 2, 0] : seg.matchType === "triple-threat" ? [1, 1, 1] : [1, 1, 0];
  const titles = Object.values(u.championships).filter((t) => (show.brand === "joint" || t.brand === "shared" || t.brand === show.brand) && t.isTag === (seg.matchType === "tag"));
  const rivalries = Object.values(u.rivalries).filter((r) => r.status !== "resolved" && (show.brand === "joint" || r.brand === show.brand));
  const errors = issues.filter((i) => i.level === "error");
  const warnings = issues.filter((i) => i.level === "warning");
  const teams = Object.values(u.teams).filter((t) => t.memberIds.every((m) => eligibleForShow(u, show, u.wrestlers[m])));

  const setSlot = (side: "sideA" | "sideB" | "sideC", i: number, id: string) => {
    const arr = [...seg[side]];
    arr[i] = id;
    update({ [side]: arr.filter(Boolean) } as Partial<Segment>);
  };
  const changeType = (matchType: MatchType) => update({ matchType, sideA: seg.sideA.slice(0, matchType === "tag" ? 2 : 1), sideB: seg.sideB.slice(0, matchType === "tag" ? 2 : 1), sideC: matchType === "triple-threat" ? seg.sideC.slice(0, 1) : [], titleId: null, outcome: { mode: "simulate" } });
  const sideKeys = (["sideA", "sideB", "sideC"] as const).filter((_, i) => sizes[i] > 0);

  return (
    <div className={cn("rounded-lg border bg-canvas p-4", errors.length ? "border-bad/60" : seg.isMainEvent ? "border-gold/60" : "border-rope")}>
      <div className="mb-3 flex flex-wrap items-center gap-2">
        <GripVertical size={16} className="cursor-grab text-muted" aria-hidden />
        <span className="font-cond text-lg font-semibold text-muted">{index + 1}</span>
        <input className="h-8 min-w-0 flex-1 rounded border border-transparent bg-transparent px-1 font-semibold hover:border-rope focus:border-gold/60 focus:outline-none" value={seg.label} onChange={(e) => update({ label: e.target.value })} aria-label="Segment name" />
        {seg.isMainEvent && <Badge tone="gold">Main event</Badge>}
        <Button size="sm" variant="ghost" onClick={() => move(-1)} aria-label="Move up">
          <ArrowUp size={14} />
        </Button>
        <Button size="sm" variant="ghost" onClick={() => move(1)} aria-label="Move down">
          <ArrowDown size={14} />
        </Button>
        <Button size="sm" variant="ghost" onClick={remove} aria-label="Remove segment">
          <Trash2 size={14} />
        </Button>
      </div>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <Field label="Segment type">
          <select className={selectClass} value={seg.kind} onChange={(e) => update({ kind: e.target.value as SegmentKind, sideB: e.target.value === "match" || e.target.value === "rivalry" ? seg.sideB : [], sideC: [], titleId: null, durationMin: e.target.value === "match" ? 12 : 5 })}>
            <option value="match">Match</option>
            <option value="promo">Promo</option>
            <option value="interview">Interview</option>
            <option value="rivalry">Rivalry segment</option>
          </select>
        </Field>
        {isMatch && (
          <Field label="Match type">
            <select className={selectClass} value={seg.matchType} onChange={(e) => changeType(e.target.value as MatchType)}>
              <option value="singles">Singles</option>
              <option value="tag">Tag team</option>
              <option value="triple-threat">Triple threat</option>
            </select>
          </Field>
        )}
        {isMatch && (
          <Field label="Stipulation">
            <select className={selectClass} value={seg.stipulation} onChange={(e) => update({ stipulation: e.target.value as Stipulation })}>
              {(Object.keys(STIPULATION_LABELS) as Stipulation[]).map((s) => (
                <option key={s} value={s}>
                  {STIPULATION_LABELS[s]}
                </option>
              ))}
            </select>
          </Field>
        )}
        <Field label="Duration (minutes)">
          <input type="number" min={2} max={60} className={cn(inputClass, "h-9")} value={seg.durationMin} onChange={(e) => update({ durationMin: Number(e.target.value) || 5 })} />
        </Field>
        {isMatch && (
          <Field label="Championship">
            <select
              className={selectClass}
              value={seg.titleId ?? ""}
              onChange={(e) => {
                const titleId = e.target.value || null;
                const t = titleId ? u.championships[titleId] : null;
                // Put the champions on side A automatically.
                update(t && t.holderIds.length ? { titleId, sideA: [...t.holderIds], sideB: seg.sideB.filter((x) => !t.holderIds.includes(x)) } : { titleId });
              }}
            >
              <option value="">Non-title</option>
              {titles.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.shortName} ({t.holderIds.length ? sideName(u, t.holderIds) : "vacant"})
                </option>
              ))}
            </select>
          </Field>
        )}
        <Field label="Rivalry">
          <select className={selectClass} value={seg.rivalryId ?? ""} onChange={(e) => {
            const r = e.target.value ? u.rivalries[e.target.value] : null;
            update(r ? { rivalryId: r.id, sideA: [...r.sideA], sideB: [...r.sideB], matchType: r.sideA.length === 2 ? "tag" : seg.matchType === "triple-threat" ? "singles" : seg.matchType, sideC: [] } : { rivalryId: null });
          }}>
            <option value="">None / detect automatically</option>
            {rivalries.map((r) => (
              <option key={r.id} value={r.id}>
                {sideName(u, r.sideA)} vs {sideName(u, r.sideB)}
              </option>
            ))}
          </select>
        </Field>
        {isMatch && seg.matchType === "tag" && (
          <Field label="Quick-pick tag teams">
            <select
              className={selectClass}
              value=""
              onChange={(e) => {
                const t = u.teams[e.target.value];
                if (!t) return;
                if (seg.sideA.length < 2 && !seg.titleId) update({ sideA: [...t.memberIds] });
                else update({ sideB: [...t.memberIds] });
              }}
            >
              <option value="">Add a team…</option>
              {teams.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.name}
                </option>
              ))}
            </select>
          </Field>
        )}
        <label className="flex items-center gap-2 self-end pb-2 text-sm">
          <input type="checkbox" checked={seg.isMainEvent} onChange={(e) => update({ isMainEvent: e.target.checked })} /> Main event
        </label>
      </div>

      <div className={cn("mt-4 grid gap-3", isMatch ? (seg.matchType === "triple-threat" ? "sm:grid-cols-3" : "sm:grid-cols-2") : "sm:grid-cols-2")}>
        {isMatch ? (
          sideKeys.map((side, si) => (
            <div key={side} className="space-y-2">
              <div className="text-xs font-semibold text-muted">Side {"ABC"[si]}</div>
              {Array.from({ length: sizes[si] }).map((_, slot) => (
                <ParticipantSelect key={slot} u={u} show={show} label={seg.matchType === "tag" ? `Partner ${slot + 1}` : "Wrestler"} value={seg[side][slot] ?? ""} onChange={(id) => setSlot(side, slot, id)} exclude={[...usedElsewhere, ...all]} division={division} />
              ))}
            </div>
          ))
        ) : (
          <>
            <div className="space-y-2">
              <div className="text-xs font-semibold text-muted">{seg.kind === "rivalry" ? "Side A" : "Participants"}</div>
              {[0, 1].map((slot) => (
                <ParticipantSelect key={slot} u={u} show={show} label={slot === 0 ? "Wrestler" : "Optional second"} value={seg.sideA[slot] ?? ""} onChange={(id) => setSlot("sideA", slot, id)} exclude={all} />
              ))}
            </div>
            {seg.kind === "rivalry" && (
              <div className="space-y-2">
                <div className="text-xs font-semibold text-muted">Side B</div>
                {[0, 1].map((slot) => (
                  <ParticipantSelect key={slot} u={u} show={show} label={slot === 0 ? "Wrestler" : "Optional second"} value={seg.sideB[slot] ?? ""} onChange={(id) => setSlot("sideB", slot, id)} exclude={all} />
                ))}
              </div>
            )}
          </>
        )}
      </div>

      {isMatch && (
        <div className="mt-4 flex flex-wrap items-end gap-3 border-t border-rope pt-3">
          <Field label="Outcome">
            <select
              className={cn(selectClass, "min-w-56")}
              value={seg.outcome.mode === "simulate" ? "simulate" : seg.outcome.winnerSide}
              onChange={(e) => update({ outcome: e.target.value === "simulate" ? { mode: "simulate" } : { mode: "manual", winnerSide: e.target.value as "A" | "B" | "C" | "draw" } })}
              disabled={!!seg.playedResult}
            >
              <option value="simulate">AI-simulated (probabilistic)</option>
              {sideKeys.map((side, i) => (
                <option key={side} value={"ABC"[i]}>
                  Booked: {seg[side].length ? sideName(u, seg[side]) : `Side ${"ABC"[i]}`} wins
                </option>
              ))}
              <option value="draw">Booked: draw / no contest</option>
            </select>
          </Field>
          {seg.playedResult ? (
            <div className="flex items-center gap-2 rounded-md bg-gold/10 px-3 py-2 text-sm">
              <Gamepad2 size={15} className="text-gold-light" /> Decided in the ring: {sideName(u, seg.playedResult.winnerSide === "A" ? seg.sideA : seg.sideB)} won by {seg.playedResult.finish.toLowerCase()}
              <button className="text-muted hover:text-ink" onClick={() => update({ playedResult: null })} aria-label="Clear played result">
                <X size={14} />
              </button>
            </div>
          ) : (
            seg.matchType === "singles" &&
            seg.sideA.length === 1 &&
            seg.sideB.length === 1 && (
              <Link href={`/match?show=${show.id}&seg=${seg.id}`}>
                <Button size="sm">
                  <Gamepad2 size={15} /> Play this match
                </Button>
              </Link>
            )
          )}
        </div>
      )}

      {(errors.length > 0 || warnings.length > 0) && (
        <ul className="mt-3 space-y-1 text-sm">
          {errors.map((e, i) => (
            <li key={`e${i}`} className="flex gap-2 text-bad">
              <XCircle size={15} className="mt-0.5 shrink-0" /> {e.message}
            </li>
          ))}
          {warnings.map((e, i) => (
            <li key={`w${i}`} className="flex gap-2 text-gold-light">
              <AlertTriangle size={15} className="mt-0.5 shrink-0" /> {e.message}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

export default function ShowBookingPage() {
  const { showId } = useParams<{ showId: string }>();
  const u = useUniverse();
  const run = useAction();
  const router = useRouter();
  const [suggestions, setSuggestions] = useState<Suggestion[] | null>(null);
  const [dragIndex, setDragIndex] = useState<number | null>(null);
  const show = u.shows.find((s) => s.id === showId);
  if (!show) return <EmptyState title="Show not found" action={<Link href="/booking">Back to booking</Link>} />;
  if (show.status === "completed") {
    return <EmptyState title={`${show.name} has already happened`} action={<Link href={`/shows/${show.id}`}><Button>See results</Button></Link>} />;
  }
  const issues = validateShow(u, show);
  const hasError = issues.some((i) => i.level === "error");
  const globalIssues = issues.filter((i) => !i.segmentId);
  const venue = u.venues.find((v) => v.id === show.venueId);
  const booked = [...new Set(show.segments.flatMap((s) => [...s.sideA, ...s.sideB, ...s.sideC]))];
  const projection = venue ? showEconomics(u, show, 65, booked, 0) : null;
  const isFuture = show.week > u.week;
  const earlierPending = u.shows.some((s) => s.week === show.week && s.status === "planned" && s.dayOffset < show.dayOffset);

  const mutateShow = (fn: (s: Show, d: Universe) => void) => run((d) => fn(findShow(d, show.id), d));
  const updateSeg = (segId: string, patch: Partial<Segment>) =>
    mutateShow((s) => {
      const seg = s.segments.find((x) => x.id === segId)!;
      if (patch.isMainEvent) s.segments.forEach((x) => (x.isMainEvent = false));
      Object.assign(seg, patch);
      const sidesChanged = "sideA" in patch || "sideB" in patch || "sideC" in patch;
      if (sidesChanged && !("playedResult" in patch)) seg.playedResult = null;
    });
  const moveSeg = (from: number, to: number) =>
    mutateShow((s) => {
      if (to < 0 || to >= s.segments.length) return;
      const [item] = s.segments.splice(from, 1);
      s.segments.splice(to, 0, item);
    });
  const addSeg = (kind: SegmentKind) => mutateShow((s, d) => s.segments.push(newSegment(d, kind)));

  return (
    <div className="space-y-6">
      <PageHeader
        title={show.name}
        subtitle={
          <span className="flex flex-wrap items-center gap-2">
            <BrandBadge universe={u} brand={show.brand} /> {formatGameDate(u.startDate, show.week, show.dayOffset)}
            {show.type === "ple" && <span className="text-gold-light">· Premium live event</span>}
          </span>
        }
        actions={
          <>
            <Button
              onClick={() => {
                const preview = structuredClone(u);
                const ps = findShow(preview, show.id);
                setSuggestions(recommendCard(preview, ps));
              }}
            >
              <Bot size={16} /> AI Booker
            </Button>
            <Button
              variant="gold"
              disabled={hasError || isFuture || earlierPending}
              title={isFuture ? "This show is in a future week" : earlierPending ? "Run this week's earlier shows first" : hasError ? "Fix the errors on the card first" : ""}
              onClick={() => {
                const res = run((d) => runShow(d, show.id));
                if (res) router.push(`/shows/${show.id}`);
              }}
            >
              <Play size={16} /> Run show
            </Button>
          </>
        }
      />

      {suggestions && (
        <Panel
          title={<span className="flex items-center gap-2"><Bot size={18} /> AI Booker recommendations</span>}
          action={
            <div className="flex gap-2">
              <Button
                size="sm"
                variant="gold"
                onClick={() => {
                  mutateShow((s, d) => {
                    s.segments = suggestions.map((x) => ({ ...x.segment, id: `${x.segment.id}-${d.counters.nextId++}` }));
                  });
                  setSuggestions(null);
                }}
              >
                <Check size={14} /> Replace card with all
              </Button>
              <Button size="sm" variant="ghost" onClick={() => setSuggestions(null)}>
                Dismiss
              </Button>
            </div>
          }
        >
          <p className="mb-3 text-sm text-muted">Heuristic recommendations (no external AI). Score = 50% projected match quality + 30% storyline value + 20% star power.</p>
          <div className="grid gap-3 md:grid-cols-2">
            {suggestions.map((sg, i) => (
              <div key={sg.segment.id} className="rounded-lg border border-rope bg-arena/60 p-3">
                <div className="flex items-center justify-between gap-2">
                  <div className="font-semibold">
                    {sg.segment.label}: {sideName(u, sg.segment.sideA)}
                    {sg.segment.sideB.length > 0 && ` vs ${sideName(u, sg.segment.sideB)}`}
                  </div>
                  <span className="gold-plate rounded px-2 py-0.5 font-cond font-bold">{sg.score}</span>
                </div>
                <ul className="mt-2 list-disc space-y-0.5 pl-5 text-sm text-muted">
                  {sg.reasons.map((r, j) => (
                    <li key={j}>{r}</li>
                  ))}
                </ul>
                <div className="mt-3 flex gap-2">
                  <Button
                    size="sm"
                    onClick={() => {
                      mutateShow((s, d) => {
                        if (sg.segment.isMainEvent) s.segments.forEach((x) => (x.isMainEvent = false));
                        s.segments.push({ ...structuredClone(sg.segment), id: `${sg.segment.id}-${d.counters.nextId++}` });
                      });
                      setSuggestions((list) => list!.filter((_, j) => j !== i));
                    }}
                  >
                    <Check size={14} /> Accept
                  </Button>
                  <Button size="sm" variant="ghost" onClick={() => setSuggestions((list) => list!.filter((_, j) => j !== i))}>
                    <X size={14} /> Reject
                  </Button>
                </div>
              </div>
            ))}
            {suggestions.length === 0 && <p className="text-sm text-muted">No more suggestions. Accepted segments are on the card above, where you can edit them.</p>}
          </div>
        </Panel>
      )}
      <div className="grid gap-6 xl:grid-cols-[1fr_340px]">
        <div className="space-y-4">
          {globalIssues.length > 0 && (
            <ul className="space-y-1 rounded-lg border border-rope bg-canvas p-3 text-sm">
              {globalIssues.map((e, i) => (
                <li key={i} className={cn("flex gap-2", e.level === "error" ? "text-bad" : "text-gold-light")}>
                  {e.level === "error" ? <XCircle size={15} className="mt-0.5 shrink-0" /> : <AlertTriangle size={15} className="mt-0.5 shrink-0" />} {e.message}
                </li>
              ))}
            </ul>
          )}

          {show.segments.length === 0 && (
            <EmptyState title="An empty card" action={<Button onClick={() => addSeg("match")}><Plus size={16} /> Add the first match</Button>}>
              Add matches and promos below, or ask the AI Booker for a recommended card you can accept, reject or edit.
            </EmptyState>
          )}

          {show.segments.map((seg, i) => (
            <div
              key={seg.id}
              draggable
              onDragStart={() => setDragIndex(i)}
              onDragOver={(e) => e.preventDefault()}
              onDrop={() => {
                if (dragIndex != null && dragIndex !== i) moveSeg(dragIndex, i);
                setDragIndex(null);
              }}
              className={cn(dragIndex === i && "opacity-50")}
            >
              <SegmentEditor u={u} show={show} seg={seg} index={i} issues={issues.filter((x) => x.segmentId === seg.id)} update={(p) => updateSeg(seg.id, p)} remove={() => mutateShow((s) => (s.segments = s.segments.filter((x) => x.id !== seg.id)))} move={(dir) => moveSeg(i, i + dir)} />
            </div>
          ))}

          <div className="flex flex-wrap gap-2">
            <Button onClick={() => addSeg("match")}>
              <Swords size={15} /> Add match
            </Button>
            <Button onClick={() => addSeg("promo")}>
              <Mic size={15} /> Add promo
            </Button>
            <Button onClick={() => addSeg("interview")}>
              <Mic size={15} /> Add interview
            </Button>
            <Button onClick={() => addSeg("rivalry")}>
              <Crown size={15} /> Add rivalry segment
            </Button>
          </div>
        </div>

        <div className="space-y-4 xl:sticky xl:top-20 xl:self-start">
          <Panel title="Show settings">
            <div className="space-y-3">
              <Field label="Show name">
                <input className={cn(inputClass, "h-9")} value={show.name} onChange={(e) => mutateShow((s) => (s.name = e.target.value))} maxLength={40} />
              </Field>
              <Field label="Venue">
                <select className={selectClass} value={show.venueId} onChange={(e) => mutateShow((s) => (s.venueId = e.target.value))}>
                  {u.venues.map((v) => (
                    <option key={v.id} value={v.id}>
                      {v.name}, {v.city} — {v.capacity.toLocaleString()} seats, {money(v.rent)}
                    </option>
                  ))}
                </select>
              </Field>
              <div className="grid grid-cols-2 gap-3">
                <Field label="Ticket price ($)">
                  <input type="number" min={5} max={500} className={cn(inputClass, "h-9")} value={show.ticketPrice} onChange={(e) => mutateShow((s) => (s.ticketPrice = Number(e.target.value) || 5))} />
                </Field>
                <Field label="Marketing ($)">
                  <input type="number" min={0} step={10000} className={cn(inputClass, "h-9")} value={show.marketingSpend} onChange={(e) => mutateShow((s) => (s.marketingSpend = Math.max(0, Number(e.target.value) || 0)))} />
                </Field>
              </div>
              {projection && venue && (
                <dl className="space-y-1 rounded-md bg-arena p-3 text-sm">
                  <div className="flex justify-between">
                    <dt className="text-muted">Projected attendance</dt>
                    <dd>
                      {projection.attendance.toLocaleString()} / {venue.capacity.toLocaleString()}
                    </dd>
                  </div>
                  <div className="flex justify-between">
                    <dt className="text-muted">Projected revenue</dt>
                    <dd>{money(Object.values(projection.revenue).reduce((a, b) => a + b, 0))}</dd>
                  </div>
                  <div className="flex justify-between">
                    <dt className="text-muted">Show costs</dt>
                    <dd>{money(Object.values(projection.expenses).reduce((a, b) => a + b, 0))}</dd>
                  </div>
                  <p className="pt-1 text-xs text-muted">Estimate assumes an average show. Star power, brand popularity, ticket price and marketing drive the crowd.</p>
                </dl>
              )}
            </div>
          </Panel>
          {show.segments.length > 0 && (
            <Panel title="Card preview">
              <div className="space-y-2">
                {show.segments
                  .filter((s) => s.kind === "match" && s.sideA.length && s.sideB.length)
                  .map((s) => (
                    <MatchupCard key={s.id} universe={u} sides={[s.sideA, s.sideB, s.sideC]} title={s.titleId} label={s.isMainEvent ? "Main event" : s.label} />
                  ))}
              </div>
            </Panel>
          )}
        </div>
      </div>

    </div>
  );
}
