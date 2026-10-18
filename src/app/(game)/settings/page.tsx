"use client";

import { Cloud, Download, FolderOpen, Keyboard, RotateCcw, Save, Trash2, Upload } from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { Button, Field, inputClass, PageHeader, Panel } from "@/components/ui/primitives";
import { useAction } from "@/components/WeekControls";
import { ASSET_CREDITS } from "@/data/assets";
import { DEFAULT_SETTINGS } from "@/data/seed";
import { DEFAULT_STYLE_WEIGHTS, styleWeights } from "@/engine/rating";
import { ATTRIBUTE_LABELS, type ControlAction, IN_RING_KEYS, STYLES, type WrestlingStyle } from "@/engine/types";
import { type CloudSave, cloudConfigured, currentUser, deleteCloudSave, downloadSave, listCloudSaves, signInWithEmail, signOut, uploadSave } from "@/lib/cloud";
import { cn, money } from "@/lib/cn";
import { keyLabel } from "@/lib/keys";
import { useGame, useUniverse } from "@/store/game";

const ACTION_LABELS: Record<ControlAction, string> = {
  up: "Move up",
  down: "Move down",
  left: "Move left",
  right: "Move right",
  light: "Light strike",
  heavy: "Heavy strike",
  grapple: "Grapple",
  dodge: "Dodge",
  run: "Run (hold)",
  reverse: "Reverse",
  signature: "Signature",
  finisher: "Finisher",
  pin: "Pin / kick out",
  pause: "Pause",
};


function Controls() {
  const u = useUniverse();
  const run = useAction();
  const [listening, setListening] = useState<ControlAction | null>(null);
  useEffect(() => {
    if (!listening) return;
    const onKey = (e: KeyboardEvent) => {
      e.preventDefault();
      const key = e.key.toLowerCase();
      if (key === "escape" && listening !== "pause") return setListening(null);
      run((d) => {
        // Swap with whichever action already used this key, so no key is bound twice.
        const clash = (Object.keys(d.settings.controls) as ControlAction[]).find((a) => d.settings.controls[a] === key && a !== listening);
        if (clash) d.settings.controls[clash] = d.settings.controls[listening];
        d.settings.controls[listening] = key;
      });
      setListening(null);
    };
    window.addEventListener("keydown", onKey, { once: true });
    return () => window.removeEventListener("keydown", onKey);
  }, [listening, run]);

  return (
    <Panel title={<span className="flex items-center gap-2"><Keyboard size={17} /> Match controls</span>} action={<Button size="sm" variant="ghost" onClick={() => run((d) => void (d.settings.controls = { ...DEFAULT_SETTINGS.controls }), "Controls reset")}>Reset</Button>}>
      <div className="grid gap-x-6 gap-y-1 sm:grid-cols-2">
        {(Object.keys(ACTION_LABELS) as ControlAction[]).map((a) => (
          <div key={a} className="flex items-center justify-between gap-3 border-b border-rope/60 py-1.5">
            <span className="text-sm">{ACTION_LABELS[a]}</span>
            <button
              onClick={() => setListening(a)}
              className={cn("min-w-16 rounded-md px-2 py-1 font-cond text-sm font-semibold ring-1", listening === a ? "animate-pulse bg-gold/20 text-gold-light ring-gold" : "bg-arena ring-rope hover:ring-muted")}
              aria-label={`Rebind ${ACTION_LABELS[a]}, currently ${keyLabel(u.settings.controls[a])}`}
            >
              {listening === a ? "Press a key…" : keyLabel(u.settings.controls[a])}
            </button>
          </div>
        ))}
      </div>
      <p className="mt-3 text-xs text-muted">Arrow keys always move as well. Binding a key that is already in use swaps the two actions.</p>
    </Panel>
  );
}

