"use client";

import { Lightbulb, Pause, Play, Plus, Swords, Flag } from "lucide-react";
import { useMemo, useState } from "react";
import { BrandBadge } from "@/components/game";
import { Portrait } from "@/components/Portrait";
import { Badge, Button, Field, inputClass, Meter, Modal, PageHeader, Panel, Tabs } from "@/components/ui/primitives";
import { useAction } from "@/components/WeekControls";
import { newSegment } from "@/engine/booking";
import { sideName } from "@/engine/queries";
import { overall } from "@/engine/rating";
import { createRivalry, storySuggestions, type StorySuggestion } from "@/engine/storyline";
import { RIVALRY_STAGES, type Rivalry, type RivalryPayoff, type RivalryStage, type Universe } from "@/engine/types";
import { disbandTeam } from "@/engine/universe";
import { cn } from "@/lib/cn";
import { useUniverse } from "@/store/game";

const PAYOFF_LABEL: Record<RivalryPayoff, string> = {
  "title-match": "Championship match",
  "grudge-match": "Grudge match",
  "stipulation-match": "Stipulation match",
  "tag-showdown": "Tag-team showdown",
};
const selectClass = "h-10 w-full rounded-md border border-rope bg-arena px-2 text-sm";

function applySuggestion(d: Universe, s: StorySuggestion) {
  const a = s.action;
  if (a.type === "create-rivalry") createRivalry(d, { sideA: a.sideA, sideB: a.sideB, payoff: a.payoff, titleId: a.titleId, origin: a.origin, intensity: 40 });
  if (a.type === "turn") {
    const w = d.wrestlers[a.wrestlerId];
    w.alignment = a.to;
    w.momentum = Math.min(100, w.momentum + 10);
    d.news.push({ week: d.week, text: `${w.ringName} has turned ${a.to}!`, tone: "neutral" });
  }
  if (a.type === "split-team") {
    const team = d.teams[a.teamId];
    const [x, y] = team.memberIds;
    const name = team.name;
    disbandTeam(d, a.teamId);
    d.wrestlers[x].alignment = "heel";
    createRivalry(d, { sideA: [y], sideB: [x], payoff: "grudge-match", titleId: null, origin: `${d.wrestlers[x].ringName} betrayed ${d.wrestlers[y].ringName}, ending ${name}.`, intensity: 60 });
    d.news.push({ week: d.week, text: `${name} is no more after a shocking betrayal.`, tone: "neutral" });
  }
}

