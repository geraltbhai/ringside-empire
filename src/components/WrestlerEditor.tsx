"use client";

import { ImagePlus, RotateCcw, Save, Trash2 } from "lucide-react";
import { useRef, useState } from "react";
import { ATTRIBUTE_GROUPS } from "@/components/attributes";
import { OverallBadge } from "@/components/game";
import { Portrait } from "@/components/Portrait";
import { Button, Field, inputClass, Panel } from "@/components/ui/primitives";
import { ratingCard, ratingTier } from "@/engine/rating";
import { ATTRIBUTE_LABELS, type AttributeKey, STYLES, type Universe, type Wrestler } from "@/engine/types";
import { clearCustomPortrait, setCustomPortrait } from "@/lib/portraits";
import { cn } from "@/lib/cn";
import { useGame } from "@/store/game";

const selectClass = "h-10 w-full rounded-md border border-rope bg-arena px-2 text-sm";

function Slider({ label, value, onChange, min = 1, max = 100 }: { label: string; value: number; onChange: (v: number) => void; min?: number; max?: number }) {
  return (
    <div className="grid grid-cols-[1fr_56px] items-center gap-x-3">
      <label className="text-sm text-muted" htmlFor={`s-${label}`}>
        {label}
      </label>
      <input
        type="number"
        min={min}
        max={max}
        value={Math.round(value)}
        onChange={(e) => onChange(Math.max(min, Math.min(max, Number(e.target.value) || min)))}
        className="h-7 rounded border border-rope bg-arena px-1.5 text-right text-sm tabular-nums"
        aria-label={`${label} value`}
      />
      <input id={`s-${label}`} type="range" min={min} max={max} value={Math.round(value)} onChange={(e) => onChange(Number(e.target.value))} className="col-span-2 w-full" />
    </div>
  );
}

export interface EditorResult {
  draft: Wrestler;
  brand: Wrestler["brand"];
  team: { mode: "keep" } | { mode: "leave" } | { mode: "form"; partnerId: string; name: string };
}