function RatingWeights() {
  const u = useUniverse();
  const run = useAction();
  const [style, setStyle] = useState<WrestlingStyle>("technician");
  const weights = styleWeights(style, u.settings);
  const overridden = Object.keys(u.settings.ratingWeightOverrides[style] ?? {}).length > 0;
  return (
    <Panel
      title="Overall rating formula"
      action={
        <Button size="sm" variant="ghost" disabled={!overridden} onClick={() => run((d) => void delete d.settings.ratingWeightOverrides[style], "Weights reset")}>
          Reset {style}
        </Button>
      }
    >
      <p className="mb-3 text-sm text-muted">Overall = 78% style-weighted in-ring + 12% entertainment + 10% big-match. Tune how much each in-ring attribute counts for a style; every overall in the universe recalculates.</p>
      <select className="mb-4 h-10 rounded-md border border-rope bg-arena px-2 text-sm" value={style} onChange={(e) => setStyle(e.target.value as WrestlingStyle)} aria-label="Style">
        {STYLES.map((s) => (
          <option key={s} value={s}>
            {s}
          </option>
        ))}
      </select>
      <div className="grid gap-x-6 gap-y-3 sm:grid-cols-3">
        {IN_RING_KEYS.map((k) => {
          const def = DEFAULT_STYLE_WEIGHTS[style][k] ?? 1;
          return (
            <label key={k} className="block">
              <div className="flex justify-between text-sm">
                <span>{ATTRIBUTE_LABELS[k]}</span>
                <span className={cn("tabular-nums", weights[k] !== def ? "text-gold-light" : "text-muted")}>×{weights[k].toFixed(1)}</span>
              </div>
              <input
                type="range"
                min={0}
                max={40}
                value={Math.round(weights[k] * 10)}
                className="w-full"
                onChange={(e) =>
                  run((d) => {
                    const o = (d.settings.ratingWeightOverrides[style] ??= {});
                    o[k] = Number(e.target.value) / 10;
                  })
                }
              />
            </label>
          );
        })}
      </div>
    </Panel>
  );
}

function SaveSlots() {
  const { slots, slot, saveNow, saveAs, load, deleteSlot, exportSave, importSave, resetUniverse, toast } = useGame();
  const u = useUniverse();
  const router = useRouter();
  const fileRef = useRef<HTMLInputElement>(null);
  const [confirmName, setConfirmName] = useState("");
  const download = () => {
    const json = exportSave();
    if (!json) return;
    const a = document.createElement("a");
    a.href = URL.createObjectURL(new Blob([json], { type: "application/json" }));
    a.download = `${u.promotionName.replace(/\W+/g, "-").toLowerCase()}-week-${u.week + 1}.json`;
    a.click();
    URL.revokeObjectURL(a.href);
  };
  return (
    <Panel title="Saves">
      <p className="mb-3 text-sm text-muted">The game autosaves to this browser after every change. Use extra slots to branch a universe, and export a file as a backup.</p>
      <div className="flex flex-wrap gap-2">
        <Button onClick={saveNow}>
          <Save size={15} /> Save now
        </Button>
        <Button onClick={saveAs}>
          <FolderOpen size={15} /> Save to a new slot
        </Button>
        <Button onClick={download}>
          <Download size={15} /> Export save file
        </Button>
        <Button onClick={() => fileRef.current?.click()}>
          <Upload size={15} /> Import save file
        </Button>
        <input
          ref={fileRef}
          type="file"
          accept="application/json,.json"
          className="hidden"
          onChange={async (e) => {
            const f = e.target.files?.[0];
            if (!f) return;
            try {
              await importSave(await f.text());
              toast("Save imported into a new slot", "good");
              router.push("/dashboard");
            } catch (err) {
              toast(err instanceof Error ? err.message : "Import failed", "bad");
            }
            e.target.value = "";
          }}
        />
      </div>
      <ul className="mt-4 divide-y divide-rope rounded-md border border-rope">
        {slots.map((s) => (
          <li key={s.slot} className="flex flex-wrap items-center gap-3 px-3 py-2 text-sm">
            <div className="min-w-0 flex-1">
              <div className="font-semibold">
                {s.promotionName} {s.slot === slot && <span className="ml-1 text-xs text-gold-light">· playing</span>}
              </div>
              <div className="text-xs text-muted">
                {s.universeName} · week {s.week + 1} · {money(s.cash)} · saved {new Date(s.updatedAt).toLocaleString()}
              </div>
            </div>
            {s.slot !== slot && (
              <Button size="sm" onClick={() => load(s.slot).then(() => toast("Save loaded", "good"))}>
                Load
              </Button>
            )}
            <Button size="sm" variant="ghost" aria-label="Delete save" onClick={() => window.confirm(`Delete "${s.promotionName}" week ${s.week + 1}? This cannot be undone.`) && deleteSlot(s.slot).then(() => s.slot === slot && router.push("/"))}>
              <Trash2 size={14} />
            </Button>
          </li>
        ))}
      </ul>
      <div className="mt-6 rounded-md border border-bad/40 bg-bad/5 p-3">
        <div className="font-semibold text-bad">Reset universe</div>
        <p className="mt-1 text-sm text-muted">Restarts this save at week 1 with the original roster, titles and cash. Export first if you might want it back.</p>
        <div className="mt-2 flex flex-wrap gap-2">
          <input className={cn(inputClass, "max-w-xs")} placeholder={`Type “${u.promotionName}” to confirm`} value={confirmName} onChange={(e) => setConfirmName(e.target.value)} aria-label="Confirm promotion name" />
          <Button
            variant="danger"
            disabled={confirmName.trim() !== u.promotionName}
            onClick={async () => {
              await resetUniverse();
              setConfirmName("");
              router.push("/dashboard");
            }}
          >
            <RotateCcw size={15} /> Reset universe
          </Button>
        </div>
      </div>
    </Panel>
  );
}

