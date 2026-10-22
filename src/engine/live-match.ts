/**
 * Real-time match engine (pure TypeScript, no rendering).
 *
 * Any number of wrestlers, on teams, anywhere in the arena: inside the ring or
 * out on the floor. Wrestlers roll in and out under the ropes, get thrown over
 * the top, and are counted out. Damage is tracked per body part behind the
 * health bar; hurt wrestlers can fire up for a comeback. Every non-player
 * wrestler has its own AI that picks targets, breaks up pins and paces the
 * match so long matches build like real ones.
 */
import { createRng, type Rng } from "./rng";
import type { Wrestler } from "./types";

/** Inside the ring wrestlers stay within ±RING_LIMIT (their bodies touch the ropes at the limit). */
export const RING_LIMIT = 2.8;
/** Height of the ring canvas above the arena floor. */
export const MAT_Y = 1.2;
/** On the floor wrestlers stay outside the ring box and inside the barricade. */
export const FLOOR_INNER = 3.75;
export const FLOOR_LIMIT = 6.25;
const MIN_SEPARATION = 0.75;
const BASE_DAMAGE_SCALE = 0.45;

export type Zone = "ring" | "floor";

export type FighterState =
  | "idle"
  | "walk"
  | "run"
  | "attack"
  | "lockup"
  | "grappled"
  | "stunned"
  | "down"
  | "getup"
  | "dodge"
  | "pinning"
  | "pinned"
  | "submitting"
  | "submitted"
  | "transition"
  | "fired"
  | "victory"
  | "defeat";

export type MoveKind = "light" | "heavy" | "running" | "ground" | "grapple" | "grapple-quick" | "grapple-power" | "signature" | "finisher";
export type BodyPart = "head" | "body" | "arms" | "legs";

export interface MoveDef {
  kind: MoveKind;
  name: string;
  startup: number;
  active: number;
  recovery: number;
  range: number;
  damage: number;
  stamina: number;
  /** Seconds of reversal window that opens for the defender during startup. */
  reversalWindow: number;
  knockdown: boolean;
  stun: number;
  momentum: number;
  attr: keyof Wrestler["attributes"];
  /** Body part the move works over. */
  part: BodyPart;
  submission?: boolean;
}

export interface Transition {
  kind: "roll-out" | "roll-in" | "tumble";
  from: { x: number; z: number; y: number };
  to: { x: number; z: number; y: number };
  zone: Zone;
}

export interface AiBrain {
  thinkTimer: number;
  reversalRolledFor: number;
  lastMove: MatchInput | null;
  intent: string;
}

export interface Fighter {
  id: string;
  name: string;
  isPlayer: boolean;
  team: number;
  x: number;
  z: number;
  /** Feet height: MAT_Y in the ring, 0 on the floor, in between while moving between them. */
  y: number;
  zone: Zone;
  facing: number;
  health: number;
  stamina: number;
  momentum: number;
  /** Damage taken per body part (0 = fresh, 100 = destroyed). */
  parts: Record<BodyPart, number>;
  /** Builds while a hurt wrestler takes punishment in front of a hot crowd. */
  adrenaline: number;
  /** Seconds left fired up (comeback): hits harder, sells less. */
  firedUp: number;
  signatures: number;
  finishers: number;
  state: FighterState;
  stateTime: number;
  stateDuration: number;
  move: MoveDef | null;
  moveId: number;
  moveHit: boolean;
  anim: string;
  animTime: number;
  reversalLockout: number;
  invulnerable: number;
  attrs: Wrestler["attributes"];
  finisherName: string;
  signatureName: string;
  finisherIsSubmission: boolean;
  /** Index of the fighter this one is focused on (−1 when none). */
  target: number;
  /** Index of the fighter locked up with / lifting this one (−1 when none). */
  partner: number;
  /** Seconds spent pushing against the ropes / apron (rolling out or in). */
  edgePush: number;
  transition: Transition | null;
  eliminated: boolean;
  brain: AiBrain;
  // stats for match quality
  movesLanded: number;
  reversals: number;
  kickouts: number;
  ringOuts: number;
  comebacks: number;
  uniqueMoves: Set<string>;
  recentMoves: string[];
  /** Opponent health when this fighter last went for a pin (AI uses it to avoid pin spam). */
  lastPinHealth: number;
  /** Match time of the last pin attempt and of the last comeback. */
  lastPinAt: number;
  lastComebackAt: number;
  /** Seconds since this wrestler last left the ring (AI heads back in after a while). */
  floorTime: number;
}

export interface MatchInput {
  moveX: number;
  moveZ: number;
  run: boolean;
  pressed: Partial<Record<"light" | "heavy" | "grapple" | "dodge" | "reverse" | "signature" | "finisher" | "pin", boolean>>;
}

export type MatchEvent =
  | { type: "hit"; by: string; target: string; move: string; damage: number; x: number; z: number; y: number; big: boolean; part: BodyPart }
  | { type: "reversal"; by: string; move: string; x: number; z: number; y: number }
  | { type: "whiff"; by: string; move: string }
  | { type: "count"; count: number }
  | { type: "kickout"; by: string; count: number }
  | { type: "broken"; by: string; pinner: string }
  | { type: "tapout"; by: string }
  | { type: "escape"; by: string }
  | { type: "reversal-window"; target: string; open: boolean }
  | { type: "outcount"; count: number }
  | { type: "ringout"; target: string; by: string | null; overTop: boolean }
  | { type: "move-zone"; who: string; kind: Transition["kind"] }
  | { type: "fired-up"; by: string }
  | { type: "message"; text: string; tone?: "gold" | "bad" | "good" }
  | { type: "end"; winner: string | null; method: string };

export type MatchMode = "singles" | "triple-threat" | "fatal-4-way";

export interface MatchRules {
  mode: MatchMode;
  /** Ten-count when a wrestler stays on the floor (off in multi-man matches). */
  countOut: boolean;
}

export interface MatchState {
  time: number;
  timeLimit: number;
  rules: MatchRules;
  fighters: Fighter[];
  referee: { x: number; z: number; counting: boolean; count: number; countTime: number; outCount: number };
  pin: { attacker: number; defender: number; mash: number; kind: "pin" | "submission" } | null;
  over: boolean;
  winner: string | null;
  method: string;
  events: MatchEvent[];
  difficulty: number;
  /** Damage multiplier for the match length (longer matches take longer to win). */
  damageScale: number;
  moveSerial: number;
  crowdHeat: number;
  nearFalls: number;
  rngSeed: string;
  tick: number;
}

const DIFFICULTY = { easy: 0.6, normal: 1, hard: 1.45 } as const;
const clamp = (v: number, lo = 0, hi = 100) => Math.max(lo, Math.min(hi, v));

const SUBMISSION_RE = /lock|clutch|hold|crossface|stretch|trap|wheel|sharpshooter|walls of|accolade|redrum|m[ií]stica|armbar|jacket|claw|leglock|bro to sleep|choke|vise|stf|recliner/i;
function partForMoveName(name: string, submission: boolean): BodyPart {
  if (submission) {
    if (/arm|kimura|crossface|accolade|vise/i.test(name)) return "arms";
    if (/leg|ankle|figure|sharpshooter|stf|walls|scorpion|calf|lebell|recliner/i.test(name)) return "legs";
    if (/choke|sleeper|clutch|guillotine|claw|jacket|bro to sleep|redrum|hold/i.test(name)) return "head";
    return "body";
  }
  if (/kick|knee|punch|elbow|stunner|rko|cutter|ddt|neckbreaker|head|piledriver|tombstone|spike|lariat|clothesline|forearm|superkick|brogue|claymore|gts|shot|clash|codebreaker/i.test(name)) return "head";
  return "body";
}