export function WrestlerEditor({
  universe,
  initial,
  isNew,
  onSave,
  onRestore,
}: {
  universe: Universe;
  initial: Wrestler;
  isNew?: boolean;
  onSave: (r: EditorResult) => void;
  onRestore?: () => void;
}) {
  const [w, setW] = useState<Wrestler>(() => structuredClone(initial));
  const [brand, setBrand] = useState(initial.brand);
  const [teamMode, setTeamMode] = useState<"keep" | "leave" | "form">("keep");
  const [partnerId, setPartnerId] = useState("");
  const [teamName, setTeamName] = useState("");
  const [sigText, setSigText] = useState(initial.signatures.join(", "));
  const fileRef = useRef<HTMLInputElement>(null);
  const toast = useGame((s) => s.toast);

  const set = <K extends keyof Wrestler>(k: K, v: Wrestler[K]) => setW((x) => ({ ...x, [k]: v }));
  const setAttr = (k: AttributeKey, v: number) => setW((x) => ({ ...x, attributes: { ...x.attributes, [k]: v } }));
  const setLook = <K extends keyof Wrestler["appearance"]>(k: K, v: Wrestler["appearance"][K]) => setW((x) => ({ ...x, appearance: { ...x.appearance, [k]: v } }));
  const card = ratingCard(w, universe.settings);
  const signed = initial.brand === "mayhem" || initial.brand === "fury";
  const team = initial.teamId ? universe.teams[initial.teamId] : null;
  const partners = Object.values(universe.wrestlers).filter((o) => o.id !== w.id && o.division === w.division && o.brand === (signed ? brand : o.brand)).sort((a, b) => a.ringName.localeCompare(b.ringName));

  const submit = () => {
    if (!w.ringName.trim()) return toast("Ring name is required", "bad");
    if (!w.finisher.trim()) return toast("A finisher is required", "bad");
    const signatures = sigText.split(",").map((s) => s.trim()).filter(Boolean).slice(0, 5);
    if (teamMode === "form" && (!partnerId || !teamName.trim())) return toast("Choose a partner and team name", "bad");
    onSave({
      draft: { ...w, ringName: w.ringName.trim(), signatures: signatures.length ? signatures : ["Signature"] },
      brand,
      team: teamMode === "form" ? { mode: "form", partnerId, name: teamName.trim() } : { mode: teamMode },
    });
  };

  return (
    <div className="grid gap-6 lg:grid-cols-[300px_1fr]">
      <div className="space-y-4 lg:sticky lg:top-20 lg:self-start">
        <Panel>
          <Portrait w={{ ...w, brand }} className="w-full" />
          <div className="mt-3 flex gap-2">
            <Button size="sm" onClick={() => fileRef.current?.click()} disabled={isNew} title={isNew ? "Save the wrestler first" : ""}>
              <ImagePlus size={14} /> Upload portrait
            </Button>
            {!isNew && (
              <Button size="sm" variant="ghost" onClick={() => clearCustomPortrait(w.id)}>
                <Trash2 size={14} /> Use illustration
              </Button>
            )}
          </div>
          <p className="mt-2 text-xs text-muted">Only upload images you own or have rights to use. Stored in this browser only.</p>
          <input
            ref={fileRef}
            type="file"
            accept="image/*"
            className="hidden"
            onChange={async (e) => {
              const f = e.target.files?.[0];
              if (!f) return;
              try {
                await setCustomPortrait(w.id, f);
                toast("Portrait updated", "good");
              } catch {
                toast("Could not read that image", "bad");
              }
            }}
          />
          <div className="mt-4 grid grid-cols-3 gap-2 text-center">
            <div>
              <div className="text-xs text-muted">Overall</div>
              <OverallBadge value={card.overall} size="lg" />
            </div>
            <div>
              <div className="text-xs text-muted">In-ring</div>
              <div className="font-cond text-3xl font-semibold">{card.inRing}</div>
            </div>
            <div>
              <div className="text-xs text-muted">Ent.</div>
              <div className="font-cond text-3xl font-semibold">{card.entertainment}</div>
            </div>
          </div>
          <p className="mt-2 text-center text-xs text-muted">
            {ratingTier(card.overall).label}
            {card.isOverridden && ` · formula says ${card.formulaOverall}`}
          </p>
        </Panel>
        <div className="flex flex-col gap-2">
          <Button variant="gold" size="lg" onClick={submit}>
            <Save size={16} /> {isNew ? "Create wrestler" : "Save changes"}
          </Button>
          {onRestore && (
            <Button
              variant="ghost"
              onClick={() => {
                if (window.confirm("Restore the original ratings (attributes, popularity, potential, overall)?")) onRestore();
              }}
            >
              <RotateCcw size={15} /> Restore default ratings
            </Button>
          )}
        </div>
      </div>

      <div className="space-y-6">
        <Panel title="Identity">
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            <Field label="Ring name">
              <input className={inputClass} value={w.ringName} onChange={(e) => set("ringName", e.target.value)} maxLength={40} />
            </Field>
            <Field label="Real name">
              <input className={inputClass} value={w.name} onChange={(e) => set("name", e.target.value)} maxLength={60} />
            </Field>
            <Field label="Nickname">
              <input className={inputClass} value={w.nickname} onChange={(e) => set("nickname", e.target.value)} maxLength={40} />
            </Field>
            <Field label="Version label" hint="e.g. Peak 2004 — leave empty for the main version">
              <input className={inputClass} value={w.versionLabel ?? ""} onChange={(e) => set("versionLabel", e.target.value || null)} maxLength={30} />
            </Field>
            <Field label="Division">
              <select className={selectClass} value={w.division} onChange={(e) => set("division", e.target.value as Wrestler["division"])} disabled={!isNew}>
                <option value="men">Men</option>
                <option value="women">Women</option>
              </select>
            </Field>
            <Field label="Style">
              <select className={selectClass} value={w.style} onChange={(e) => set("style", e.target.value as Wrestler["style"])}>
                {STYLES.map((s) => (
                  <option key={s} value={s}>
                    {s}
                  </option>
                ))}
              </select>
            </Field>
            <Field label="Alignment">
              <select className={selectClass} value={w.alignment} onChange={(e) => set("alignment", e.target.value as Wrestler["alignment"])}>
                <option value="face">Face</option>
                <option value="heel">Heel</option>
                <option value="tweener">Tweener</option>
              </select>
            </Field>
            <Field label="Era">
              <select className={selectClass} value={w.era} onChange={(e) => set("era", e.target.value as Wrestler["era"])}>
                {["golden", "boom", "attitude", "ruthless", "modern"].map((e) => (
                  <option key={e} value={e}>
                    {e}
                  </option>
                ))}
              </select>
            </Field>
            <Field label="Age">
              <input type="number" min={16} max={80} className={inputClass} value={w.age} onChange={(e) => set("age", Number(e.target.value) || 18)} />
            </Field>
            <Field label="Height (inches)">
              <input type="number" min={58} max={90} className={inputClass} value={w.heightIn} onChange={(e) => set("heightIn", Number(e.target.value) || 70)} />
            </Field>
            <Field label="Weight (lb)">
              <input
                type="number"
                min={90}
                max={500}
                className={inputClass}
                value={w.weightLbs}
                onChange={(e) => {
                  const lb = Number(e.target.value) || 200;
                  setW((x) => ({ ...x, weightLbs: lb, weightClass: lb < 205 ? "cruiserweight" : lb < 235 ? "light-heavyweight" : lb < 300 ? "heavyweight" : "super-heavyweight" }));
                }}
              />
            </Field>
            <Field label="Entrance theme">
              <input className={inputClass} value={w.theme} onChange={(e) => set("theme", e.target.value)} maxLength={40} />
            </Field>
          </div>
        </Panel>

        <Panel title="Ratings" action={<span className="text-xs text-muted">Overall recalculates as you edit</span>}>
          <div className="mb-5 grid gap-4 sm:grid-cols-3">
            <div className="space-y-2">
              <label className="flex items-center gap-2 text-sm">
                <input type="checkbox" checked={w.overallOverride != null} onChange={(e) => set("overallOverride", e.target.checked ? card.formulaOverall : null)} />
                Override overall manually
              </label>
              {w.overallOverride != null && <Slider label="Manual overall" value={w.overallOverride} onChange={(v) => set("overallOverride", v)} max={99} />}
            </div>
            <Slider label="Popularity" value={w.popularity} onChange={(v) => set("popularity", v)} />
            <Slider label="Potential" value={w.potential} onChange={(v) => set("potential", v)} />
          </div>
          <div className="grid gap-x-8 gap-y-6 sm:grid-cols-2">
            {ATTRIBUTE_GROUPS.map((g) => (
              <div key={g.label} className="space-y-3">
                <h3 className="font-cond text-sm font-semibold text-gold-light">{g.label}</h3>
                {g.keys.map((k) => (
                  <Slider key={k} label={ATTRIBUTE_LABELS[k]} value={w.attributes[k]} onChange={(v) => setAttr(k, v)} />
                ))}
              </div>
            ))}
          </div>
        </Panel>

        <Panel title="Moveset">
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Finisher">
              <input className={inputClass} value={w.finisher} onChange={(e) => set("finisher", e.target.value)} maxLength={40} />
            </Field>
            <Field label="Signature moves" hint="Comma-separated, up to 5">
              <input className={inputClass} value={sigText} onChange={(e) => setSigText(e.target.value)} />
            </Field>
          </div>
          <p className="mt-2 text-xs text-muted">Finishers with “Lock”, “Clutch”, “Hold” or similar in the name become submission finishers in the playable match.</p>
        </Panel>

        <Panel title="Status & contract">
          <div className="grid gap-4 sm:grid-cols-3">
            <Slider label="Morale" value={w.morale} onChange={(v) => set("morale", v)} min={0} />
            <Slider label="Momentum" value={w.momentum} onChange={(v) => set("momentum", v)} min={0} />
            <Slider label="Fatigue" value={w.fatigue} onChange={(v) => set("fatigue", v)} min={0} />
            {signed && (
              <>
                <Field label="Brand" hint="Changing brand transfers the wrestler (and their tag partner).">
                  <select className={selectClass} value={brand} onChange={(e) => setBrand(e.target.value as Wrestler["brand"])}>
                    <option value="mayhem">{universe.brands.mayhem.showName}</option>
                    <option value="fury">{universe.brands.fury.showName}</option>
                  </select>
                </Field>
                <Field label="Weekly salary ($)" hint="Direct edit; negotiate renewals on Contracts.">
                  <input type="number" min={0} step={100} className={inputClass} value={w.contract.weeklySalary} onChange={(e) => set("contract", { ...w.contract, weeklySalary: Math.max(0, Number(e.target.value) || 0) })} />
                </Field>
              </>
            )}
            {!signed && <p className="text-sm text-muted sm:col-span-2">Not under contract — sign them on the Contracts screen to assign a brand.</p>}
          </div>
        </Panel>

        {!isNew && (
          <Panel title="Tag team">
            <div className="space-y-3 text-sm">
              <p>{team ? <>Currently in <span className="font-semibold">{team.name}</span> (chemistry {team.chemistry}).</> : "Not in a tag team."}</p>
              <div className="flex flex-wrap gap-2">
                <Button size="sm" variant={teamMode === "keep" ? "primary" : "outline"} onClick={() => setTeamMode("keep")}>
                  No change
                </Button>
                {team && (
                  <Button size="sm" variant={teamMode === "leave" ? "danger" : "outline"} onClick={() => setTeamMode("leave")}>
                    Disband team
                  </Button>
                )}
                <Button size="sm" variant={teamMode === "form" ? "primary" : "outline"} onClick={() => setTeamMode("form")}>
                  Form a new team
                </Button>
              </div>
              {teamMode === "form" && (
                <div className="grid gap-3 sm:grid-cols-2">
                  <Field label="Partner">
                    <select className={selectClass} value={partnerId} onChange={(e) => setPartnerId(e.target.value)}>
                      <option value="">Choose…</option>
                      {partners.map((p) => (
                        <option key={p.id} value={p.id}>
                          {p.ringName}
                          {p.teamId ? ` (leaves ${universe.teams[p.teamId]?.name})` : ""}
                        </option>
                      ))}
                    </select>
                  </Field>
                  <Field label="Team name">
                    <input className={inputClass} value={teamName} onChange={(e) => setTeamName(e.target.value)} maxLength={40} />
                  </Field>
                </div>
              )}
            </div>
          </Panel>
        )}

        <Panel title="Appearance" action={<span className="text-xs text-muted">Drives the portrait and 3D model</span>}>
          <div className="grid gap-4 sm:grid-cols-3 lg:grid-cols-4">
            {(
              [
                ["skinTone", "Skin tone"],
                ["hairColor", "Hair colour"],
                ["primaryColor", "Gear colour"],
                ["secondaryColor", "Trim colour"],
              ] as const
            ).map(([k, label]) => (
              <Field key={k} label={label}>
                <input type="color" className="h-10 w-full cursor-pointer rounded-md border border-rope bg-arena" value={w.appearance[k]} onChange={(e) => setLook(k, e.target.value)} />
              </Field>
            ))}
            <Field label="Hair">
              <select className={selectClass} value={w.appearance.hairStyle} onChange={(e) => setLook("hairStyle", e.target.value as Wrestler["appearance"]["hairStyle"])}>
                {["bald", "buzz", "short", "long", "mohawk", "ponytail"].map((h) => (
                  <option key={h}>{h}</option>
                ))}
              </select>
            </Field>
            <Field label="Facial hair">
              <select className={selectClass} value={w.appearance.facialHair} onChange={(e) => setLook("facialHair", e.target.value as Wrestler["appearance"]["facialHair"])}>
                {["none", "stubble", "goatee", "beard"].map((h) => (
                  <option key={h}>{h}</option>
                ))}
              </select>
            </Field>
            <Field label="Ring gear">
              <select className={selectClass} value={w.appearance.outfit} onChange={(e) => setLook("outfit", e.target.value as Wrestler["appearance"]["outfit"])}>
                {["trunks", "tights", "singlet", "pants", "bodysuit"].map((h) => (
                  <option key={h}>{h}</option>
                ))}
              </select>
            </Field>
            <label className={cn("flex items-center gap-2 self-end pb-2 text-sm")}>
              <input type="checkbox" checked={w.appearance.mask} onChange={(e) => setLook("mask", e.target.checked)} /> Masked
            </label>
            <div className="sm:col-span-2">
              <Slider label="Build (lean → heavy)" value={Math.round(w.appearance.bulk * 100)} onChange={(v) => setLook("bulk", v / 100)} min={0} />
            </div>
          </div>
        </Panel>
      </div>
    </div>
  );
}