function RivalryCard({ u, r }: { u: Universe; r: Rivalry }) {
  const run = useAction();
  const [editing, setEditing] = useState(false);
  const nextShow = u.shows.filter((s) => s.status === "planned" && (s.brand === r.brand || s.brand === "joint")).sort((a, b) => a.week - b.week || a.dayOffset - b.dayOffset)[0];
  const title = r.titleId ? u.championships[r.titleId] : null;
  const bookIt = (kind: "match" | "rivalry") =>
    run((d) => {
      const show = d.shows.find((s) => s.id === nextShow!.id)!;
      const tag = r.sideA.length === 2 && r.sideB.length === 2;
      show.segments.push(newSegment(d, kind, { label: kind === "match" ? "Rivalry match" : "Rivalry segment", matchType: tag ? "tag" : "singles", sideA: [...r.sideA], sideB: [...r.sideB], rivalryId: r.id, durationMin: kind === "match" ? 14 : 6 }));
    }, `Added to ${nextShow!.name} (week ${nextShow!.week + 1})`);

  return (
    <div className={cn("rounded-lg border bg-canvas p-4", r.status === "active" ? "border-rope" : "border-rope/50 opacity-80")}>
      <div className="flex flex-wrap items-center gap-3">
        <div className="flex -space-x-2">
          {[...r.sideA, ...r.sideB].map((id) => (
            <Portrait key={id} w={u.wrestlers[id]} className="w-10 ring-2 ring-canvas" rounded="rounded" />
          ))}
        </div>
        <div className="min-w-0 flex-1">
          <div className="font-display text-xl leading-tight">
            {sideName(u, r.sideA)} <span className="text-muted">vs</span> {sideName(u, r.sideB)}
          </div>
          <div className="mt-1 flex flex-wrap items-center gap-2 text-xs">
            <BrandBadge universe={u} brand={r.brand} />
            <Badge>{PAYOFF_LABEL[r.payoff]}</Badge>
            {title && <Badge tone="gold">{title.shortName}</Badge>}
            {r.status !== "active" && <Badge tone={r.status === "paused" ? "neutral" : "good"}>{r.status}</Badge>}
            <span className="text-muted">
              Since week {Math.max(1, r.startWeek + 1)} · series {r.aWins}–{r.bWins}
            </span>
          </div>
        </div>
      </div>
      <ol className="mt-4 grid grid-cols-5 gap-1" aria-label="Storyline stage">
        {RIVALRY_STAGES.map((s, i) => (
          <li key={s} className={cn("rounded px-1 py-1 text-center text-[11px] font-semibold", i < r.stage ? "bg-mayhem/30 text-ink" : i === r.stage ? "bg-mayhem text-white" : "bg-rope text-muted")} aria-current={i === r.stage ? "step" : undefined}>
            {s}
          </li>
        ))}
      </ol>
      <div className="mt-3 grid gap-3 sm:grid-cols-2">
        <div>
          <div className="flex justify-between text-xs text-muted">
            <span>Intensity</span>
            <span>{Math.round(r.intensity)}</span>
          </div>
          <Meter value={r.intensity} tone="bad" />
        </div>
        <div>
          <div className="flex justify-between text-xs text-muted">
            <span>Fan interest</span>
            <span>{Math.round(r.fanInterest)}</span>
          </div>
          <Meter value={r.fanInterest} tone="gold" />
        </div>
      </div>
      <ol className="mt-3 max-h-32 space-y-1 overflow-y-auto border-l border-rope pl-3 text-sm">
        {[...r.events].reverse().map((e, i) => (
          <li key={i}>
            <span className="text-xs text-muted">{e.week < 0 ? "Before" : `Wk ${e.week + 1}`} · </span>
            {e.text}
          </li>
        ))}
      </ol>
      <div className="mt-4 flex flex-wrap gap-2">
        {r.status !== "resolved" && nextShow && (
          <>
            <Button size="sm" onClick={() => bookIt("rivalry")}>
              <Plus size={14} /> Confrontation on {nextShow.name}
            </Button>
            <Button size="sm" onClick={() => bookIt("match")}>
              <Swords size={14} /> Match on {nextShow.name}
            </Button>
          </>
        )}
        {r.status === "active" && (
          <Button size="sm" variant="ghost" onClick={() => run((d) => void (d.rivalries[r.id].status = "paused"), "Rivalry paused")}>
            <Pause size={14} /> Pause
          </Button>
        )}
        {r.status === "paused" && (
          <Button size="sm" variant="ghost" onClick={() => run((d) => void Object.assign(d.rivalries[r.id], { status: "active", lastActiveWeek: d.week }), "Rivalry resumed")}>
            <Play size={14} /> Resume
          </Button>
        )}
        {r.status !== "resolved" && (
          <Button
            size="sm"
            variant="ghost"
            onClick={() =>
              window.confirm("End this rivalry?") &&
              run((d) => {
                const x = d.rivalries[r.id];
                x.status = "resolved";
                x.stage = 4;
                x.events.push({ week: d.week, text: "Management declared the rivalry over." });
              }, "Rivalry ended")
            }
          >
            <Flag size={14} /> End
          </Button>
        )}
        <Button size="sm" variant="ghost" onClick={() => setEditing(true)}>
          Edit
        </Button>
      </div>
      <Modal open={editing} onClose={() => setEditing(false)} title="Edit rivalry">
        <EditRivalry u={u} r={r} onDone={() => setEditing(false)} />
      </Modal>
    </div>
  );
}