export function buildMoves(w: Pick<Wrestler, "finisher" | "signatures" | "style">) {
  const submission = SUBMISSION_RE.test(w.finisher);
  const strikerish = w.style === "striker" || w.style === "brawler";
  const sig = w.signatures[0] ?? "Signature";
  const moves: Record<MoveKind, MoveDef> = {
    light: { kind: "light", name: strikerish ? "Jab combo" : "Forearm", startup: 0.13, active: 0.1, recovery: 0.22, range: 1.15, damage: 3.2, stamina: 4, reversalWindow: 0.12, knockdown: false, stun: 0.32, momentum: 3, attr: "striking", part: "head" },
    heavy: { kind: "heavy", name: strikerish ? "Big boot" : "Clothesline", startup: 0.36, active: 0.12, recovery: 0.38, range: 1.3, damage: 7, stamina: 9, reversalWindow: 0.28, knockdown: false, stun: 0.7, momentum: 6, attr: "striking", part: "head" },
    running: { kind: "running", name: "Running lariat", startup: 0.18, active: 0.16, recovery: 0.5, range: 1.45, damage: 9, stamina: 10, reversalWindow: 0.18, knockdown: true, stun: 0, momentum: 8, attr: "strength", part: "body" },
    ground: { kind: "ground", name: "Stomp", startup: 0.2, active: 0.1, recovery: 0.3, range: 1.4, damage: 2.5, stamina: 3, reversalWindow: 0, knockdown: false, stun: 0, momentum: 2, attr: "striking", part: "body" },
    grapple: { kind: "grapple", name: "Collar-and-elbow tie-up", startup: 0.26, active: 0.12, recovery: 0.4, range: 1.05, damage: 0, stamina: 5, reversalWindow: 0.24, knockdown: false, stun: 0, momentum: 2, attr: "grappling", part: "body" },
    "grapple-quick": { kind: "grapple-quick", name: "Snap suplex", startup: 0.3, active: 0.2, recovery: 0.5, range: 1.2, damage: 8, stamina: 8, reversalWindow: 0.2, knockdown: true, stun: 0, momentum: 7, attr: "technical", part: "body" },
    "grapple-power": { kind: "grapple-power", name: "Powerbomb", startup: 0.55, active: 0.25, recovery: 0.6, range: 1.2, damage: 12, stamina: 14, reversalWindow: 0.3, knockdown: true, stun: 0, momentum: 10, attr: "strength", part: "body" },
    signature: { kind: "signature", name: sig, startup: 0.4, active: 0.25, recovery: 0.6, range: 1.35, damage: 14, stamina: 12, reversalWindow: 0.22, knockdown: true, stun: 0, momentum: 14, attr: "bigMatch", part: partForMoveName(sig, false) },
    finisher: { kind: "finisher", name: w.finisher, startup: 0.5, active: 0.3, recovery: 0.8, range: 1.35, damage: 22, stamina: 16, reversalWindow: 0.16, knockdown: true, stun: 0, momentum: 20, attr: "bigMatch", part: partForMoveName(w.finisher, submission), submission },
  };
  return moves;
}

function makeFighter(w: Wrestler, isPlayer: boolean, team: number, x: number, z: number): Fighter {
  return {
    id: w.id,
    name: w.ringName,
    isPlayer,
    team,
    x,
    z,
    y: MAT_Y,
    zone: "ring",
    facing: Math.atan2(-x, -z),
    health: 100,
    stamina: 100,
    momentum: 10,
    parts: { head: 0, body: 0, arms: 0, legs: 0 },
    adrenaline: 0,
    firedUp: 0,
    signatures: 0,
    finishers: 0,
    state: "idle",
    stateTime: 0,
    stateDuration: 0,
    move: null,
    moveId: 0,
    moveHit: false,
    anim: "idle",
    animTime: 0,
    reversalLockout: 0,
    invulnerable: 0,
    attrs: { ...w.attributes },
    finisherName: w.finisher,
    signatureName: w.signatures[0] ?? "Signature",
    finisherIsSubmission: buildMoves(w).finisher.submission ?? false,
    target: -1,
    partner: -1,
    edgePush: 0,
    transition: null,
    eliminated: false,
    brain: { thinkTimer: 0.5 + (x * 7.31 + z * 3.17 - Math.floor(x * 7.31 + z * 3.17)) * 0.3, reversalRolledFor: -1, lastMove: null, intent: "approach" },
    movesLanded: 0,
    reversals: 0,
    kickouts: 0,
    ringOuts: 0,
    comebacks: 0,
    uniqueMoves: new Set(),
    recentMoves: [],
    lastPinHealth: 101,
    lastPinAt: -99,
    lastComebackAt: -99,
    floorTime: 0,
  };
}

const movesCache = new Map<string, Record<MoveKind, MoveDef>>();

export interface Entrant {
  wrestler: Wrestler;
  isPlayer?: boolean;
  /** Same team = allies. Defaults to everyone on their own team. */
  team?: number;
}

export interface MatchOptions {
  timeLimitSec: number;
  difficulty: keyof typeof DIFFICULTY;
  seed: string;
  mode?: MatchMode;
}

/** Start a match. `entrants` may also be passed as (player, opponent, opts) for a singles match. */
export function createMatch(entrants: Entrant[], opts: MatchOptions): MatchState;
export function createMatch(player: Wrestler, opponent: Wrestler, opts: MatchOptions): MatchState;
export function createMatch(a: Entrant[] | Wrestler, b: Wrestler | MatchOptions, c?: MatchOptions): MatchState {
  const entrants: Entrant[] = Array.isArray(a) ? a : [{ wrestler: a, isPlayer: true }, { wrestler: b as Wrestler }];
  const opts = (Array.isArray(a) ? b : c) as MatchOptions;
  const mode: MatchMode = opts.mode ?? (entrants.length >= 4 ? "fatal-4-way" : entrants.length === 3 ? "triple-threat" : "singles");
  const n = entrants.length;
  const fighters = entrants.map((e, i) => {
    movesCache.set(e.wrestler.id, buildMoves(e.wrestler));
    // spread around the ring, player on the camera's left
    const ang = n === 2 ? (i === 0 ? -Math.PI / 2 : Math.PI / 2) : -Math.PI / 2 + (i / n) * Math.PI * 2;
    const r = n === 2 ? 1.6 : 1.9;
    return makeFighter(e.wrestler, !!e.isPlayer, e.team ?? i, Math.sin(ang) * r, Math.cos(ang) * r * 0.8);
  });
  const minutes = Math.max(1, opts.timeLimitSec / 60);
  return {
    time: 0,
    timeLimit: opts.timeLimitSec,
    rules: { mode, countOut: mode === "singles" },
    fighters,
    referee: { x: 0, z: -1.8, counting: false, count: 0, countTime: 0, outCount: 0 },
    pin: null,
    over: false,
    winner: null,
    method: "",
    events: [],
    difficulty: DIFFICULTY[opts.difficulty],
    damageScale: BASE_DAMAGE_SCALE * Math.pow(8 / minutes, 0.6),
    moveSerial: 0,
    crowdHeat: 0.4,
    nearFalls: 0,
    rngSeed: opts.seed,
    tick: 0,
  };
}