function CloudSaves() {
  const { slot, toast, importSave } = useGame();
  const u = useUniverse();
  const [email, setEmail] = useState("");
  const [user, setUser] = useState<string | null>(null);
  const [saves, setSaves] = useState<CloudSave[]>([]);
  const [busy, setBusy] = useState(false);
  const refresh = async () => {
    const usr = await currentUser();
    setUser(usr?.email ?? null);
    if (usr) setSaves(await listCloudSaves());
  };
  useEffect(() => {
    if (cloudConfigured) refresh().catch(() => undefined);
  }, []);
  const act = async (fn: () => Promise<unknown>, ok: string) => {
    setBusy(true);
    try {
      await fn();
      toast(ok, "good");
      await refresh();
    } catch (e) {
      toast(e instanceof Error ? e.message : "Cloud request failed", "bad");
    } finally {
      setBusy(false);
    }
  };
  return (
    <Panel title={<span className="flex items-center gap-2"><Cloud size={17} /> Cloud saves</span>}>
      {!cloudConfigured ? (
        <p className="text-sm text-muted">
          Not configured. The game is fully playable offline. To sync saves across devices, set <code className="text-ink">NEXT_PUBLIC_SUPABASE_URL</code> and <code className="text-ink">NEXT_PUBLIC_SUPABASE_ANON_KEY</code> and run the migration in <code className="text-ink">supabase/migrations</code> (see README).
        </p>
      ) : !user ? (
        <div className="flex flex-wrap gap-2">
          <input className={cn(inputClass, "max-w-xs")} type="email" placeholder="you@example.com" value={email} onChange={(e) => setEmail(e.target.value)} aria-label="Email for sign-in link" />
          <Button disabled={!email || busy} onClick={() => act(() => signInWithEmail(email), "Check your email for a sign-in link")}>
            Email me a sign-in link
          </Button>
        </div>
      ) : (
        <div className="space-y-3 text-sm">
          <div className="flex flex-wrap items-center gap-2">
            Signed in as <span className="font-semibold">{user}</span>
            <Button size="sm" variant="ghost" onClick={() => act(signOut, "Signed out")}>
              Sign out
            </Button>
          </div>
          <Button disabled={busy || !slot} onClick={() => act(() => uploadSave(slot!, u), "Uploaded to the cloud")}>
            <Upload size={15} /> Upload this save
          </Button>
          <ul className="divide-y divide-rope rounded-md border border-rope">
            {saves.map((s) => (
              <li key={s.slot} className="flex items-center gap-2 px-3 py-2">
                <span className="flex-1">
                  {s.name} · week {s.week + 1} <span className="text-xs text-muted">· {new Date(s.updated_at).toLocaleString()}</span>
                </span>
                <Button size="sm" disabled={busy} onClick={() => act(async () => importSave(JSON.stringify((await downloadSave(s.slot)))), "Downloaded into a new local slot")}>
                  Download
                </Button>
                <Button size="sm" variant="ghost" disabled={busy} onClick={() => window.confirm("Delete this cloud save?") && act(() => deleteCloudSave(s.slot), "Cloud save deleted")}>
                  <Trash2 size={14} />
                </Button>
              </li>
            ))}
            {saves.length === 0 && <li className="px-3 py-2 text-muted">No cloud saves yet.</li>}
          </ul>
        </div>
      )}
    </Panel>
  );
}

