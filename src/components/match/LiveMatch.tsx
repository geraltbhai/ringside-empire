"use client";

import { Crown, Pause, Play, RotateCcw } from "lucide-react";
import dynamic from "next/dynamic";
import Link from "next/link";
import type React from "react";
import { memo, useCallback, useEffect, useRef, useState } from "react";
import { OverallBadge } from "@/components/game";
import { SafeCanvas, webglAvailable } from "@/components/match3d/SafeCanvas";
import type { MatchFx } from "@/components/match3d/MatchScene";
import { TopDownView } from "@/components/match3d/TopDownView";
import { Portrait } from "@/components/Portrait";
import { Button, Stars } from "@/components/ui/primitives";
import { useAction } from "@/components/WeekControls";
import { createMatch, kickoutTarget, type MatchInput, type MatchState, playedMatchQuality, stepMatch } from "@/engine/live-match";
import { overall } from "@/engine/rating";
import { qualityToStars } from "@/engine/simulation";
import type { ControlAction, SegmentResult, Universe, Wrestler } from "@/engine/types";
import { recordExhibition } from "@/engine/universe";
import { cn, heightLabel } from "@/lib/cn";
import { keyLabel } from "@/lib/keys";
import * as sfx from "@/lib/sfx";

const MatchScene = dynamic(() => import("@/components/match3d/MatchScene"), { ssr: false });

export type MatchSource = { kind: "exhibition" } | { kind: "booking"; showId: string; segId: string; playerSide: "A" | "B" };

export interface MatchConfig {
  player: Wrestler;
  opponent: Wrestler;
  titleId: string | null;
  source: MatchSource;
}

const ACTION_KEYS: ControlAction[] = ["light", "heavy", "grapple", "dodge", "reverse", "signature", "finisher", "pin"];
const ARROWS: Record<string, ControlAction> = { arrowup: "up", arrowdown: "down", arrowleft: "left", arrowright: "right" };

interface Feed {
  id: number;
  text: string;
  tone?: "gold" | "bad" | "good";
  at: number;
}

interface Outcome {
  winnerId: string | null;
  method: string;
  durationSec: number;
  quality: number;
  recorded: string;
  titleChange: SegmentResult["titleChange"];
}

function Bar({ value, tone, label, flip }: { value: number; tone: string; label: string; flip?: boolean }) {
  return (
    <div className="h-2.5 w-full overflow-hidden rounded-sm bg-black/60 ring-1 ring-white/10" role="meter" aria-label={label} aria-valuenow={Math.round(value)} aria-valuemin={0} aria-valuemax={100}>
      <div className={cn("h-full transition-[width] duration-150", tone, flip && "ml-auto")} style={{ width: `${Math.max(0, Math.min(100, value))}%` }} />
    </div>
  );
}

function FighterHud({ w, f, side, u }: { w: Wrestler; f: MatchState["fighters"][number]; side: "left" | "right"; u: Universe }) {
  const flip = side === "right";
  return (
    <div className={cn("flex w-full max-w-md items-center gap-3", flip && "flex-row-reverse text-right")}>
      <Portrait w={w} className="w-12 shrink-0 ring-2 ring-black/50 sm:w-14" />
      <div className="min-w-0 flex-1 space-y-1">
        <div className={cn("flex items-center gap-2", flip && "flex-row-reverse")}>
          <span className="font-display truncate text-lg leading-none drop-shadow sm:text-2xl">{w.ringName}</span>
          <OverallBadge value={overall(w, u.settings)} size="sm" />
          {f.isPlayer && <span className="rounded bg-gold px-1 text-[10px] font-bold text-black">YOU</span>}
        </div>
        <Bar value={f.health} tone={f.health > 35 ? "bg-gradient-to-r from-rose-600 to-rose-400" : "bg-rose-500 animate-pulse"} label={`${w.ringName} health`} flip={flip} />
        <Bar value={f.stamina} tone="bg-gradient-to-r from-amber-500 to-yellow-300" label={`${w.ringName} stamina`} flip={flip} />
        <div className={cn("flex items-center gap-1.5", flip && "flex-row-reverse")}>
          <div className="h-1.5 flex-1 overflow-hidden rounded-sm bg-black/60">
            <div className={cn("h-full bg-sky-400", flip && "ml-auto")} style={{ width: `${f.momentum}%` }} />
          </div>
          <span className={cn("rounded px-1 text-[10px] font-bold", f.signatures > 0 ? "bg-emerald-400 text-black" : "bg-white/10 text-white/40")}>SIG</span>
          {[0, 1].map((i) => (
            <span key={i} className={cn("rounded px-1 text-[10px] font-bold", f.finishers > i ? "gold-plate animate-pulse" : "bg-white/10 text-white/40")}>
              FIN
            </span>
          ))}
        </div>
      </div>
    </div>
  );
}