// ── geometry helpers ──
const dist = (a: Fighter, b: Fighter) => Math.hypot(a.x - b.x, a.z - b.z);
const angleTo = (a: Fighter, b: Fighter) => Math.atan2(b.x - a.x, b.z - a.z);
const isDownState = (f: Fighter) => f.state === "down" || f.state === "getup";
const isUp = (f: Fighter) => !["down", "getup", "pinned", "submitted", "grappled", "pinning", "submitting", "victory", "defeat", "transition"].includes(f.state);
const canAct = (f: Fighter) => ["idle", "walk", "run"].includes(f.state);
const active = (f: Fighter) => !f.eliminated;
const facingDiff = (a: Fighter, b: Fighter) => {
  let d = angleTo(a, b) - a.facing;
  while (d > Math.PI) d -= Math.PI * 2;
  while (d < -Math.PI) d += Math.PI * 2;
  return Math.abs(d);
};
/** Outward normal of the ring side nearest to (x, z). */
const edgeNormal = (x: number, z: number) => (Math.abs(x) > Math.abs(z) ? { x: Math.sign(x) || 1, z: 0 } : { x: 0, z: Math.sign(z) || 1 });
const edgeDistance = (f: Fighter) => RING_LIMIT - Math.max(Math.abs(f.x), Math.abs(f.z));
const opponents = (s: MatchState, f: Fighter) => s.fighters.filter((o) => o !== f && o.team !== f.team && active(o));
const indexOf = (s: MatchState, f: Fighter) => s.fighters.indexOf(f);

function setState(f: Fighter, state: FighterState, duration = 0, anim: string = state) {
  f.state = state;
  f.stateTime = 0;
  f.stateDuration = duration;
  f.anim = anim;
  f.animTime = 0;
  if (state !== "lockup" && state !== "grappled" && state !== "attack") f.partner = -1;
}

function speedOf(f: Fighter, running: boolean) {
  const base = 1.6 + (f.attrs.speed - 60) * 0.012;
  const tired = f.stamina < 20 ? 0.7 : 1;
  const hurt = f.health < 30 ? 0.8 : 1;
  const legs = 1 - Math.min(0.4, f.parts.legs * 0.004);
  const fired = f.firedUp > 0 ? 1.15 : 1;
  return base * (running ? 1.8 : 1) * tired * hurt * legs * fired;
}

function damageFor(state: MatchState, att: Fighter, def: Fighter, move: MoveDef) {
  const power = Math.pow(att.attrs[move.attr] / 75, 0.8);
  const toughness = 1 - (def.attrs.durability - 70) * 0.006;
  const fatigue = att.stamina < 20 ? 0.75 : 1;
  const momentum = 1 + att.momentum / 250;
  const arms = 1 - Math.min(0.3, att.parts.arms * 0.003);
  const fired = (att.firedUp > 0 ? 1.3 : 1) * (def.firedUp > 0 ? 0.6 : 1);
  // slams on the concrete hurt more than on the canvas
  const floor = def.zone === "floor" && (move.knockdown || move.kind === "ground") ? 1.25 : 1;
  return move.damage * state.damageScale * power * toughness * fatigue * momentum * arms * fired * floor;
}

/** Best opponent in front of `f` for an attack (or the nearest when nobody is in front). */
function pickTarget(state: MatchState, f: Fighter, wantDowned?: boolean): Fighter | null {
  let best: Fighter | null = null;
  let bestScore = Infinity;
  for (const o of opponents(state, f)) {
    if (o.zone !== f.zone || o.state === "transition") continue;
    if (wantDowned !== undefined && isDownState(o) !== wantDowned) continue;
    const score = dist(f, o) + facingDiff(f, o) * 0.8;
    if (score < bestScore) {
      bestScore = score;
      best = o;
    }
  }
  return best;
}

function startMove(state: MatchState, f: Fighter, move: MoveDef) {
  const keepPartner = f.partner >= 0 && move.kind !== "grapple" && ["grapple-quick", "grapple-power", "signature", "finisher"].includes(move.kind) && f.state === "lockup";
  const partner = keepPartner ? state.fighters[f.partner] : null;
  const target = partner ?? (f.target >= 0 && state.fighters[f.target] && active(state.fighters[f.target]) && state.fighters[f.target].zone === f.zone ? state.fighters[f.target] : pickTarget(state, f, move.kind === "ground" ? true : undefined));
  f.move = move;
  f.moveId = ++state.moveSerial;
  f.moveHit = false;
  f.stamina = clamp(f.stamina - move.stamina);
  const pIdx = f.partner;
  setState(f, "attack", move.startup + move.active + move.recovery, move.kind);
  if (keepPartner) f.partner = pIdx;
  if (target) {
    f.target = indexOf(state, target);
    if (dist(f, target) < 3.5) f.facing = angleTo(f, target);
    if (move.reversalWindow > 0) state.events.push({ type: "reversal-window", target: target.id, open: true });
  }
}

function triggerReversal(state: MatchState, defender: Fighter, attacker: Fighter) {
  const move = attacker.move!;
  defender.reversals++;
  defender.momentum = clamp(defender.momentum + 8);
  defender.stamina = clamp(defender.stamina - 3);
  attacker.move = null;
  const counterDamage = move.kind === "finisher" || move.kind === "signature" ? 6 : 3;
  attacker.health = clamp(attacker.health - counterDamage);
  if (move.kind === "grapple-power" || move.kind === "finisher" || move.kind === "running") {
    setState(attacker, "down", 1.4 + (100 - attacker.health) * 0.01, "fall");
  } else setState(attacker, "stunned", 0.6, "stagger");
  setState(defender, "attack", 0.45, "counter");
  defender.move = null;
  defender.target = indexOf(state, attacker);
  state.events.push({ type: "reversal", by: defender.id, move: move.name, x: defender.x, z: defender.z, y: defender.y });
  state.events.push({ type: "reversal-window", target: defender.id, open: false });
  state.crowdHeat = clamp(state.crowdHeat + 0.08, 0, 1);
}

function startTransition(state: MatchState, f: Fighter, kind: Transition["kind"]) {
  const n = edgeNormal(f.x, f.z);
  const from = { x: f.x, z: f.z, y: f.y };
  let to: Transition["to"];
  let zone: Zone;
  if (kind === "roll-in") {
    // keep the position along the ring side, step in to just inside the ropes
    const along = n.x !== 0 ? clamp(f.z, -2.4, 2.4) : clamp(f.x, -2.4, 2.4);
    to = n.x !== 0 ? { x: n.x * 2.5, z: along, y: MAT_Y } : { x: along, z: n.z * 2.5, y: MAT_Y };
    zone = "ring";
  } else {
    const along = n.x !== 0 ? clamp(f.z, -3, 3) : clamp(f.x, -3, 3);
    const out = kind === "tumble" ? 4.1 : 3.9;
    to = n.x !== 0 ? { x: n.x * out, z: along, y: 0 } : { x: along, z: n.z * out, y: 0 };
    zone = "floor";
  }
  f.transition = { kind, from, to, zone };
  f.edgePush = 0;
  f.move = null;
  setState(f, "transition", kind === "roll-in" ? 1.1 : kind === "tumble" ? 1.15 : 0.95, kind);
  f.facing = kind === "roll-in" ? Math.atan2(-n.x, -n.z) : Math.atan2(n.x, n.z);
  state.events.push({ type: "move-zone", who: f.id, kind });
}