function EditRivalry({ u, r, onDone }: { u: Universe; r: Rivalry; onDone: () => void }) {
  const run = useAction();
  const [intensity, setIntensity] = useState(Math.round(r.intensity));
  const [stage, setStage] = useState<RivalryStage>(r.stage);
  const [payoff, setPayoff] = useState(r.payoff);
  const [titleId, setTitleId] = useState(r.titleId ?? "");
  return (
    <div className="space-y-3">
      <Field label={`Intensity (${intensity})`}>
        <input type="range" min={0} max={100} value={intensity} onChange={(e) => setIntensity(Number(e.target.value))} className="w-full" />
      </Field>
      <Field label="Stage">
        <select className={selectClass} value={stage} onChange={(e) => setStage(Number(e.target.value) as RivalryStage)}>
          {RIVALRY_STAGES.map((s, i) => (
            <option key={s} value={i}>
              {s}
            </option>
          ))}
        </select>
      </Field>
      <Field label="Desired payoff">
        <select className={selectClass} value={payoff} onChange={(e) => setPayoff(e.target.value as RivalryPayoff)}>
          {Object.entries(PAYOFF_LABEL).map(([k, v]) => (
            <option key={k} value={k}>
              {v}
            </option>
          ))}
        </select>
      </Field>
      <Field label="Championship implications">
        <select className={selectClass} value={titleId} onChange={(e) => setTitleId(e.target.value)}>
          <option value="">None</option>
          {Object.values(u.championships).map((t) => (
            <option key={t.id} value={t.id}>
              {t.name}
            </option>
          ))}
        </select>
      </Field>
      <div className="flex justify-end">
        <Button
          variant="gold"
          onClick={() => {
            run((d) => Object.assign(d.rivalries[r.id], { intensity, stage, payoff, titleId: titleId || null, status: stage === 4 ? "resolved" : d.rivalries[r.id].status }), "Rivalry updated");
            onDone();
          }}
        >
          Save
        </Button>
      </div>
    </div>
  );
}

function CreateRivalry({ u, onDone }: { u: Universe; onDone: () => void }) {
  const run = useAction();
  const [a, setA] = useState(["", ""]);
  const [b, setB] = useState(["", ""]);
  const [payoff, setPayoff] = useState<RivalryPayoff>("grudge-match");
  const [titleId, setTitleId] = useState("");
  const [origin, setOrigin] = useState("");
  const pool = useMemo(() => Object.values(u.wrestlers).filter((w) => w.brand === "mayhem" || w.brand === "fury").sort((x, y) => overall(y, u.settings) - overall(x, u.settings)), [u]);
  const sideA = a.filter(Boolean);
  const sideB = b.filter(Boolean);
  const pick = (vals: string[], set: (v: string[]) => void, i: number, label: string) => (
    <select className={selectClass} value={vals[i]} onChange={(e) => set(vals.map((v, j) => (j === i ? e.target.value : v)))} aria-label={label}>
      <option value="">{label}</option>
      {pool.map((w) => (
        <option key={w.id} value={w.id} disabled={[...sideA, ...sideB].includes(w.id) && vals[i] !== w.id}>
          {w.ringName} · {u.brands[w.brand].name}
        </option>
      ))}
    </select>
  );
  const valid = sideA.length > 0 && sideB.length > 0 && sideA.length === sideB.length;
  return (
    <div className="space-y-3">
      <div className="grid gap-3 sm:grid-cols-2">
        <div className="space-y-2">
          <div className="text-sm text-muted">Side A</div>
          {pick(a, setA, 0, "Wrestler")}
          {pick(a, setA, 1, "Partner (optional)")}
        </div>
        <div className="space-y-2">
          <div className="text-sm text-muted">Side B</div>
          {pick(b, setB, 0, "Wrestler")}
          {pick(b, setB, 1, "Partner (optional)")}
        </div>
      </div>
      <Field label="Desired payoff">
        <select className={selectClass} value={payoff} onChange={(e) => setPayoff(e.target.value as RivalryPayoff)}>
          {Object.entries(PAYOFF_LABEL).map(([k, v]) => (
            <option key={k} value={k}>
              {v}
            </option>
          ))}
        </select>
      </Field>
      <Field label="Championship implications">
        <select className={selectClass} value={titleId} onChange={(e) => setTitleId(e.target.value)}>
          <option value="">None</option>
          {Object.values(u.championships).map((t) => (
            <option key={t.id} value={t.id}>
              {t.name}
            </option>
          ))}
        </select>
      </Field>
      <Field label="How it started">
        <input className={inputClass} value={origin} onChange={(e) => setOrigin(e.target.value)} placeholder="e.g. A sneak attack after the main event" maxLength={140} />
      </Field>
      {sideA.length !== sideB.length && sideA.length > 0 && sideB.length > 0 && <p className="text-sm text-bad">Both sides need the same number of wrestlers.</p>}
      <div className="flex justify-end">
        <Button
          variant="gold"
          disabled={!valid}
          onClick={() => {
            run((d) => createRivalry(d, { sideA, sideB, payoff, titleId: titleId || null, origin: origin.trim() || `${sideName(d, sideA)} and ${sideName(d, sideB)} have unfinished business.`, intensity: 35 }), "Rivalry started");
            onDone();
          }}
        >
          Start rivalry
        </Button>
      </div>
    </div>
  );
}