export function ControlsGuide({ controls, compact }: { controls: Universe["settings"]["controls"]; compact?: boolean }) {
  const rows: [string, string][] = [
    [`${keyLabel(controls.up)} ${keyLabel(controls.left)} ${keyLabel(controls.down)} ${keyLabel(controls.right)} / arrows`, "Move"],
    [keyLabel(controls.run), "Hold to run (light strike while running = running attack)"],
    [keyLabel(controls.light), "Light strike · stomp a downed opponent"],
    [keyLabel(controls.heavy), "Heavy strike"],
    [keyLabel(controls.grapple), `Grapple — then ${keyLabel(controls.light)} quick move, ${keyLabel(controls.heavy)} power move`],
    [keyLabel(controls.reverse), "Reverse — press as the opponent's attack winds up (the R prompt)"],
    [keyLabel(controls.dodge), "Dodge"],
    [keyLabel(controls.signature), "Signature (when SIG lights up)"],
    [keyLabel(controls.finisher), "Finisher (when FIN lights up)"],
    [keyLabel(controls.pin), "Pin a downed opponent · mash to kick out or escape a hold"],
    [keyLabel(controls.pause), "Pause"],
  ];
  return (
    <dl className={cn("grid gap-x-4 gap-y-1 text-sm", compact ? "grid-cols-[auto_1fr]" : "sm:grid-cols-[auto_1fr]")}>
      {rows.map(([k, v]) => (
        <div key={v} className="contents">
          <dt className="font-cond font-semibold text-gold-light">{k}</dt>
          <dd className="text-muted">{v}</dd>
        </div>
      ))}
    </dl>
  );
}

/** Touch controls for phones and tablets. */
function TouchPad({ press, hold }: { press: (a: ControlAction) => void; hold: (a: ControlAction, down: boolean) => void }) {
  const dir = (a: ControlAction, label: string, cls: string) => (
    <button
      className={cn("absolute grid h-12 w-12 place-items-center rounded-full bg-white/10 text-lg font-bold active:bg-white/30", cls)}
      onPointerDown={(e) => {
        e.preventDefault();
        hold(a, true);
      }}
      onPointerUp={() => hold(a, false)}
      onPointerLeave={() => hold(a, false)}
      aria-label={a}
    >
      {label}
    </button>
  );
  const btn = (a: ControlAction, label: string) => (
    <button
      key={a}
      className="grid h-12 w-12 place-items-center rounded-full bg-white/15 text-xs font-bold active:bg-gold active:text-black"
      onPointerDown={(e) => {
        e.preventDefault();
        press(a);
      }}
    >
      {label}
    </button>
  );
  return (
    <div className="pointer-events-auto absolute inset-x-0 bottom-3 flex items-end justify-between px-3 sm:hidden">
      <div className="relative h-36 w-36">
        {dir("up", "▲", "left-12 top-0")}
        {dir("down", "▼", "bottom-0 left-12")}
        {dir("left", "◀", "left-0 top-12")}
        {dir("right", "▶", "right-0 top-12")}
      </div>
      <div className="grid grid-cols-4 gap-2">
        {btn("light", "Hit")}
        {btn("heavy", "Big")}
        {btn("grapple", "Grab")}
        {btn("reverse", "Rev")}
        {btn("dodge", "Dodge")}
        {btn("signature", "SIG")}
        {btn("finisher", "FIN")}
        {btn("pin", "Pin")}
      </div>
    </div>
  );
}

interface HudSnapshot {
  state: MatchState;
  phase: MatchFx["phase"];
  now: number;
}

/** Copies the parts of the engine state the HUD renders, so React never reads the live mutable object. */
function snapshot(m: MatchState, phase: MatchFx["phase"]): HudSnapshot {
  return {
    phase,
    now: performance.now(),
    state: {
      ...m,
      events: [],
      fighters: m.fighters.map((f) => ({ ...f, move: f.move ? { ...f.move } : null, uniqueMoves: new Set(f.uniqueMoves), recentMoves: [...f.recentMoves], attrs: f.attrs })) as MatchState["fighters"],
      referee: { ...m.referee },
      pin: m.pin ? { ...m.pin } : null,
      ai: { ...m.ai },
    },
  };
}