function updateTransition(state: MatchState, f: Fighter) {
  const t = f.transition!;
  const k = clamp(f.stateTime / f.stateDuration, 0, 1);
  const e = k * k * (3 - 2 * k);
  f.x = t.from.x + (t.to.x - t.from.x) * e;
  f.z = t.from.z + (t.to.z - t.from.z) * e;
  const arc = t.kind === "tumble" ? Math.sin(k * Math.PI) * 0.45 : t.kind === "roll-in" ? Math.sin(k * Math.PI) * 0.15 : Math.sin(k * Math.PI) * 0.1;
  f.y = t.from.y + (t.to.y - t.from.y) * (t.kind === "roll-in" ? Math.min(1, k * 1.6) : k * k) + arc;
  if (k >= 1) {
    f.zone = t.zone;
    f.y = t.to.y;
    f.transition = null;
    if (t.kind === "tumble") {
      const downFor = 2 + (100 - f.health) * 0.02;
      setState(f, "down", downFor, "down");
    } else setState(f, "idle");
  }
}

function tryHit(state: MatchState, att: Fighter) {
  const move = att.move!;
  att.moveHit = true;
  const ground = move.kind === "ground";
  // grapple follow-ups hit the partner; everything else hits whoever is in the way
  let def: Fighter | null = att.partner >= 0 ? state.fighters[att.partner] : null;
  if (!def) {
    const tgt = att.target >= 0 ? state.fighters[att.target] : null;
    const candidates = opponents(state, att).filter((o) => o.zone === att.zone && o.state !== "transition" && (ground ? isDownState(o) : isUp(o) || o.state === "grappled" || o.state === "lockup" || o.state === "pinning"));
    candidates.sort((p, q) => (p === tgt ? -1 : q === tgt ? 1 : dist(att, p) - dist(att, q)));
    def = candidates.find((o) => dist(att, o) <= move.range && facingDiff(att, o) <= 1.1) ?? null;
  }
  if (def) state.events.push({ type: "reversal-window", target: def.id, open: false });
  if (!def || def.invulnerable > 0 || dist(att, def) > move.range + (att.partner >= 0 ? 0.4 : 0)) {
    state.events.push({ type: "whiff", by: att.id, move: move.name });
    att.momentum = clamp(att.momentum - 2);
    return;
  }
  att.target = indexOf(state, def);
  // breaking up a pin, or interrupting someone else's lock-up
  if (state.pin && state.fighters[state.pin.attacker] === def) {
    state.events.push({ type: "broken", by: att.id, pinner: def.id });
    endPin(state, true);
  }
  if ((def.state === "lockup" || def.state === "grappled") && def.partner >= 0 && def.partner !== indexOf(state, att)) {
    const other = state.fighters[def.partner];
    if (other.state === "lockup" || other.state === "grappled") setState(other, "stunned", 0.4, "stagger");
  }
  if (move.kind === "grapple") {
    setState(att, "lockup", 1.4, "lockup");
    setState(def, "grappled", 1.4, "lockup");
    att.move = null;
    att.partner = indexOf(state, def);
    def.partner = indexOf(state, att);
    def.x = att.x + Math.sin(att.facing) * 0.7;
    def.z = att.z + Math.cos(att.facing) * 0.7;
    def.facing = att.facing + Math.PI;
    return;
  }
  const dmg = damageFor(state, att, def, move);
  def.health = clamp(def.health - dmg);
  def.parts[move.part] = clamp(def.parts[move.part] + dmg * 1.3);
  att.momentum = clamp(att.momentum + move.momentum * 0.75);
  att.movesLanded++;
  att.uniqueMoves.add(move.name);
  att.recentMoves = [...att.recentMoves.slice(-3), move.kind];
  def.momentum = clamp(def.momentum - move.momentum * 0.3);
  if (att.momentum >= 60 && att.signatures === 0 && att.finishers === 0) {
    att.signatures = 1;
    state.events.push({ type: "message", text: `${att.name} has a SIGNATURE ready`, tone: "good" });
  }
  if (att.momentum >= 100) {
    att.momentum = 25;
    att.finishers = Math.min(2, att.finishers + 1);
    state.events.push({ type: "message", text: `${att.name}: FINISHER ready!`, tone: "gold" });
  }
  const big = move.kind === "signature" || move.kind === "finisher";
  state.events.push({ type: "hit", by: att.id, target: def.id, move: move.name, damage: Math.round(dmg), x: def.x, z: def.z, y: def.y, big, part: move.part });
  state.crowdHeat = clamp(state.crowdHeat + (big ? 0.2 : move.knockdown ? 0.06 : 0.02), 0, 1);

  // the comeback: punishment in front of a hot crowd fires a hurt wrestler up
  if (def.health < 50 && def.firedUp <= 0) {
    def.adrenaline = clamp(def.adrenaline + dmg * (1 + state.crowdHeat) * 1.4);
  }

  if (move.kind === "finisher" && move.submission) {
    setState(att, "submitting", 4, "submission");
    setState(def, "submitted", 4, "submitted");
    state.pin = { attacker: indexOf(state, att), defender: indexOf(state, def), mash: 0, kind: "submission" };
    state.referee.counting = false;
    state.events.push({ type: "message", text: `${att.name} locks in the ${move.name}!`, tone: "gold" });
    return;
  }
  const noSell = def.firedUp > 0 && !big;
  const knocksDown = !noSell && (move.knockdown || (move.kind === "heavy" && (def.health < 35 || def.stamina < 15)));
  // over the top rope: big hits near the ropes send people to the floor
  if (knocksDown && def.zone === "ring" && edgeDistance(def) < 0.5) {
    const n = edgeNormal(def.x, def.z);
    const dx = def.x - att.x;
    const dz = def.z - att.z;
    const len = Math.hypot(dx, dz) || 1;
    const outward = (dx * n.x + dz * n.z) / len;
    const chance = move.kind === "running" ? 0.85 : move.kind === "heavy" ? 0.45 : big ? 0.5 : 0.3;
    if (outward > 0.45 && createRng(state.rngSeed, state.tick * 7 + def.moveId).chance(chance)) {
      startTransition(state, def, "tumble");
      def.ringOuts++;
      state.crowdHeat = clamp(state.crowdHeat + 0.12, 0, 1);
      state.events.push({ type: "ringout", target: def.id, by: att.id, overTop: true });
      return;
    }
  }
  if (knocksDown) {
    const head = 1 + def.parts.head * 0.006;
    const downFor = (1.2 + (100 - def.health) * 0.022 + (big ? 1.2 : 0) + (def.attrs.recovery < 60 ? 0.4 : 0)) * head;
    setState(def, "down", downFor, "fall");
  } else if (move.stun > 0 && def.state !== "down" && !noSell) {
    setState(def, "stunned", move.stun * (1 + def.parts.head * 0.008), "hit");
  }
  if (def.state === "grappled") setState(def, "down", 1.5, "fall");
}

/** Where the referee kneels to count a pin: beside the pinned wrestler, on the inside of the ring. */
export function refPinSpot(def: Fighter) {
  const len = Math.hypot(def.x, def.z);
  const ux = len > 0.3 ? -def.x / len : 0;
  const uz = len > 0.3 ? -def.z / len : -1;
  return { x: clamp(def.x + ux * 0.9, -RING_LIMIT, RING_LIMIT), z: clamp(def.z + uz * 0.9, -RING_LIMIT, RING_LIMIT) };
}

function kickoutChance(state: MatchState, def: Fighter, count: number, afterFinisher: boolean) {
  // Higher health / durability / momentum → more likely to kick out. Count 1 almost always.
  const base = 0.12 + def.health / 120 + (def.attrs.durability - 70) / 250 + def.momentum / 600;
  const countPenalty = count === 1 ? 0.35 : 0;
  const finisherPenalty = afterFinisher ? 0.35 : 0;
  // early in a match people kick out of almost anything
  const early = Math.max(0, 0.3 - state.time / state.timeLimit) * 0.6;
  return clamp(base + countPenalty - finisherPenalty + early + (def.firedUp > 0 ? 0.3 : 0), 0.02, 0.98);
}