export default function RivalriesPage() {
  const u = useUniverse();
  const run = useAction();
  const [tab, setTab] = useState<"active" | "paused" | "resolved">("active");
  const [creating, setCreating] = useState(false);
  const [dismissed, setDismissed] = useState<string[]>([]);
  const list = Object.values(u.rivalries)
    .filter((r) => r.status === tab)
    .sort((a, b) => b.intensity - a.intensity);
  const suggestions = storySuggestions(u).filter((s) => !dismissed.includes(s.id));

  return (
    <div className="space-y-6">
      <PageHeader
        title="Rivalries"
        subtitle="Feuds move through five stages. Matches and confrontations raise intensity; neglected rivalries cool off and fizzle."
        actions={
          <Button variant="gold" onClick={() => setCreating(true)}>
            <Plus size={16} /> Start a rivalry
          </Button>
        }
      />
      {suggestions.length > 0 && (
        <Panel title={<span className="flex items-center gap-2"><Lightbulb size={17} /> Storyline ideas</span>}>
          <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
            {suggestions.map((s) => (
              <div key={s.id} className="rounded-md border border-rope bg-arena/60 p-3">
                <div className="font-semibold">{s.title}</div>
                <p className="mt-1 text-sm text-muted">{s.description}</p>
                <div className="mt-3 flex gap-2">
                  <Button size="sm" onClick={() => run((d) => applySuggestion(d, s), "Storyline applied")}>
                    Do it
                  </Button>
                  <Button size="sm" variant="ghost" onClick={() => setDismissed((x) => [...x, s.id])}>
                    Not now
                  </Button>
                </div>
              </div>
            ))}
          </div>
        </Panel>
      )}
      <Tabs
        value={tab}
        onChange={setTab}
        options={[
          { value: "active", label: `Active (${Object.values(u.rivalries).filter((r) => r.status === "active").length})` },
          { value: "paused", label: "Paused" },
          { value: "resolved", label: "Resolved" },
        ]}
      />
      <div className="grid gap-4 lg:grid-cols-2">
        {list.map((r) => (
          <RivalryCard key={r.id} u={u} r={r} />
        ))}
      </div>
      {list.length === 0 && <p className="text-muted">Nothing here.</p>}
      <Modal open={creating} onClose={() => setCreating(false)} title="Start a rivalry">
        <CreateRivalry u={u} onDone={() => setCreating(false)} />
      </Modal>
    </div>
  );
}