/** The 3D (or 2D fallback) view. Memoised: HUD ticks re-render the overlay, never the scene graph. */
const MatchView = memo(function MatchView({ use3d, player, opponent, state, fx, reducedMotion, lowGraphics }: { use3d: boolean; player: Wrestler; opponent: Wrestler; state: React.MutableRefObject<MatchState>; fx: React.MutableRefObject<MatchFx>; reducedMotion: boolean; lowGraphics: boolean }) {
  const [failed3d, setFailed3d] = useState(false);
  const colors: [string, string] = [player.appearance.primaryColor, opponent.appearance.primaryColor];
  if (!use3d || failed3d) {
    return (
      <div className="mx-auto h-full max-w-3xl pt-24">
        <TopDownView state={state} colors={colors} />
      </div>
    );
  }
  return (
    <SafeCanvas shadows={!lowGraphics} dpr={lowGraphics ? 1 : [1, 1.75]} camera={{ position: [0, 6, 12], fov: 45 }} fallback={<TopDownView state={state} colors={colors} />} onError={() => setFailed3d(true)}>
      <MatchScene wrestlers={[player, opponent]} state={state} fx={fx} reducedMotion={reducedMotion} lowGraphics={lowGraphics} />
    </SafeCanvas>
  );
});

export function LiveMatch({ u, config, onExit, onRematch }: { u: Universe; config: MatchConfig; onExit: () => void; onRematch: () => void }) {
  const run = useAction();
  const { player, opponent, titleId, source } = config;
  const controls = u.settings.controls;
  // The engine state is mutable and lives in a ref; the HUD renders from immutable snapshots (below).
  const [initial] = useState(() => createMatch(player, opponent, { timeLimitSec: u.settings.matchMinutes * 60, difficulty: u.settings.difficulty, seed: `${u.seed}:${player.id}:${opponent.id}:${Date.now()}` }));
  const state = useRef<MatchState>(initial);
  const fx = useRef<MatchFx>({ shake: 0, sparks: [], phase: "intro", phaseTime: 0, flash: [0, 0] });
  const input = useRef<MatchInput>({ moveX: 0, moveZ: 0, run: false, pressed: {} });
  const held = useRef(new Set<ControlAction>());
  const paused = useRef(false);
  const [isPaused, setPaused] = useState(false);
  const [hud, setHud] = useState(() => snapshot(initial, "intro"));
  const [feed, setFeed] = useState<Feed[]>([]);
  const [outcome, setOutcome] = useState<Outcome | null>(null);
  const [showResults, setShowResults] = useState(false);
  const [use3d] = useState(() => webglAvailable());
  const feedId = useRef(0);
  const recordedRef = useRef(false);
  const title = titleId ? u.championships[titleId] : null;

  useEffect(() => {
    sfx.setSoundEnabled(u.settings.soundEnabled);
    return () => sfx.stopCrowd();
  }, [u.settings.soundEnabled]);

  const push = useCallback((text: string, tone?: Feed["tone"]) => {
    const id = ++feedId.current;
    setFeed((f) => [...f.slice(-4), { id, text, tone, at: performance.now() }]);
  }, []);

  const finish = useCallback(() => {
    if (recordedRef.current) return;
    recordedRef.current = true;
    const s = state.current;
    const quality = playedMatchQuality(s);
    const base = { winnerId: s.winner, method: s.method, durationSec: Math.round(s.time), quality, titleChange: null as Outcome["titleChange"] };
    if (source.kind === "exhibition") {
      if (!s.winner) {
        setOutcome({ ...base, recorded: "Draws in exhibition matches are not recorded." });
        return;
      }
      const res = run((d) =>
        recordExhibition(d, { sideA: [player.id], sideB: [opponent.id], winnerIds: [s.winner!], quality, titleId, durationSec: Math.round(s.time), finish: s.method }),
      );
      setOutcome({ ...base, titleChange: res?.titleChange ?? null, recorded: res ? "Result recorded in match history, records and popularity." : "Could not record the result." });
    } else {
      const ok = run((d) => {
        const show = d.shows.find((x) => x.id === source.showId);
        const seg = show?.segments.find((x) => x.id === source.segId);
        if (!show || !seg || show.status !== "planned") throw new Error("That show has already run, so the result could not be locked in.");
        if (!s.winner) {
          seg.playedResult = null;
          seg.outcome = { mode: "manual", winnerSide: "draw" };
        } else {
          const winnerSide = seg.sideA.includes(s.winner) ? "A" : "B";
          seg.playedResult = { winnerSide, quality, durationSec: Math.round(s.time), finish: s.method };
        }
        return true;
      });
      setOutcome({ ...base, recorded: ok ? "Result locked into the card. It counts when you run the show." : "Result not saved." });
    }
  }, [source, run, player.id, opponent.id, titleId]);

  // Development-only hook so automated playtests can read the match state.
  useEffect(() => {
    if (process.env.NODE_ENV !== "production") (window as unknown as { __ringsideMatch?: MatchState }).__ringsideMatch = state.current;
  });

  // Latest callbacks, read by the long-lived game loop without restarting it.
  const finishRef = useRef(finish);
  const pushRef = useRef(push);
  useEffect(() => {
    finishRef.current = finish;
    pushRef.current = push;
  });

  // ── Game loop (runs regardless of renderer) ──
  useEffect(() => {
    const push = (text: string, tone?: Feed["tone"]) => pushRef.current(text, tone);
    let raf = 0;
    let last = performance.now();
    let heatTimer = 0;
    const loop = (now: number) => {
      // Real elapsed time (capped at 0.25 s after tab switches), simulated in ≤50 ms sub-steps
      // so slow machines still play at true speed.
      const frame = Math.min(0.25, (now - last) / 1000);
      last = now;
      const steps = Math.max(1, Math.ceil(frame / 0.05));
      for (let i = 0; i < steps; i++) tickOnce(frame / steps);
      raf = requestAnimationFrame(loop);
    };
    const tickOnce = (dt: number) => {
      const f = fx.current;
      const s = state.current;
      if (!paused.current) {
        f.phaseTime += dt;
        if (f.phase === "intro") {
          s.fighters.forEach((x) => (x.animTime += dt));
          if (f.phaseTime > 5) startLive();
        } else {
          const h = held.current;
          const mx = (h.has("right") ? 1 : 0) - (h.has("left") ? 1 : 0);
          const mz = (h.has("down") ? 1 : 0) - (h.has("up") ? 1 : 0);
          input.current.moveX = mx;
          input.current.moveZ = mz;
          input.current.run = h.has("run");
          const wasOver = s.over;
          stepMatch(s, input.current, dt);
          input.current.pressed = {};
          for (const e of s.events) {
            if (e.type === "hit") {
              const ti = s.fighters.findIndex((x) => x.id === e.target);
              f.flash[ti] = 1;
              f.shake += e.big ? 1.2 : e.damage > 5 ? 0.45 : 0.15;
              f.sparks.push({ x: e.x, z: e.z, y: 2.3, big: e.big, color: "#ffd27a" });
              sfx.hit(e.big ? 1 : Math.min(0.8, e.damage / 10));
              if (e.big) {
                sfx.pop(0.9);
                push(`${s.fighters.find((x) => x.id === e.by)?.name} hits the ${e.move}!`, "gold");
              }
            } else if (e.type === "reversal") {
              f.sparks.push({ x: e.x, z: e.z, y: 2.3, big: false, color: "#7ea4ff" });
              sfx.hit(0.4);
              sfx.pop(0.35);
              push(`${s.fighters.find((x) => x.id === e.by)?.name} reverses the ${e.move}!`, "good");
            } else if (e.type === "count") {
              sfx.matSlap();
            } else if (e.type === "kickout") {
              if (e.count >= 2) sfx.pop(1);
              push(`${s.fighters.find((x) => x.id === e.by)?.name} kicks out${e.count >= 2 ? " at two!" : "!"}`, e.count >= 2 ? "gold" : undefined);
            } else if (e.type === "escape") {
              sfx.pop(0.8);
              push(`${s.fighters.find((x) => x.id === e.by)?.name} escapes the hold!`, "good");
            } else if (e.type === "tapout") {
              push(`${s.fighters.find((x) => x.id === e.by)?.name} taps out!`, "bad");
            } else if (e.type === "message") {
              push(e.text, e.tone);
            }
          }
          heatTimer += dt;
          if (heatTimer > 0.25) {
            heatTimer = 0;
            sfx.setCrowdHeat(s.crowdHeat);
          }
          if (!wasOver && s.over) {
            f.phase = "over";
            f.phaseTime = 0;
            sfx.bell(3);
            sfx.pop(1);
            finishRef.current();
          }
          if (f.phase === "over" && f.phaseTime > 3.2) setShowResults(true);
        }
      }
    };
    const startLive = () => {
      if (fx.current.phase !== "intro") return;
      fx.current.phase = "live";
      fx.current.phaseTime = 0;
      sfx.bell(1);
      sfx.startCrowd();
      push("The bell rings!");
    };
    const actionFor = (key: string): ControlAction | null => {
      if (ARROWS[key]) return ARROWS[key];
      const entry = (Object.entries(controls) as [ControlAction, string][]).find(([, k]) => k === key);
      return entry ? entry[0] : null;
    };
    const down = (e: KeyboardEvent) => {
      const key = e.key.toLowerCase();
      const a = actionFor(key);
      if (fx.current.phase === "intro" && !e.repeat) {
        e.preventDefault();
        startLive();
        return;
      }
      if (!a) return;
      e.preventDefault();
      if (a === "pause") {
        if (fx.current.phase !== "live") return;
        paused.current = !paused.current;
        setPaused(paused.current);
        return;
      }
      if (["up", "down", "left", "right", "run"].includes(a)) held.current.add(a);
      else if (!e.repeat && ACTION_KEYS.includes(a)) (input.current.pressed as Record<string, boolean>)[a] = true;
    };
    const up = (e: KeyboardEvent) => {
      const a = actionFor(e.key.toLowerCase());
      if (a) held.current.delete(a);
      if (e.key === "Shift") held.current.delete("run");
    };
    const blur = () => held.current.clear();
    window.addEventListener("keydown", down);
    window.addEventListener("keyup", up);
    window.addEventListener("blur", blur);
    raf = requestAnimationFrame(loop);
    const hud = setInterval(() => setHud(snapshot(state.current, fx.current.phase)), 80);
    return () => {
      cancelAnimationFrame(raf);
      clearInterval(hud);
      window.removeEventListener("keydown", down);
      window.removeEventListener("keyup", up);
      window.removeEventListener("blur", blur);
      sfx.stopCrowd();
    };
  }, [controls]);

  const s = hud.state;
  const f = { phase: hud.phase };
  const [pf, of] = s.fighters;
  const remaining = Math.max(0, s.timeLimit - s.time);
  const clock = `${Math.floor(remaining / 60)}:${String(Math.floor(remaining % 60)).padStart(2, "0")}`;
  const playerPinned = s.pin && s.fighters[s.pin.defender].isPlayer;
  const reversalOpen = of.state === "attack" && of.move && !of.moveHit && of.move.reversalWindow > 0 && of.stateTime >= of.move.startup - of.move.reversalWindow - 0.05;
  const lockupPrompt = pf.state === "lockup";
  const lockedInPrompt = pf.state === "grappled" && of.state === "lockup";
  const now = hud.now;
  const pressTouch = (a: ControlAction) => {
    if (fx.current.phase === "intro") {
      fx.current.phase = "live";
      fx.current.phaseTime = 0;
      sfx.bell(1);
      sfx.startCrowd();
      return;
    }
    if (a === "pause") {
      paused.current = !paused.current;
      setPaused(paused.current);
    } else (input.current.pressed as Record<string, boolean>)[a] = true;
  };
  const holdTouch = (a: ControlAction, down: boolean) => (down ? held.current.add(a) : held.current.delete(a));
  const restart = () => {
    paused.current = false;
    onRematch();
  };

  return (
    <div className="fixed inset-0 z-40 bg-arena">
      {/* renderer */}
      <div className="absolute inset-0">
        <MatchView use3d={use3d} player={player} opponent={opponent} state={state} fx={fx} reducedMotion={u.settings.reducedMotion} lowGraphics={u.settings.graphics === "low"} />
      </div>

      {/* HUD */}
      <div className="pointer-events-none absolute inset-0 flex flex-col">
        <div className="flex items-start justify-between gap-3 bg-gradient-to-b from-black/80 to-transparent p-3 sm:p-5">
          <FighterHud w={player} f={pf} side="left" u={u} />
          <div className="shrink-0 text-center">
            <div className="font-display text-3xl tabular-nums drop-shadow sm:text-4xl">{clock}</div>
            {title && (
              <div className="mt-1 flex items-center justify-center gap-1 text-xs font-semibold text-gold-light">
                <Crown size={12} /> {title.shortName}
              </div>
            )}
            <button className="pointer-events-auto mt-1 rounded bg-black/40 px-2 py-0.5 text-xs text-muted hover:text-ink" onClick={() => pressTouch("pause")} aria-label="Pause">
              <Pause size={12} className="inline" /> {keyLabel(controls.pause)}
            </button>
          </div>
          <FighterHud w={opponent} f={of} side="right" u={u} />
        </div>

        <div className="relative flex-1">
          {/* referee count / meters */}
          {!s.over && s.pin?.kind === "pin" && s.referee.count > 0 && (
            <div key={s.referee.count} className="animate-spotlight absolute left-1/2 top-[18%] -translate-x-1/2 font-display text-8xl text-white drop-shadow-[0_4px_20px_rgba(0,0,0,0.9)]">
              {s.referee.count}
            </div>
          )}
          {playerPinned && (
            <div className="absolute left-1/2 top-[45%] w-72 -translate-x-1/2 text-center">
              <div className="font-display text-2xl text-gold-light drop-shadow">{s.pin!.kind === "pin" ? `Mash ${keyLabel(controls.pin)} to kick out!` : `Mash ${keyLabel(controls.pin)} to escape!`}</div>
              <div className="mt-2 h-3 overflow-hidden rounded bg-black/60 ring-1 ring-gold/50">
                <div
                  className="h-full bg-gold"
                  style={{
                    width: `${Math.min(100, (s.pin!.mash / (s.pin!.kind === "pin" ? kickoutTarget(pf, of.recentMoves.at(-1) === "finisher") : 6 + (100 - pf.health) * 0.25)) * 100)}%`,
                  }}
                />
              </div>
            </div>
          )}
          {reversalOpen && !playerPinned && (
            <div className="absolute left-1/2 top-[38%] -translate-x-1/2 animate-pulse">
              <div className="grid h-16 w-16 place-items-center rounded-full bg-sky-500/90 font-display text-4xl text-white shadow-[0_0_30px_rgba(56,189,248,0.8)]">{keyLabel(controls.reverse)}</div>
            </div>
          )}
          {lockupPrompt && (
            <div className="absolute left-1/2 top-[40%] -translate-x-1/2 rounded-md bg-black/70 px-3 py-2 text-center text-sm">
              <span className="font-semibold text-gold-light">Locked up:</span> {keyLabel(controls.light)} quick move · {keyLabel(controls.heavy)} power move
              {pf.signatures > 0 && ` · ${keyLabel(controls.signature)} signature`}
              {pf.finishers > 0 && ` · ${keyLabel(controls.finisher)} finisher`}
            </div>
          )}
          {lockedInPrompt && (
            <div className="absolute left-1/2 top-[40%] -translate-x-1/2 rounded-md bg-black/70 px-3 py-2 text-sm">
              Caught in a lock-up — press <span className="font-semibold text-sky-300">{keyLabel(controls.reverse)}</span> to counter!
            </div>
          )}
          {/* feed */}
          <ul className="absolute bottom-4 left-4 max-w-sm space-y-1 sm:bottom-6 sm:left-6" aria-live="polite">
            {feed
              .filter((x) => now - x.at < 4500)
              .map((x) => (
                <li key={x.id} className={cn("animate-spotlight w-fit rounded bg-black/60 px-2 py-1 text-sm font-semibold", x.tone === "gold" && "text-gold-light", x.tone === "good" && "text-sky-300", x.tone === "bad" && "text-rose-300")}>
                  {x.text}
                </li>
              ))}
          </ul>
        </div>
        {f.phase === "live" && <TouchPad press={pressTouch} hold={holdTouch} />}
      </div>

      {/* Intro: tale of the tape */}
      {f.phase === "intro" && (
        <button className="absolute inset-0 flex flex-col items-center justify-end bg-gradient-to-t from-black via-black/30 to-transparent pb-14 text-center" onClick={() => pressTouch("light")}>
          {title && (
            <div className="gold-plate mb-3 flex items-center gap-1.5 rounded px-3 py-1 text-sm font-bold">
              <Crown size={14} /> {title.name}
            </div>
          )}
          <div className="flex items-end gap-6 sm:gap-14">
            {[player, opponent].map((w, i) => (
              <div key={w.id} className={cn("animate-spotlight", i === 0 ? "text-right" : "text-left")} style={{ animationDelay: `${i * 0.5}s` }}>
                <div className="font-display text-4xl sm:text-6xl">{w.ringName}</div>
                <div className="mt-1 text-sm text-muted">
                  {heightLabel(w.heightIn)} · {w.weightLbs} lb · {w.record.wins}–{w.record.losses}
                </div>
                <div className="text-sm text-gold-light">Finisher: {w.finisher}</div>
              </div>
            ))}
          </div>
          <p className="mt-8 animate-pulse text-sm text-muted">Press any key to ring the bell</p>
        </button>
      )}

      {/* Pause */}
      {isPaused && (
        <div className="absolute inset-0 grid place-items-center overflow-y-auto bg-black/70 p-4">
          <div className="w-full max-w-xl rounded-xl border border-rope bg-canvas p-6">
            <h2 className="font-display text-4xl">Paused</h2>
            <div className="mt-4">
              <ControlsGuide controls={controls} />
            </div>
            <div className="mt-6 flex flex-wrap gap-2">
              <Button
                variant="gold"
                onClick={() => {
                  paused.current = false;
                  setPaused(false);
                }}
              >
                <Play size={15} /> Resume
              </Button>
              <Button onClick={restart}>
                <RotateCcw size={15} /> Restart match
              </Button>
              <Button variant="ghost" onClick={onExit}>
                Leave match (no result recorded)
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Results */}
      {showResults && outcome && (
        <div className="absolute inset-0 grid place-items-center overflow-y-auto bg-black/60 p-4">
          <div className="animate-spotlight w-full max-w-2xl rounded-xl border border-gold/40 bg-canvas/95 p-6">
            <div className="text-sm text-muted">{outcome.method} · {Math.floor(outcome.durationSec / 60)}:{String(outcome.durationSec % 60).padStart(2, "0")}</div>
            <h2 className="font-display mt-1 text-5xl">
              {outcome.winnerId ? (
                <>
                  <span className="gold-text">{outcome.winnerId === player.id ? player.ringName : opponent.ringName}</span> wins
                </>
              ) : (
                "Time-limit draw"
              )}
            </h2>
            {outcome.titleChange && (
              <div className="gold-plate mt-3 inline-flex items-center gap-1.5 rounded px-3 py-1 text-sm font-bold">
                <Crown size={14} /> New {u.championships[outcome.titleChange.titleId]?.shortName} champion!
              </div>
            )}
            <div className="mt-3 flex items-center gap-3">
              <Stars value={qualityToStars(outcome.quality)} className="text-2xl" />
              <span className="text-sm text-muted">match quality {outcome.quality}/100</span>
            </div>
            <table className="mt-4 w-full text-sm">
              <thead className="text-xs text-muted">
                <tr>
                  <th className="py-1 text-left font-normal" />
                  <th className="py-1 text-right font-normal">{player.ringName}</th>
                  <th className="py-1 text-right font-normal">{opponent.ringName}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-rope">
                {(
                  [
                    ["Moves landed", (x: typeof pf) => x.movesLanded],
                    ["Different moves", (x: typeof pf) => x.uniqueMoves.size],
                    ["Reversals", (x: typeof pf) => x.reversals],
                    ["Kick-outs", (x: typeof pf) => x.kickouts],
                    ["Health left", (x: typeof pf) => Math.round(x.health)],
                  ] as const
                ).map(([label, get]) => (
                  <tr key={label}>
                    <td className="py-1 text-muted">{label}</td>
                    <td className="py-1 text-right tabular-nums">{get(pf)}</td>
                    <td className="py-1 text-right tabular-nums">{get(of)}</td>
                  </tr>
                ))}
                <tr>
                  <td className="py-1 text-muted">Near falls</td>
                  <td className="py-1 text-right tabular-nums" colSpan={2}>
                    {s.nearFalls}
                  </td>
                </tr>
              </tbody>
            </table>
            <p className="mt-3 text-sm text-muted">{outcome.recorded}</p>
            <div className="mt-5 flex flex-wrap gap-2">
              {source.kind === "booking" ? (
                <Link href={`/booking/${source.showId}`}>
                  <Button variant="gold">Back to the card</Button>
                </Link>
              ) : (
                <Button variant="gold" onClick={restart}>
                  <RotateCcw size={15} /> Rematch
                </Button>
              )}
              <Button onClick={onExit}>New match</Button>
              <Link href="/history">
                <Button variant="ghost">Match history</Button>
              </Link>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