export default function SettingsPage() {
  const u = useUniverse();
  const run = useAction();
  const s = u.settings;
  return (
    <div className="space-y-6">
      <PageHeader title="Settings" subtitle="Gameplay, booking rules, controls, the rating formula and your saves." />
      <div className="grid gap-6 lg:grid-cols-2">
        <Panel title="Gameplay">
          <div className="space-y-4">
            <Field label="AI difficulty (playable matches)">
              <select className="h-10 w-full rounded-md border border-rope bg-arena px-2 text-sm" value={s.difficulty} onChange={(e) => run((d) => void (d.settings.difficulty = e.target.value as typeof s.difficulty), "Difficulty updated")}>
                <option value="easy">Easy — slower reactions, fewer reversals</option>
                <option value="normal">Normal</option>
                <option value="hard">Hard — fast reactions, frequent reversals</option>
              </select>
            </Field>
            <Field label={`Playable match time limit: ${s.matchMinutes} minutes (real time)`}>
              <input type="range" min={3} max={20} value={s.matchMinutes} className="w-full" onChange={(e) => run((d) => void (d.settings.matchMinutes = Number(e.target.value)))} />
            </Field>
            <label className="flex items-center gap-2 text-sm">
              <input type="checkbox" checked={s.soundEnabled} onChange={(e) => run((d) => void (d.settings.soundEnabled = e.target.checked))} /> Sound effects
            </label>
            <label className="flex items-center gap-2 text-sm">
              <input type="checkbox" checked={s.reducedMotion} onChange={(e) => run((d) => void (d.settings.reducedMotion = e.target.checked))} /> Reduce camera shake and motion
            </label>
          </div>
        </Panel>
        <Panel title="Booking rules">
          <div className="space-y-4">
            <label className="flex items-center gap-2 text-sm">
              <input type="checkbox" checked={s.allowCrossBrand} onChange={(e) => run((d) => void (d.settings.allowCrossBrand = e.target.checked))} /> Allow cross-brand appearances on weekly shows
            </label>
            <label className="flex items-center gap-2 text-sm">
              <input type="checkbox" checked={s.autoRenewContracts} onChange={(e) => run((d) => void (d.settings.autoRenewContracts = e.target.checked))} /> Auto-renew happy wrestlers when contracts expire
            </label>
            <Field label={`Overwork warning after ${s.maxMatchesPerMonth} matches in 4 weeks`}>
              <input type="range" min={2} max={12} value={s.maxMatchesPerMonth} className="w-full" onChange={(e) => run((d) => void (d.settings.maxMatchesPerMonth = Number(e.target.value)))} />
            </Field>
          </div>
        </Panel>
      </div>
      <Controls />
      <RatingWeights />
      <div className="grid gap-6 lg:grid-cols-2">
        <SaveSlots />
        <CloudSaves />
      </div>
      <Panel title="Credits & licensing">
        <p className="mb-3 text-sm text-muted">Ringside Empire is an independent fan project. Every promotion, brand, wrestler, move name and theme is fictional; ratings are subjective gameplay estimates. No real person&apos;s likeness or any company&apos;s artwork is included.</p>
        <table className="w-full text-sm">
          <tbody className="divide-y divide-rope">
            {ASSET_CREDITS.map((c) => (
              <tr key={c.asset}>
                <td className="py-1.5 pr-3 font-semibold">{c.asset}</td>
                <td className="py-1.5 pr-3 text-muted">{c.source}</td>
                <td className="py-1.5 text-muted">{c.license}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </Panel>
    </div>
  );
}