/** Mash presses a player needs before the three-count to kick out. */
export function kickoutTarget(def: Fighter, afterFinisher: boolean, state?: MatchState) {
  const s = state ?? ({ time: 1, timeLimit: 1 } as MatchState);
  return Math.max(1, Math.round((1 - kickoutChance(s, def, 2, afterFinisher)) * 24));
}

function startPin(state: MatchState, att: Fighter, def: Fighter) {
  att.lastPinHealth = def.health;
  att.lastPinAt = state.time;
  setState(att, "pinning", 3.6, "pin");
  setState(def, "pinned", 3.6, "pinned");
  att.x = def.x + 0.35;
  att.z = def.z;
  att.target = indexOf(state, def);
  state.pin = { attacker: indexOf(state, att), defender: indexOf(state, def), mash: 0, kind: "pin" };
  state.referee.counting = true;
  state.referee.count = 0;
  state.referee.countTime = 0;
}

function endPin(state: MatchState, broken = false) {
  const pin = state.pin!;
  const att = state.fighters[pin.attacker];
  const def = state.fighters[pin.defender];
  state.pin = null;
  state.referee.counting = false;
  setState(att, broken ? "down" : "idle", broken ? 1.0 : 0, broken ? "fall" : "idle");
  setState(def, "down", 0.8, "down");
}

function finish(state: MatchState, winner: Fighter | null, method: string) {
  state.over = true;
  state.winner = winner?.id ?? null;
  state.method = method;
  for (const f of state.fighters) {
    if (!winner) setState(f, "idle", 0, "idle");
    else if (f.team === winner.team) setState(f, "victory", 99, "victory");
    else setState(f, "defeat", 99, "defeat");
  }
  state.events.push({ type: "end", winner: state.winner, method });
}

function updatePinOrSubmission(state: MatchState, rng: Rng, dt: number, input: MatchInput) {
  const pin = state.pin!;
  const att = state.fighters[pin.attacker];
  const def = state.fighters[pin.defender];
  const afterFinisher = att.recentMoves[att.recentMoves.length - 1] === "finisher";
  if (def.isPlayer && (input.pressed.pin || input.pressed.reverse || input.pressed.light)) pin.mash += 1;

  if (pin.kind === "pin") {
    if (def.isPlayer && pin.mash >= kickoutTarget(def, afterFinisher, state)) {
      kickout(state, def, state.referee.count);
      return;
    }
    // the referee has to get down beside the pin before the count starts
    const spot = refPinSpot(def);
    if (Math.hypot(state.referee.x - spot.x, state.referee.z - spot.z) > 0.6) return;
    state.referee.countTime += dt;
    if (state.referee.countTime >= 0.85) {
      state.referee.countTime = 0;
      state.referee.count += 1;
      const count = state.referee.count;
      state.events.push({ type: "count", count });
      if (count >= 3) {
        finish(state, att, "Pinfall");
        return;
      }
      const kicks = !def.isPlayer && rng.chance(kickoutChance(state, def, count, afterFinisher));
      if (kicks && (count === 2 || rng.chance(0.25))) kickout(state, def, count);
    }
  } else {
    // Submission: 4 seconds. Escape is harder with the targeted body part worn down.
    const part = att.move?.part ?? "body";
    const worn = def.parts[part as BodyPart] ?? 0;
    def.health = clamp(def.health - dt * 2.2);
    def.parts[part as BodyPart] = clamp(worn + dt * 3);
    if (att.stateTime >= 3.6) {
      const need = 6 + (100 - def.health) * 0.25 + worn * 0.08;
      const escapeChance = kickoutChance(state, def, 2, true) * 0.9 * (1 - worn * 0.004);
      if (def.isPlayer ? pin.mash >= need : rng.chance(escapeChance)) {
        state.events.push({ type: "escape", by: def.id });
        state.nearFalls++;
        state.crowdHeat = clamp(state.crowdHeat + 0.2, 0, 1);
        state.pin = null;
        setState(att, "stunned", 0.6, "stagger");
        setState(def, "down", 1.0, "down");
      } else {
        state.events.push({ type: "tapout", by: def.id });
        finish(state, att, "Submission");
      }
    }
  }
}

function kickout(state: MatchState, def: Fighter, count: number) {
  def.kickouts++;
  def.momentum = clamp(def.momentum + 10);
  if (count >= 2) state.nearFalls++;
  state.crowdHeat = clamp(state.crowdHeat + (count >= 2 ? 0.25 : 0.05), 0, 1);
  if (def.health < 50) def.adrenaline = clamp(def.adrenaline + (count >= 2 ? 25 : 8));
  state.events.push({ type: "kickout", by: def.id, count });
  endPin(state);
}

// ── AI ──

/** Who this AI should be dealing with right now. */
function chooseFocus(state: MatchState, me: Fighter): Fighter | null {
  // break up a pin on someone else before it hits three
  const pin = state.pin;
  if (pin && pin.kind === "pin" && pin.attacker !== indexOf(state, me) && pin.defender !== indexOf(state, me)) {
    const pinner = state.fighters[pin.attacker];
    // only if there's time to get there before the three
    if (pinner.team !== me.team && pinner.zone === me.zone && dist(me, pinner) < 4.5 && isUp(me)) return pinner;
  }
  const current = me.target >= 0 ? state.fighters[me.target] : null;
  if (current && active(current) && current.team !== me.team && current.state !== "victory" && state.tick % 90 !== 0) return current;
  // nearest opponent, preferring people in the same zone and on their feet
  let best: Fighter | null = null;
  let bestScore = Infinity;
  for (const o of opponents(state, me)) {
    const score = dist(me, o) + (o.zone !== me.zone ? 4 : 0) + (isDownState(o) ? 0.6 : 0) + (o.isPlayer ? -0.4 : 0);
    if (score < bestScore) {
      bestScore = score;
      best = o;
    }
  }
  return best;
}

function walkTo(input: MatchInput, me: Fighter, x: number, z: number, run = false) {
  const ang = Math.atan2(x - me.x, z - me.z);
  input.moveX = Math.sin(ang);
  input.moveZ = Math.cos(ang);
  input.run = run;
}

