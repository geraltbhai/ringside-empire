"use client";

import { ArrowLeft, RotateCcw, RotateCw, Save, Undo2 } from "lucide-react";
import dynamic from "next/dynamic";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { Portrait } from "@/components/Portrait";
import { Badge, Button, EmptyState, Field, PageHeader, Panel, Tabs } from "@/components/ui/primitives";
import { useAction } from "@/components/WeekControls";
import type { CameraPreset } from "@/components/match3d/CharacterStage";
import type { Appearance, Wrestler } from "@/engine/types";
import { restoreLook, updateWrestler } from "@/engine/universe";
import { cn, heightLabel } from "@/lib/cn";
import { useUniverse } from "@/store/game";

const CharacterStage = dynamic(() => import("@/components/match3d/CharacterStage"), {
  ssr: false,
  loading: () => <div className="grid h-full place-items-center text-sm text-muted">Loading 3D studio…</div>,
});

const POSES: { id: string; label: string }[] = [
  { id: "idle", label: "Stance" },
  { id: "flex", label: "Double biceps" },
  { id: "lat-spread", label: "Lat spread" },
  { id: "most-muscular", label: "Most muscular" },
  { id: "victory", label: "Victory" },
  { id: "walk", label: "Walk" },
  { id: "finisher", label: "Finisher" },
];

type BodyPreset = { label: string; text: string; body: Partial<Appearance> };
const PRESETS: BodyPreset[] = [
  { label: "Bodybuilder", text: "Huge, shredded, wide shoulders", body: { muscle: 1, definition: 0.9, bodyFat: 0.05, shoulderWidth: 0.85, armSize: 0.85, legSize: 0.7, bulk: 0.55 } },
  { label: "Powerhouse", text: "Thick and strong, some padding", body: { muscle: 0.9, definition: 0.55, bodyFat: 0.22, shoulderWidth: 0.7, armSize: 0.75, legSize: 0.7, bulk: 0.7 } },
  { label: "Athlete", text: "Balanced, defined, mobile", body: { muscle: 0.7, definition: 0.72, bodyFat: 0.1, shoulderWidth: 0.55, armSize: 0.55, legSize: 0.6, bulk: 0.35 } },
  { label: "High-flyer", text: "Lean, light and cut", body: { muscle: 0.48, definition: 0.85, bodyFat: 0.04, shoulderWidth: 0.42, armSize: 0.45, legSize: 0.55, bulk: 0.12 } },
  { label: "Super-heavyweight", text: "Massive frame, soft edges", body: { muscle: 0.7, definition: 0.2, bodyFat: 0.75, shoulderWidth: 0.75, armSize: 0.7, legSize: 0.75, bulk: 1 } },
  { label: "Veteran brawler", text: "Strong, thick in the middle", body: { muscle: 0.72, definition: 0.3, bodyFat: 0.45, shoulderWidth: 0.6, armSize: 0.65, legSize: 0.6, bulk: 0.6 } },
];

const SKIN_TONES = ["#f5d0b5", "#e8b48f", "#d7a07a", "#c98e62", "#a86b45", "#8d5a3a", "#7d4a2d", "#5a341f"];
const HAIR_COLORS = ["#1c1917", "#3f2a1d", "#6b4423", "#a16207", "#fbbf24", "#d6d3d1", "#7f1d1d", "#4c1d95"];

function Slider({ label, value, onChange, left, right, min = 0, max = 100, display }: { label: string; value: number; onChange: (v: number) => void; left?: string; right?: string; min?: number; max?: number; display?: string }) {
  const id = `sl-${label.replace(/\W/g, "")}`;
  return (
    <div>
      <div className="flex items-baseline justify-between">
        <label htmlFor={id} className="text-sm">
          {label}
        </label>
        <span className="font-cond text-sm font-semibold tabular-nums text-muted">{display ?? Math.round(value)}</span>
      </div>
      <input id={id} type="range" min={min} max={max} value={value} onChange={(e) => onChange(Number(e.target.value))} className="w-full" />
      {(left || right) && (
        <div className="flex justify-between text-[11px] text-muted">
          <span>{left}</span>
          <span>{right}</span>
        </div>
      )}
    </div>
  );
}