function aiThink(state: MatchState, rng: Rng, me: Fighter): MatchInput {
  const input: MatchInput = { moveX: 0, moveZ: 0, run: false, pressed: {} };
  if (!canAct(me)) return input;
  const foe = chooseFocus(state, me);
  if (!foe) return input;
  me.target = indexOf(state, foe);
  const d = dist(me, foe);
  const diff = state.difficulty;
  const progress = state.time / state.timeLimit;

  // ── zones: get back in before a count-out, follow the fight, or take a breather outside ──
  if (me.zone === "floor") {
    // matches are won in the ring: head back after a short brawl, or once they're down outside
    const mustReturn = (state.rules.countOut && state.referee.outCount >= 5.5) || me.floorTime > 14 || (isDownState(foe) && me.floorTime > 4);
    if (mustReturn || foe.zone === "ring" || me.health > 60 || rng.chance(0.02)) {
      if (foe.zone === "floor" && !mustReturn && d < 4) {
        // brawl on the floor
      } else {
        const n = edgeNormal(me.x, me.z);
        walkTo(input, me, me.x - n.x * 2, me.z - n.z * 2);
        return input;
      }
    }
  } else if (foe.zone === "floor") {
    // in a count-out match, only chase them early in the count; otherwise let the count do the work
    const follow = rng.chance(state.rules.countOut ? (state.referee.outCount < 3 ? 0.6 : 0) : 0.45);
    if (follow) {
      const n = edgeNormal(foe.x, foe.z);
      const tx = n.x !== 0 ? n.x * (RING_LIMIT + 1) : clamp(foe.x, -2.4, 2.4);
      const tz = n.z !== 0 ? n.z * (RING_LIMIT + 1) : clamp(foe.z, -2.4, 2.4);
      walkTo(input, me, tx, tz, d > 3);
      return input;
    }
    // wait for them in the middle of the ring, playing to the crowd
    if (Math.hypot(me.x, me.z) > 1.2) walkTo(input, me, rng.range(-0.8, 0.8), rng.range(-0.8, 0.8));
    input.moveX *= 0.4;
    input.moveZ *= 0.4;
    return input;
  } else if (me.health < 28 && me.stamina < 40 && edgeDistance(me) < 0.6 && !state.pin && rng.chance(0.15)) {
    // roll out to recover
    const n = edgeNormal(me.x, me.z);
    walkTo(input, me, me.x + n.x * 2, me.z + n.z * 2);
    return input;
  }

  // ── break up a pin ──
  if (state.pin && state.fighters[state.pin.attacker] === foe) {
    if (d > 1.2) walkTo(input, me, foe.x, foe.z, true);
    else input.pressed.heavy = true;
    return input;
  }

  const foeDown = isDownState(foe);
  if (foeDown) {
    if (d > 1.2) {
      walkTo(input, me, foe.x, foe.z, d > 3 && me.stamina > 40);
      return input;
    }
    const lastBig = ["finisher", "signature"].includes(me.recentMoves[me.recentMoves.length - 1]);
    // pacing: early in the match, pins only after big moves or real damage
    const healthLine = progress < 0.2 ? 22 : progress < 0.5 ? 35 : 55;
    const worn = foe.health < 15 && state.time - me.lastPinAt > 6;
    const wantsPin = foe.zone === "ring" && (lastBig || worn || (foe.health < me.lastPinHealth - 12 && (foe.health < healthLine || (foe.health < healthLine + 20 && rng.chance(0.15)))));
    if (wantsPin && rng.chance(0.7 * Math.min(1.2, diff))) input.pressed.pin = true;
    else if (rng.chance(0.4)) input.pressed.light = true; // stomp
    else {
      const ang = angleTo(me, foe) + Math.PI;
      input.moveX = Math.sin(ang) * 0.6;
      input.moveZ = Math.cos(ang) * 0.6;
    }
    return input;
  }

  // Tired and hurt → retreat to recover.
  if (me.stamina < 15 && d < 2 && rng.chance(0.6)) {
    if (rng.chance(0.4)) input.pressed.dodge = true;
    const ang = angleTo(me, foe) + Math.PI + rng.range(-0.6, 0.6);
    input.moveX = Math.sin(ang);
    input.moveZ = Math.cos(ang);
    return input;
  }

  if (d > 1.25) {
    walkTo(input, me, foe.x, foe.z, d > 2.6 && me.stamina > 45 && rng.chance(0.5));
    if (input.run && d < 2.4) input.pressed.light = true; // running attack
    return input;
  }

  // In range: weighted choice, shaped by the stage of the match
  const a = me.attrs;
  const foeStunned = foe.state === "stunned";
  const early = progress < 0.25;
  const w: Record<string, number> = {
    light: 2.5 + (a.striking - 60) / 15,
    heavy: 1.6 + (a.striking - 60) / 20 + (foeStunned ? 2 : 0) - (early ? 0.6 : 0),
    grapple: 1.8 + (a.grappling - 60) / 15 + (a.strength - 60) / 30 + (early ? 1.2 : 0),
    dodge: foe.state === "attack" ? 2.5 * diff : 0.2,
    wait: me.stamina < 35 ? 2 : 0.6,
    signature: me.signatures > 0 ? (foeStunned || foe.health < 70 ? 4 : 1.5) * (early ? 0.3 : 1) : 0,
    finisher: me.finishers > 0 ? (foe.health < 55 || foeStunned ? 6 : 1.2) * (early ? 0.2 : 1) : 0,
  };
  for (const recent of me.recentMoves) if (w[recent] != null) w[recent] *= 0.6;
  const total = Object.values(w).reduce((s, v) => s + v, 0);
  let r = rng.next() * total;
  let choice = "light";
  for (const [k, v] of Object.entries(w)) {
    r -= v;
    if (r <= 0) {
      choice = k;
      break;
    }
  }
  if (choice === "wait") {
    const ang = angleTo(me, foe) + Math.PI / 2;
    input.moveX = Math.sin(ang) * 0.5;
    input.moveZ = Math.cos(ang) * 0.5;
  } else (input.pressed as Record<string, boolean>)[choice] = true;
  return input;
}

/** The AI's lock-up decision, once it has the advantage. */
function aiLockup(state: MatchState, rng: Rng, me: Fighter): MatchInput {
  const input: MatchInput = { moveX: 0, moveZ: 0, run: false, pressed: {} };
  if (me.stateTime <= 0.35) return input;
  const foe = me.partner >= 0 ? state.fighters[me.partner] : null;
  const pick = rng.next();
  if (me.finishers > 0 && foe && foe.health < 60) input.pressed.finisher = true;
  else if (me.signatures > 0 && pick < 0.4) input.pressed.signature = true;
  else if (pick < 0.55 + (me.attrs.strength - 70) / 100) input.pressed.heavy = true;
  else input.pressed.light = true;
  return input;
}

function applyInput(state: MatchState, f: Fighter, input: MatchInput, dt: number) {
  const moves = movesCache.get(f.id)!;
  // Reversal attempt against whoever is attacking us right now.
  if (input.pressed.reverse && f.reversalLockout <= 0) {
    const me = indexOf(state, f);
    const att = state.fighters.find(
      (o) =>
        o !== f &&
        o.team !== f.team &&
        ((o.state === "attack" && o.move && !o.moveHit && o.move.reversalWindow > 0 && o.target === me && o.stateTime >= o.move.startup - o.move.reversalWindow && dist(o, f) < o.move.range + 0.4) ||
          (f.state === "grappled" && o.state === "lockup" && o.partner === me && o.stateTime > 0.15 && o.stateTime < 0.7)),
    );
    if (att && (isUp(f) || f.state === "grappled")) {
      if (f.state === "grappled") att.move = moves["grapple-quick"];
      triggerReversal(state, f, att);
      return;
    }
    f.reversalLockout = 0.6; // mistimed
  }

  // Lock-up follow-ups
  if (f.state === "lockup") {
    let follow: MoveDef | null = null;
    if (input.pressed.light) follow = moves["grapple-quick"];
    else if (input.pressed.heavy) follow = moves["grapple-power"];
    else if (input.pressed.grapple) follow = moves["grapple-quick"];
    else if (input.pressed.signature && f.signatures > 0) follow = moves.signature;
    else if (input.pressed.finisher && f.finishers > 0) follow = moves.finisher;
    if (follow) {
      if (follow.kind === "signature") f.signatures = 0;
      if (follow.kind === "finisher") f.finishers -= 1;
      if (f.stamina < follow.stamina / 2) follow = moves["grapple-quick"];
      const foe = f.partner >= 0 ? state.fighters[f.partner] : null;
      startMove(state, f, follow);
      if (foe) foe.stateDuration = Math.max(foe.stateDuration, foe.stateTime + follow.startup + follow.active + 0.05);
    }
    return;
  }

  if (!canAct(f)) return;

  // Movement
  const mag = Math.hypot(input.moveX, input.moveZ);
  const running = input.run && f.stamina > 5 && mag > 0.1;
  const focus = f.target >= 0 ? state.fighters[f.target] : null;
  if (mag > 0.1) {
    const dx = input.moveX / mag;
    const dz = input.moveZ / mag;
    const sp = speedOf(f, running) * dt;
    f.x += dx * sp;
    f.z += dz * sp;
    if (focus && focus.zone === f.zone && dist(f, focus) < 3 && !running) f.facing = angleTo(f, focus);
    else f.facing = Math.atan2(dx, dz);
    if (f.state !== (running ? "run" : "walk")) setState(f, running ? "run" : "walk", 0, running ? "run" : "walk");
    if (running) f.stamina = clamp(f.stamina - dt * 7);
    // pushing into the ropes rolls you out; pushing into the apron rolls you in
    const n = edgeNormal(f.x, f.z);
    const into = dx * n.x + dz * n.z;
    // only a deliberate push (full stick) rolls you through
    const firm = mag > 0.6;
    if (firm && f.zone === "ring" && edgeDistance(f) < 0.14 && into > 0.7) f.edgePush += dt;
    else if (firm && f.zone === "floor" && Math.max(Math.abs(f.x), Math.abs(f.z)) - FLOOR_INNER < 0.16 && into < -0.7) f.edgePush += dt;
    else f.edgePush = 0;
    if (f.edgePush > 0.4 && !state.pin) {
      startTransition(state, f, f.zone === "ring" ? "roll-out" : "roll-in");
      return;
    }
  } else {
    f.edgePush = 0;
    if (f.state !== "idle") setState(f, "idle", 0, "idle");
  }

  // Player auto-targets whoever is in front; AI keeps its own focus.
  if (f.isPlayer) {
    const t = pickTarget(state, f);
    if (t) f.target = indexOf(state, t);
  }
  const downed = pickTarget(state, f, true);
  const canPin = downed && downed.zone === "ring" && f.zone === "ring" && dist(f, downed) < 1.5 && !state.pin;
  if (input.pressed.pin && canPin) {
    startPin(state, f, downed!);
    return;
  }
  if (input.pressed.dodge && f.stamina >= 5) {
    f.stamina = clamp(f.stamina - 5);
    f.invulnerable = 0.35;
    setState(f, "dodge", 0.4, "dodge");
    const ang = mag > 0.1 ? Math.atan2(input.moveX, input.moveZ) : focus ? angleTo(f, focus) + Math.PI : f.facing + Math.PI;
    f.x += Math.sin(ang) * 0.9;
    f.z += Math.cos(ang) * 0.9;
    return;
  }
  const standingFoe = pickTarget(state, f, false);
  const nearDowned = downed && dist(f, downed) < 1.6 && (!standingFoe || dist(f, standingFoe) > 1.5);
  if (input.pressed.finisher && f.finishers > 0 && !nearDowned) {
    f.finishers -= 1;
    startMove(state, f, moves.finisher);
    return;
  }
  if (input.pressed.signature && f.signatures > 0 && !nearDowned) {
    f.signatures = 0;
    startMove(state, f, moves.signature);
    return;
  }
  if (input.pressed.grapple && !nearDowned) return startMove(state, f, moves.grapple);
  if (input.pressed.heavy) return startMove(state, f, nearDowned ? moves.ground : moves.heavy);
  if (input.pressed.light) return startMove(state, f, nearDowned ? moves.ground : f.state === "run" ? moves.running : moves.light);
}

/** Keep everyone where they can physically be. */
function constrain(f: Fighter) {
  if (f.state === "transition") return;
  if (f.zone === "ring") {
    f.x = clamp(f.x, -RING_LIMIT, RING_LIMIT);
    f.z = clamp(f.z, -RING_LIMIT, RING_LIMIT);
    f.y = MAT_Y;
  } else {
    f.x = clamp(f.x, -FLOOR_LIMIT, FLOOR_LIMIT);
    f.z = clamp(f.z, -FLOOR_LIMIT, FLOOR_LIMIT);
    if (Math.max(Math.abs(f.x), Math.abs(f.z)) < FLOOR_INNER) {
      if (Math.abs(f.x) > Math.abs(f.z)) f.x = Math.sign(f.x || 1) * FLOOR_INNER;
      else f.z = Math.sign(f.z || 1) * FLOOR_INNER;
    }
    f.y = 0;
  }
}