function Swatches({ colors, value, onChange, label }: { colors: string[]; value: string; onChange: (c: string) => void; label: string }) {
  return (
    <div>
      <div className="mb-1 text-sm">{label}</div>
      <div className="flex flex-wrap items-center gap-1.5">
        {colors.map((c) => (
          <button key={c} onClick={() => onChange(c)} aria-label={`${label} ${c}`} aria-pressed={value.toLowerCase() === c} className={cn("h-7 w-7 rounded-full ring-2 ring-offset-2 ring-offset-canvas", value.toLowerCase() === c ? "ring-gold" : "ring-transparent")} style={{ background: c }} />
        ))}
        <input type="color" value={value} onChange={(e) => onChange(e.target.value)} aria-label={`Custom ${label}`} className="h-7 w-9 cursor-pointer rounded border border-rope bg-arena" />
      </div>
    </div>
  );
}

function Choice<T extends string>({ value, options, onChange, label }: { value: T; options: { v: T; l: string }[]; onChange: (v: T) => void; label: string }) {
  return (
    <div>
      <div className="mb-1 text-sm">{label}</div>
      <div className="flex flex-wrap gap-1.5">
        {options.map((o) => (
          <button key={o.v} onClick={() => onChange(o.v)} aria-pressed={value === o.v} className={cn("rounded-md px-2.5 py-1 text-sm font-semibold ring-1", value === o.v ? "bg-ink text-arena ring-ink" : "text-muted ring-rope hover:text-ink")}>
            {o.l}
          </button>
        ))}
      </div>
    </div>
  );
}