/** Advances the match by dt seconds. Clears and refills `state.events`. */
export function stepMatch(state: MatchState, playerInput: MatchInput, dt: number): MatchState {
  state.events = [];
  if (state.over) {
    for (const f of state.fighters) f.animTime += dt;
    return state;
  }
  dt = Math.min(dt, 0.05);
  state.tick++;
  state.time += dt;
  const rng = createRng(state.rngSeed, state.tick);
  const fighters = state.fighters;

  for (const f of fighters) {
    f.stateTime += dt;
    f.animTime += dt;
    f.reversalLockout = Math.max(0, f.reversalLockout - dt);
    f.invulnerable = Math.max(0, f.invulnerable - dt);
    f.firedUp = Math.max(0, f.firedUp - dt);
    f.floorTime = f.zone === "floor" ? f.floorTime + dt : 0;
    const bodyRegen = 1 - Math.min(0.5, f.parts.body * 0.005);
    if (f.state === "idle" || f.state === "walk" || f.state === "down") f.stamina = clamp(f.stamina + dt * (5 + f.attrs.stamina * 0.06 + f.attrs.recovery * 0.03) * bodyRegen);
    if (f.state === "down") f.health = clamp(f.health + dt * 0.4);
    // fired up: a comeback burst
    if (f.adrenaline >= 100 && f.firedUp <= 0 && f.comebacks < 2 && state.time - f.lastComebackAt > 60 && (f.state === "idle" || f.state === "walk" || f.state === "getup")) {
      f.adrenaline = 0;
      f.lastComebackAt = state.time;
      f.firedUp = 7;
      f.comebacks++;
      f.stamina = clamp(f.stamina + 30);
      setState(f, "fired", 0.9, "taunt");
      f.invulnerable = 0.9;
      state.crowdHeat = clamp(state.crowdHeat + 0.25, 0, 1);
      state.events.push({ type: "fired-up", by: f.id });
      state.events.push({ type: "message", text: `${f.name} is FIRED UP!`, tone: "gold" });
    }
  }

  if (state.pin) {
    updatePinOrSubmission(state, rng, dt, playerInput);
    if (state.over) return state;
  }

  // Resolve timed states
  for (const f of fighters) {
    if (f.state === "transition") updateTransition(state, f);
    else if (f.state === "attack" && f.move) {
      if (!f.moveHit && f.stateTime >= f.move.startup) tryHit(state, f);
      if (f.state === "attack" && f.stateTime >= f.stateDuration) {
        f.move = null;
        setState(f, "idle");
      }
    } else if (f.state === "attack" && f.stateTime >= f.stateDuration) setState(f, "idle");
    else if (f.state === "lockup" && f.stateTime >= f.stateDuration) {
      // Nobody chose a follow-up: break the tie-up.
      const p = f.partner >= 0 ? fighters[f.partner] : null;
      setState(f, "idle");
      if (p && p.state === "grappled") setState(p, "stunned", 0.2, "stagger");
      state.events.push({ type: "message", text: "Break!" });
    } else if (f.state === "grappled" && f.stateTime >= f.stateDuration) setState(f, "idle");
    else if ((f.state === "stunned" || f.state === "dodge" || f.state === "fired") && f.stateTime >= f.stateDuration) setState(f, "idle");
    else if (f.state === "down" && f.stateTime >= f.stateDuration) setState(f, "getup", 0.7, "getup");
    else if (f.state === "getup" && f.stateTime >= f.stateDuration) {
      setState(f, "idle");
      f.invulnerable = 0.3;
    }
  }

  // AI for everyone but the player
  const inputs = new Map<Fighter, MatchInput>();
  for (const me of fighters) {
    if (me.isPlayer || !active(me)) continue;
    const brain = me.brain;
    brain.thinkTimer -= dt;
    let ai: MatchInput = { moveX: 0, moveZ: 0, run: false, pressed: {} };
    // Reversal reaction: rolled once per incoming move aimed at me, when its window opens.
    const myIdx = indexOf(state, me);
    for (const att of fighters) {
      if (att === me || att.state !== "attack" || !att.move || att.moveHit || att.move.reversalWindow <= 0 || att.target !== myIdx || brain.reversalRolledFor === att.moveId) continue;
      if (att.stateTime >= att.move.startup - att.move.reversalWindow) {
        brain.reversalRolledFor = att.moveId;
        const chance = clamp((0.1 + (me.attrs.reversal - 55) / 160) * state.difficulty * (att.move.kind === "finisher" ? 0.6 : 1) * (me.stamina < 15 ? 0.5 : 1), 0.02, 0.6);
        if (dist(att, me) < att.move.range + 0.4 && (isUp(me) || me.state === "grappled") && rng.chance(chance)) ai.pressed.reverse = true;
      }
    }
    if (me.state === "lockup") {
      const lock = aiLockup(state, rng, me);
      ai = { ...lock, pressed: { ...lock.pressed, ...ai.pressed } };
    }
    else if (brain.thinkTimer <= 0 && !ai.pressed.reverse) {
      const reaction = 0.32 / state.difficulty;
      brain.thinkTimer = rng.range(reaction * 0.6, reaction * 1.4);
      const thought = aiThink(state, rng, me);
      ai = thought;
      brain.intent = Object.keys(thought.pressed)[0] ?? (Math.hypot(thought.moveX, thought.moveZ) > 0 ? "move" : "wait");
      brain.lastMove = { ...thought, pressed: {} };
    } else if (brain.lastMove && canAct(me)) {
      ai = { ...brain.lastMove, pressed: ai.pressed };
    }
    inputs.set(me, ai);
  }

  for (const f of fighters) {
    if (!active(f)) continue;
    applyInput(state, f, f.isPlayer ? playerInput : (inputs.get(f) ?? { moveX: 0, moveZ: 0, run: false, pressed: {} }), dt);
  }

  // Constrain and keep wrestlers apart (except tied-up pairs and pins)
  for (const f of fighters) constrain(f);
  for (let i = 0; i < fighters.length; i++)
    for (let j = i + 1; j < fighters.length; j++) {
      const p = fighters[i];
      const o = fighters[j];
      if (!active(p) || !active(o) || p.zone !== o.zone || p.state === "transition" || o.state === "transition") continue;
      if (p.partner === j || o.partner === i) continue;
      if (state.pin && [state.pin.attacker, state.pin.defender].includes(i) && [state.pin.attacker, state.pin.defender].includes(j)) continue;
      const d = dist(p, o);
      if (d < MIN_SEPARATION && d > 0.0001) {
        const push = (MIN_SEPARATION - d) / 2;
        const nx = (p.x - o.x) / d;
        const nz = (p.z - o.z) / d;
        p.x += nx * push;
        p.z += nz * push;
        o.x -= nx * push;
        o.z -= nz * push;
        constrain(p);
        constrain(o);
      }
    }

  // Count-outs: the referee counts while anyone is on the floor
  if (state.rules.countOut && !state.pin) {
    const outside = fighters.filter((f) => active(f) && (f.zone === "floor" || f.transition?.zone === "floor") && f.transition?.kind !== "roll-in");
    if (outside.length) {
      const before = Math.floor(state.referee.outCount);
      state.referee.outCount += dt * 0.95;
      const now = Math.floor(state.referee.outCount);
      if (now > before && now >= 1) state.events.push({ type: "outcount", count: now });
      if (state.referee.outCount >= 10) {
        const inside = fighters.filter((f) => active(f) && !outside.includes(f));
        if (!inside.length) finish(state, null, "Double count-out");
        else finish(state, inside[0], "Count-out");
        return state;
      }
    } else state.referee.outCount = 0;
  }

  // Referee: kneel by pins, watch the action, or lean on the ropes to count the floor
  const player = fighters.find((f) => f.isPlayer) ?? fighters[0];
  const focus = player.target >= 0 ? fighters[player.target] : fighters.find((f) => f !== player && active(f)) ?? player;
  let target: { x: number; z: number };
  let refSpeed = 2;
  if (state.pin) {
    target = refPinSpot(fighters[state.pin.defender]);
    refSpeed = 5;
  } else if (state.referee.outCount > 0) {
    const out = fighters.find((f) => f.zone === "floor") ?? player;
    const n = edgeNormal(out.x, out.z);
    target = { x: n.x !== 0 ? n.x * 2.6 : clamp(out.x, -2.6, 2.6), z: n.z !== 0 ? n.z * 2.6 : clamp(out.z, -2.6, 2.6) };
  } else {
    const a = player.zone === "ring" ? player : focus;
    const b = focus.zone === "ring" ? focus : player;
    const mx = (a.x + b.x) / 2;
    const mz = (a.z + b.z) / 2;
    target = { x: clamp(mx + 1.2, -2.7, 2.7), z: clamp(mz - 1.6, -2.7, 2.7) };
  }
  state.referee.x += clamp(target.x - state.referee.x, -refSpeed * dt, refSpeed * dt) + (target.x - state.referee.x) * Math.min(1, dt * 1.5) * 0.3;
  state.referee.z += clamp(target.z - state.referee.z, -refSpeed * dt, refSpeed * dt) + (target.z - state.referee.z) * Math.min(1, dt * 1.5) * 0.3;
  state.referee.x = clamp(state.referee.x, -RING_LIMIT, RING_LIMIT);
  state.referee.z = clamp(state.referee.z, -RING_LIMIT, RING_LIMIT);

  state.crowdHeat = clamp(state.crowdHeat - dt * 0.015, 0.2, 1);
  if (state.time >= state.timeLimit && !state.over) finish(state, null, "Time-limit draw");
  return state;
}

/** The player-controlled fighter (or the first one in AI-only matches). */
export function playerOf(state: MatchState) {
  return state.fighters.find((f) => f.isPlayer) ?? state.fighters[0];
}

/** 0–100 quality for recording the played match into the universe. */
export function playedMatchQuality(state: MatchState) {
  const fs = state.fighters;
  const variety = fs.reduce((s, f) => s + f.uniqueMoves.size, 0) / Math.max(1, fs.length / 2);
  const reversals = fs.reduce((s, f) => s + f.reversals, 0);
  const minutes = state.time / 60;
  const healths = fs.map((f) => f.health);
  const close = 100 - (Math.max(...healths) - Math.min(...healths));
  const spots = fs.reduce((s, f) => s + f.ringOuts + f.comebacks * 2, 0);
  const q = 42 + Math.min(16, variety * 2) + Math.min(12, reversals * 2) + Math.min(16, state.nearFalls * 5) + Math.min(10, minutes * 1.6) + close * 0.06 + Math.min(6, spots * 1.5);
  return Math.round(clamp(q, 25, 97));
}