export default function LookEditorPage() {
  const { id } = useParams<{ id: string }>();
  const u = useUniverse();
  const run = useAction();
  const router = useRouter();
  const original = u.wrestlers[id];
  const [look, setLook] = useState<Appearance | null>(original ? structuredClone(original.appearance) : null);
  const [heightIn, setHeightIn] = useState(original?.heightIn ?? 72);
  const [weightLbs, setWeightLbs] = useState(original?.weightLbs ?? 220);
  const [tab, setTab] = useState<"body" | "face" | "gear" | "presets">("body");
  const [anim, setAnim] = useState("flex");
  const [turntable, setTurntable] = useState(false);
  const [preset, setPreset] = useState<CameraPreset>("full");

  const dirty = useMemo(() => original && (JSON.stringify(look) !== JSON.stringify(original.appearance) || heightIn !== original.heightIn || weightLbs !== original.weightLbs), [look, heightIn, weightLbs, original]);
  useEffect(() => {
    const warn = (e: BeforeUnloadEvent) => {
      if (dirty) e.preventDefault();
    };
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [dirty]);

  if (!original || !look) return <EmptyState title="Wrestler not found" action={<Link href="/roster">Back to roster</Link>} />;
  const preview: Wrestler = { ...original, appearance: look, heightIn, weightLbs };
  const set = <K extends keyof Appearance>(k: K, v: Appearance[K]) => setLook((x) => (x ? { ...x, [k]: v } : x));
  const pct = (k: keyof Appearance) => Math.round((look[k] as number) * 100);
  const setPct = (k: keyof Appearance) => (v: number) => set(k, (v / 100) as never);
  const accent = original.brand === "fury" ? "#2f6bff" : original.brand === "mayhem" ? "#e11d48" : "#d9a520";
  const hasOriginal = !!u.defaults[id]?.appearance;

  const save = () => {
    const ok = run((d) => {
      const lb = weightLbs;
      updateWrestler(d, id, {
        appearance: look,
        heightIn,
        weightLbs: lb,
        weightClass: lb < 205 ? "cruiserweight" : lb < 235 ? "light-heavyweight" : lb < 300 ? "heavyweight" : "super-heavyweight",
      });
      return true;
    }, `${original.ringName}'s look saved`);
    if (ok) router.push(`/roster/${id}`);
  };

  return (
    <div>
      <Link href={`/roster/${id}`} className="mb-3 inline-flex items-center gap-2 text-sm text-muted hover:text-ink">
        <ArrowLeft size={16} /> {original.ringName}
      </Link>
      <PageHeader
        title="Character studio"
        subtitle={`Sculpt ${original.ringName}'s body, face and ring gear. Changes show live on the 3D model and portrait, and are used in every match.`}
        actions={
          <>
            {dirty && <Badge tone="gold">Unsaved changes</Badge>}
            {hasOriginal && (
              <Button
                variant="ghost"
                onClick={() => {
                  if (!window.confirm("Reset to the look this wrestler had when the universe began?")) return;
                  run((d) => restoreLook(d, id), "Original look restored");
                  setLook(structuredClone(u.defaults[id]!.appearance!));
                }}
              >
                <RotateCcw size={15} /> Original look
              </Button>
            )}
            <Button variant="ghost" disabled={!dirty} onClick={() => { setLook(structuredClone(original.appearance)); setHeightIn(original.heightIn); setWeightLbs(original.weightLbs); }}>
              <Undo2 size={15} /> Discard
            </Button>
            <Button variant="gold" disabled={!dirty} onClick={save}>
              <Save size={15} /> Save look
            </Button>
          </>
        }
      />

      <div className="grid gap-6 lg:grid-cols-[1.35fr_1fr]">
        <div className="space-y-3 lg:sticky lg:top-20 lg:self-start">
          <div className="relative h-[52vh] min-h-[360px] overflow-hidden rounded-xl border border-rope lg:h-[68vh]">
            <CharacterStage wrestler={preview} anim={anim} turntable={turntable} preset={preset} accent={accent} />
            <div className="pointer-events-none absolute left-3 top-3 flex items-start gap-3">
              <Portrait w={preview} className="w-16 shadow-lg" />
              <div className="font-display text-2xl drop-shadow">{original.ringName}</div>
            </div>
            <div className="absolute right-3 top-3 flex gap-1">
              {(["full", "upper", "face"] as const).map((p) => (
                <button key={p} onClick={() => setPreset(p)} aria-pressed={preset === p} className={cn("rounded-md px-2 py-1 text-xs font-semibold backdrop-blur", preset === p ? "bg-ink text-arena" : "bg-black/40 text-ink hover:bg-black/60")}>
                  {p === "full" ? "Full body" : p === "upper" ? "Upper body" : "Face"}
                </button>
              ))}
              <button onClick={() => setTurntable((v) => !v)} aria-pressed={turntable} title="Turntable" className={cn("rounded-md px-2 py-1 backdrop-blur", turntable ? "bg-ink text-arena" : "bg-black/40 text-ink hover:bg-black/60")}>
                <RotateCw size={14} />
              </button>
            </div>
            <p className="pointer-events-none absolute bottom-2 right-3 text-[11px] text-muted">Drag to orbit · scroll to zoom</p>
          </div>
          <div className="flex flex-wrap gap-1.5">
            {POSES.map((p) => (
              <button key={p.id} onClick={() => setAnim(p.id)} aria-pressed={anim === p.id} className={cn("rounded-full px-3 py-1 text-sm font-semibold ring-1", anim === p.id ? "bg-gold/20 text-gold-light ring-gold/60" : "text-muted ring-rope hover:text-ink")}>
                {p.label}
              </button>
            ))}
          </div>
        </div>

        <div className="space-y-4">
          <Tabs
            value={tab}
            onChange={setTab}
            options={[
              { value: "body", label: "Body" },
              { value: "face", label: "Face & hair" },
              { value: "gear", label: "Ring gear" },
              { value: "presets", label: "Presets" },
            ]}
          />

          {tab === "body" && (
            <Panel>
              <div className="space-y-4">
                <Slider label="Muscle mass" value={pct("muscle")} onChange={setPct("muscle")} left="Wiry" right="Massive" />
                <Slider label="Definition" value={pct("definition")} onChange={setPct("definition")} left="Smooth" right="Shredded" />
                <Slider label="Body fat" value={pct("bodyFat")} onChange={setPct("bodyFat")} left="Lean" right="Heavy" />
                <Slider label="Frame" value={pct("bulk")} onChange={setPct("bulk")} left="Slight" right="Huge bones" />
                <div className="grid gap-4 sm:grid-cols-3">
                  <Slider label="Shoulders" value={pct("shoulderWidth")} onChange={setPct("shoulderWidth")} left="Narrow" right="Wide" />
                  <Slider label="Arms" value={pct("armSize")} onChange={setPct("armSize")} left="Small" right="Big" />
                  <Slider label="Legs" value={pct("legSize")} onChange={setPct("legSize")} left="Small" right="Big" />
                </div>
                <div className="grid gap-4 border-t border-rope pt-4 sm:grid-cols-2">
                  <Slider label="Height" value={heightIn} min={60} max={88} onChange={setHeightIn} display={heightLabel(heightIn)} />
                  <Slider label="Billed weight" value={weightLbs} min={95} max={450} onChange={setWeightLbs} display={`${weightLbs} lb`} />
                </div>
                <p className="text-xs text-muted">Body shape is cosmetic. In-ring strength, speed and so on are set on the ratings editor.</p>
              </div>
            </Panel>
          )}

          {tab === "face" && (
            <Panel>
              <div className="space-y-4">
                <Swatches label="Skin tone" colors={SKIN_TONES} value={look.skinTone} onChange={(c) => set("skinTone", c)} />
                <Choice
                  label="Hair"
                  value={look.hairStyle}
                  onChange={(v) => set("hairStyle", v)}
                  options={[
                    { v: "bald", l: "Bald" },
                    { v: "buzz", l: "Buzz" },
                    { v: "short", l: "Short" },
                    { v: "mohawk", l: "Mohawk" },
                    { v: "ponytail", l: "Ponytail" },
                    { v: "long", l: "Long" },
                  ]}
                />
                <Swatches label="Hair colour" colors={HAIR_COLORS} value={look.hairColor} onChange={(c) => set("hairColor", c)} />
                <Choice
                  label="Facial hair"
                  value={look.facialHair}
                  onChange={(v) => set("facialHair", v)}
                  options={[
                    { v: "none", l: "Clean" },
                    { v: "stubble", l: "Stubble" },
                    { v: "goatee", l: "Goatee" },
                    { v: "beard", l: "Beard" },
                  ]}
                />
                <label className="flex items-center gap-2 text-sm">
                  <input type="checkbox" checked={look.mask} onChange={(e) => set("mask", e.target.checked)} /> Wears a mask (uses gear and trim colours)
                </label>
              </div>
            </Panel>
          )}

          {tab === "gear" && (
            <Panel>
              <div className="space-y-4">
                <Choice
                  label="Ring gear"
                  value={look.outfit}
                  onChange={(v) => set("outfit", v)}
                  options={[
                    { v: "trunks", l: "Trunks" },
                    { v: "tights", l: "Long tights" },
                    { v: "singlet", l: "Singlet" },
                    { v: "pants", l: "Fight pants" },
                    { v: "bodysuit", l: "Bodysuit" },
                  ]}
                />
                <div className="grid gap-4 sm:grid-cols-3">
                  <Field label="Gear colour">
                    <input type="color" value={look.primaryColor} onChange={(e) => set("primaryColor", e.target.value)} className="h-10 w-full cursor-pointer rounded-md border border-rope bg-arena" />
                  </Field>
                  <Field label="Trim & pads">
                    <input type="color" value={look.secondaryColor} onChange={(e) => set("secondaryColor", e.target.value)} className="h-10 w-full cursor-pointer rounded-md border border-rope bg-arena" />
                  </Field>
                  <Field label="Boots">
                    <input type="color" value={look.bootColor} onChange={(e) => set("bootColor", e.target.value)} className="h-10 w-full cursor-pointer rounded-md border border-rope bg-arena" />
                  </Field>
                </div>
                <div className="flex flex-wrap gap-4 text-sm">
                  <label className="flex items-center gap-2">
                    <input type="checkbox" checked={look.kneepads} onChange={(e) => set("kneepads", e.target.checked)} /> Kneepads
                  </label>
                  <label className="flex items-center gap-2">
                    <input type="checkbox" checked={look.wristTape} onChange={(e) => set("wristTape", e.target.checked)} /> Taped wrists
                  </label>
                </div>
              </div>
            </Panel>
          )}

          {tab === "presets" && (
            <div className="grid gap-2 sm:grid-cols-2">
              {PRESETS.map((p) => (
                <button
                  key={p.label}
                  onClick={() => {
                    const body = { ...p.body };
                    if (original.division === "women" && body.muscle != null) body.muscle = Math.round(body.muscle * 0.7 * 100) / 100;
                    setLook((x) => (x ? { ...x, ...body } : x));
                    setTab("body");
                  }}
                  className="rounded-lg border border-rope bg-canvas p-3 text-left hover:border-gold/60"
                >
                  <div className="font-semibold">{p.label}</div>
                  <div className="text-sm text-muted">{p.text}</div>
                </button>
              ))}
              <p className="text-xs text-muted sm:col-span-2">Presets change body shape only, then you can fine-tune it on the Body tab.</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
