/**
 * Real-time wrestling match engine (renderer-agnostic, deterministic for a given
 * input sequence). The 3D scene calls `stepMatch` every frame with the player's
 * input; the AI opponent is driven from inside the engine.
 */
import { clamp, createRng, type Rng } from "./rng";
import type { Wrestler } from "./types";

export const RING_LIMIT = 2.65;
const MIN_SEPARATION = 0.75;
/** Tuned so an evenly matched bout lasts a few minutes. */
const DAMAGE_SCALE = 0.45;

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
  | "victory"
  | "defeat";

export type MoveKind = "light" | "heavy" | "running" | "ground" | "grapple" | "grapple-quick" | "grapple-power" | "signature" | "finisher";

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
  submission?: boolean;
}

export interface Fighter {
  id: string;
  name: string;
  isPlayer: boolean;
  x: number;
  z: number;
  facing: number;
  health: number;
  stamina: number;
  momentum: number;
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
  // stats for match quality
  movesLanded: number;
  reversals: number;
  kickouts: number;
  uniqueMoves: Set<string>;
  recentMoves: string[];
  /** Opponent health when this fighter last went for a pin (AI uses it to avoid pin spam). */
  lastPinHealth: number;
}

export interface MatchInput {
  moveX: number;
  moveZ: number;
  run: boolean;
  pressed: Partial<Record<"light" | "heavy" | "grapple" | "dodge" | "reverse" | "signature" | "finisher" | "pin", boolean>>;
}

export type MatchEvent =
  | { type: "hit"; by: string; target: string; move: string; damage: number; x: number; z: number; big: boolean }
  | { type: "reversal"; by: string; move: string; x: number; z: number }
  | { type: "whiff"; by: string; move: string }
  | { type: "count"; count: number }
  | { type: "kickout"; by: string; count: number }
  | { type: "tapout"; by: string }
  | { type: "escape"; by: string }
  | { type: "reversal-window"; target: string; open: boolean }
  | { type: "message"; text: string; tone?: "gold" | "bad" | "good" }
  | { type: "end"; winner: string | null; method: string };

export interface MatchState {
  time: number;
  timeLimit: number;
  fighters: [Fighter, Fighter];
  referee: { x: number; z: number; counting: boolean; count: number; countTime: number };
  pin: { attacker: number; defender: number; mash: number; kind: "pin" | "submission" } | null;
  over: boolean;
  winner: string | null;
  method: string;
  events: MatchEvent[];
  ai: { thinkTimer: number; intent: string; reversalRolledFor: number; difficulty: number; lastMove: MatchInput | null };
  moveSerial: number;
  crowdHeat: number;
  nearFalls: number;
  rngSeed: string;
  tick: number;
}

const DIFFICULTY = { easy: 0.6, normal: 1, hard: 1.45 } as const;

export function buildMoves(w: Pick<Wrestler, "finisher" | "signatures" | "style">) {
  const submission = /lock|clutch|hold|crossface|stretch|thesis|permafrost|trap|wheel/i.test(w.finisher);
  const strikerish = w.style === "striker" || w.style === "brawler";
  const moves: Record<MoveKind, MoveDef> = {
    light: { kind: "light", name: strikerish ? "Jab combo" : "Forearm", startup: 0.13, active: 0.1, recovery: 0.22, range: 1.15, damage: 3.2, stamina: 4, reversalWindow: 0.12, knockdown: false, stun: 0.32, momentum: 3, attr: "striking" },
    heavy: { kind: "heavy", name: strikerish ? "Big boot" : "Clothesline", startup: 0.36, active: 0.12, recovery: 0.38, range: 1.3, damage: 7, stamina: 9, reversalWindow: 0.28, knockdown: false, stun: 0.7, momentum: 6, attr: "striking" },
    running: { kind: "running", name: "Running lariat", startup: 0.18, active: 0.16, recovery: 0.5, range: 1.45, damage: 9, stamina: 10, reversalWindow: 0.18, knockdown: true, stun: 0, momentum: 8, attr: "strength" },
    ground: { kind: "ground", name: "Stomp", startup: 0.2, active: 0.1, recovery: 0.3, range: 1.4, damage: 2.5, stamina: 3, reversalWindow: 0, knockdown: false, stun: 0, momentum: 2, attr: "striking" },
    grapple: { kind: "grapple", name: "Collar-and-elbow tie-up", startup: 0.26, active: 0.12, recovery: 0.4, range: 1.05, damage: 0, stamina: 5, reversalWindow: 0.24, knockdown: false, stun: 0, momentum: 2, attr: "grappling" },
    "grapple-quick": { kind: "grapple-quick", name: "Snap suplex", startup: 0.3, active: 0.2, recovery: 0.5, range: 1.2, damage: 8, stamina: 8, reversalWindow: 0.2, knockdown: true, stun: 0, momentum: 7, attr: "technical" },
    "grapple-power": { kind: "grapple-power", name: "Powerbomb", startup: 0.55, active: 0.25, recovery: 0.6, range: 1.2, damage: 12, stamina: 14, reversalWindow: 0.3, knockdown: true, stun: 0, momentum: 10, attr: "strength" },
    signature: { kind: "signature", name: w.signatures[0] ?? "Signature", startup: 0.4, active: 0.25, recovery: 0.6, range: 1.35, damage: 14, stamina: 12, reversalWindow: 0.22, knockdown: true, stun: 0, momentum: 14, attr: "bigMatch" },
    finisher: { kind: "finisher", name: w.finisher, startup: 0.5, active: 0.3, recovery: 0.8, range: 1.35, damage: 22, stamina: 16, reversalWindow: 0.16, knockdown: true, stun: 0, momentum: 20, attr: "bigMatch", submission },
  };
  return moves;
}

function makeFighter(w: Wrestler, isPlayer: boolean, x: number): Fighter {
  return {
    id: w.id,
    name: w.ringName,
    isPlayer,
    x,
    z: 0,
    facing: x < 0 ? Math.PI / 2 : -Math.PI / 2,
    health: 100,
    stamina: 100,
    momentum: 10,
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
    movesLanded: 0,
    reversals: 0,
    kickouts: 0,
    uniqueMoves: new Set(),
    recentMoves: [],
    lastPinHealth: 101,
  };
}

const movesCache = new Map<string, Record<MoveKind, MoveDef>>();
export function createMatch(player: Wrestler, opponent: Wrestler, opts: { timeLimitSec: number; difficulty: keyof typeof DIFFICULTY; seed: string }): MatchState {
  movesCache.set(player.id, buildMoves(player));
  movesCache.set(opponent.id, buildMoves(opponent));
  return {
    time: 0,
    timeLimit: opts.timeLimitSec,
    fighters: [makeFighter(player, true, -1.6), makeFighter(opponent, false, 1.6)],
    referee: { x: 0, z: 1.8, counting: false, count: 0, countTime: 0 },
    pin: null,
    over: false,
    winner: null,
    method: "",
    events: [],
    ai: { thinkTimer: 0.5, intent: "approach", reversalRolledFor: -1, difficulty: DIFFICULTY[opts.difficulty], lastMove: null },
    moveSerial: 0,
    crowdHeat: 0.4,
    nearFalls: 0,
    rngSeed: opts.seed,
    tick: 0,
  };
}

const dist = (a: Fighter, b: Fighter) => Math.hypot(a.x - b.x, a.z - b.z);
const angleTo = (a: Fighter, b: Fighter) => Math.atan2(b.x - a.x, b.z - a.z);
const isUp = (f: Fighter) => !["down", "getup", "pinned", "submitted", "grappled", "pinning", "submitting", "victory", "defeat"].includes(f.state);
const canAct = (f: Fighter) => ["idle", "walk", "run"].includes(f.state);
const facingDiff = (a: Fighter, b: Fighter) => {
  let d = angleTo(a, b) - a.facing;
  while (d > Math.PI) d -= Math.PI * 2;
  while (d < -Math.PI) d += Math.PI * 2;
  return Math.abs(d);
};

function setState(f: Fighter, state: FighterState, duration = 0, anim: string = state) {
  f.state = state;
  f.stateTime = 0;
  f.stateDuration = duration;
  f.anim = anim;
  f.animTime = 0;
}

function speedOf(f: Fighter, running: boolean) {
  const base = 1.6 + (f.attrs.speed - 60) * 0.012;
  const tired = f.stamina < 20 ? 0.7 : 1;
  const hurt = f.health < 30 ? 0.8 : 1;
  return base * (running ? 1.8 : 1) * tired * hurt;
}

function damageFor(att: Fighter, def: Fighter, move: MoveDef) {
  const power = Math.pow(att.attrs[move.attr] / 75, 0.8);
  const toughness = 1 - (def.attrs.durability - 70) * 0.006;
  const fatigue = att.stamina < 20 ? 0.75 : 1;
  const momentum = 1 + att.momentum / 250;
  return move.damage * DAMAGE_SCALE * power * toughness * fatigue * momentum;
}

function startMove(state: MatchState, f: Fighter, move: MoveDef) {
  const target = state.fighters[f.isPlayer ? 1 : 0];
  f.move = move;
  f.moveId = ++state.moveSerial;
  f.moveHit = false;
  f.stamina = clamp(f.stamina - move.stamina);
  setState(f, "attack", move.startup + move.active + move.recovery, move.kind);
  if (dist(f, target) < 3.5) f.facing = angleTo(f, target);
  if (move.reversalWindow > 0) state.events.push({ type: "reversal-window", target: target.id, open: true });
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
  state.events.push({ type: "reversal", by: defender.id, move: move.name, x: defender.x, z: defender.z });
  state.events.push({ type: "reversal-window", target: defender.id, open: false });
  state.crowdHeat = clamp(state.crowdHeat + 0.08, 0, 1);
}

function tryHit(state: MatchState, att: Fighter, def: Fighter) {
  const move = att.move!;
  att.moveHit = true;
  state.events.push({ type: "reversal-window", target: def.id, open: false });
  const d = dist(att, def);
  const grounded = def.state === "down" || def.state === "getup";
  const validTarget = move.kind === "ground" ? grounded : isUp(def) || def.state === "grappled";
  if (!validTarget || d > move.range || facingDiff(att, def) > 1.1 || def.invulnerable > 0) {
    state.events.push({ type: "whiff", by: att.id, move: move.name });
    att.momentum = clamp(att.momentum - 2);
    return;
  }
  if (move.kind === "grapple") {
    setState(att, "lockup", 1.4, "lockup");
    setState(def, "grappled", 1.4, "lockup");
    att.move = null;
    def.x = att.x + Math.sin(att.facing) * 0.7;
    def.z = att.z + Math.cos(att.facing) * 0.7;
    def.facing = att.facing + Math.PI;
    return;
  }
  const dmg = damageFor(att, def, move);
  def.health = clamp(def.health - dmg);
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
  state.events.push({ type: "hit", by: att.id, target: def.id, move: move.name, damage: Math.round(dmg), x: def.x, z: def.z, big });
  state.crowdHeat = clamp(state.crowdHeat + (big ? 0.2 : move.knockdown ? 0.06 : 0.02), 0, 1);

  if (move.kind === "finisher" && move.submission) {
    setState(att, "submitting", 4, "submission");
    setState(def, "submitted", 4, "submitted");
    state.pin = { attacker: att.isPlayer ? 0 : 1, defender: def.isPlayer ? 0 : 1, mash: 0, kind: "submission" };
    state.referee.counting = false;
    state.events.push({ type: "message", text: `${att.name} locks in the ${move.name}!`, tone: "gold" });
    return;
  }
  if (move.knockdown || (move.kind === "heavy" && (def.health < 35 || def.stamina < 15))) {
    const downFor = 1.2 + (100 - def.health) * 0.022 + (big ? 1.2 : 0) + (def.attrs.recovery < 60 ? 0.4 : 0);
    setState(def, "down", downFor, "fall");
  } else if (move.stun > 0 && def.state !== "down") {
    setState(def, "stunned", move.stun, "hit");
  }
  if (def.state === "grappled") setState(def, "down", 1.5, "fall");
}

function kickoutChance(def: Fighter, count: number, afterFinisher: boolean) {
  // Higher health / durability / momentum → more likely to kick out. Count 1 almost always.
  const base = 0.35 + def.health / 110 + (def.attrs.durability - 70) / 250 + def.momentum / 600;
  const countPenalty = count === 1 ? 0.35 : 0;
  const finisherPenalty = afterFinisher ? 0.35 : 0;
  return clamp(base + countPenalty - finisherPenalty, 0.02, 0.98);
}

/** Mash presses a player needs before the three-count to kick out. */
export function kickoutTarget(def: Fighter, afterFinisher: boolean) {
  return Math.max(1, Math.round((1 - kickoutChance(def, 2, afterFinisher)) * 24));
}

function startPin(state: MatchState, att: Fighter, def: Fighter) {
  att.lastPinHealth = def.health;
  setState(att, "pinning", 3.6, "pin");
  setState(def, "pinned", 3.6, "pinned");
  att.x = def.x + 0.35;
  att.z = def.z;
  state.pin = { attacker: att.isPlayer ? 0 : 1, defender: def.isPlayer ? 0 : 1, mash: 0, kind: "pin" };
  state.referee.counting = true;
  state.referee.count = 0;
  state.referee.countTime = 0;
  state.ai.thinkTimer = 0;
}

function endPin(state: MatchState) {
  const pin = state.pin!;
  const att = state.fighters[pin.attacker];
  const def = state.fighters[pin.defender];
  state.pin = null;
  state.referee.counting = false;
  setState(att, "idle", 0, "idle");
  setState(def, "down", 0.8, "down");
}

function finish(state: MatchState, winner: Fighter | null, method: string) {
  state.over = true;
  state.winner = winner?.id ?? null;
  state.method = method;
  for (const f of state.fighters) {
    if (!winner) setState(f, "idle", 0, "idle");
    else if (f === winner) setState(f, "victory", 99, "victory");
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
    if (def.isPlayer && pin.mash >= kickoutTarget(def, afterFinisher)) {
      def.kickouts++;
      def.momentum = clamp(def.momentum + 10);
      if (state.referee.count >= 2) state.nearFalls++;
      state.crowdHeat = clamp(state.crowdHeat + (state.referee.count >= 2 ? 0.25 : 0.05), 0, 1);
      state.events.push({ type: "kickout", by: def.id, count: state.referee.count });
      endPin(state);
      return;
    }
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
      let kicks: boolean;
      if (def.isPlayer) kicks = false;
      else kicks = rng.chance(kickoutChance(def, count, afterFinisher));
      if (kicks && (count === 2 || rng.chance(0.25))) {
        def.kickouts++;
        def.momentum = clamp(def.momentum + 10);
        if (count === 2) state.nearFalls++;
        state.crowdHeat = clamp(state.crowdHeat + (count === 2 ? 0.25 : 0.05), 0, 1);
        state.events.push({ type: "kickout", by: def.id, count });
        endPin(state);
      }
    }
  } else {
    // Submission: 4 seconds. Escape chance grows with health; player escapes by mashing.
    const elapsed = att.stateTime;
    def.health = clamp(def.health - dt * 2.2);
    if (elapsed >= 3.6) {
      const escapeChance = def.isPlayer ? Math.min(0.95, pin.mash / (6 + (100 - def.health) * 0.25)) : kickoutChance(def, 2, true) * 0.9;
      if (def.isPlayer ? pin.mash >= 6 + (100 - def.health) * 0.25 : rng.chance(escapeChance)) {
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

function aiThink(state: MatchState, rng: Rng, me: Fighter, foe: Fighter): MatchInput {
  const input: MatchInput = { moveX: 0, moveZ: 0, run: false, pressed: {} };
  const d = dist(me, foe);
  const diff = state.ai.difficulty;
  const toward = () => {
    const ang = angleTo(me, foe);
    input.moveX = Math.sin(ang);
    input.moveZ = Math.cos(ang);
  };

  if (!canAct(me)) return input;
  const foeDown = foe.state === "down" || foe.state === "getup";

  if (foeDown) {
    if (d > 1.2) {
      toward();
      input.run = d > 3 && me.stamina > 40;
      return input;
    }
    const lastBig = ["finisher", "signature"].includes(me.recentMoves[me.recentMoves.length - 1]);
    const wantsPin = lastBig || (foe.health < me.lastPinHealth - 12 && (foe.health < 35 || (foe.health < 55 && rng.chance(0.15))));
    if (wantsPin && rng.chance(0.7 * Math.min(1.2, diff))) input.pressed.pin = true;
    else if (rng.chance(0.4)) input.pressed.light = true; // stomp
    else {
      // back off and wait for them to stand up to hit a big move
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
    toward();
    input.run = d > 2.6 && me.stamina > 45 && rng.chance(0.5);
    // Running attack when closing distance fast
    if (input.run && d < 2.4) input.pressed.light = true;
    return input;
  }

  // In range: weighted choice
  const a = me.attrs;
  const foeStunned = foe.state === "stunned";
  const w: Record<string, number> = {
    light: 2.5 + (a.striking - 60) / 15,
    heavy: 1.6 + (a.striking - 60) / 20 + (foeStunned ? 2 : 0),
    grapple: 1.8 + (a.grappling - 60) / 15 + (a.strength - 60) / 30,
    dodge: foe.state === "attack" ? 2.5 * diff : 0.2,
    wait: me.stamina < 35 ? 2 : 0.6,
    signature: me.signatures > 0 ? (foeStunned || foe.health < 70 ? 4 : 1.5) : 0,
    finisher: me.finishers > 0 ? (foe.health < 55 || foeStunned ? 6 : 1.2) : 0,
  };
  // Variety: penalise repeating recent moves.
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
    // circle the opponent
    const ang = angleTo(me, foe) + Math.PI / 2;
    input.moveX = Math.sin(ang) * 0.5;
    input.moveZ = Math.cos(ang) * 0.5;
  } else (input.pressed as Record<string, boolean>)[choice] = true;
  return input;
}

function applyInput(state: MatchState, f: Fighter, foe: Fighter, input: MatchInput, dt: number) {
  const moves = movesCache.get(f.id)!;
  const d = dist(f, foe);
  // Reversal attempt (only meaningful while the opponent is in a move startup).
  if (input.pressed.reverse) {
    if (f.reversalLockout <= 0) {
      const att = foe;
      const inWindow =
        att.state === "attack" && att.move && !att.moveHit && att.move.reversalWindow > 0 && att.stateTime >= att.move.startup - att.move.reversalWindow && d < att.move.range + 0.4;
      const inLockup = f.state === "grappled" && foe.state === "lockup" && foe.stateTime > 0.15 && foe.stateTime < 0.7;
      if ((inWindow || inLockup) && (isUp(f) || f.state === "grappled")) {
        if (inLockup) {
          foe.move = moves["grapple-quick"];
        }
        triggerReversal(state, f, foe);
        return;
      }
      f.reversalLockout = 0.6; // mistimed
    }
  }

  // Lock-up follow-ups
  if (f.state === "lockup") {
    const m = movesCache.get(f.id)!;
    let follow: MoveDef | null = null;
    if (input.pressed.light) follow = m["grapple-quick"];
    else if (input.pressed.heavy) follow = m["grapple-power"];
    else if (input.pressed.grapple) follow = m["grapple-quick"];
    else if (input.pressed.signature && f.signatures > 0) follow = m.signature;
    else if (input.pressed.finisher && f.finishers > 0) follow = m.finisher;
    if (follow) {
      if (follow.kind === "signature") f.signatures = 0;
      if (follow.kind === "finisher") f.finishers -= 1;
      if (f.stamina < follow.stamina / 2) follow = m["grapple-quick"];
      startMove(state, f, follow);
      foe.stateDuration = Math.max(foe.stateDuration, foe.stateTime + follow.startup + follow.active + 0.05);
    }
    return;
  }

  if (!canAct(f)) return;

  // Movement
  const mag = Math.hypot(input.moveX, input.moveZ);
  const running = input.run && f.stamina > 5 && mag > 0.1;
  if (mag > 0.1) {
    const sp = speedOf(f, running) * dt;
    f.x += (input.moveX / mag) * sp;
    f.z += (input.moveZ / mag) * sp;
    if (d < 3 && !running) f.facing = angleTo(f, foe);
    else f.facing = Math.atan2(input.moveX, input.moveZ);
    if (f.state !== (running ? "run" : "walk")) setState(f, running ? "run" : "walk", 0, running ? "run" : "walk");
    if (running) f.stamina = clamp(f.stamina - dt * 7);
  } else if (f.state !== "idle") setState(f, "idle", 0, "idle");

  const foeDown = foe.state === "down" || foe.state === "getup";
  if (input.pressed.pin && foeDown && d < 1.5) {
    startPin(state, f, foe);
    return;
  }
  if (input.pressed.dodge && f.stamina >= 5) {
    f.stamina = clamp(f.stamina - 5);
    f.invulnerable = 0.35;
    setState(f, "dodge", 0.4, "dodge");
    const ang = mag > 0.1 ? Math.atan2(input.moveX, input.moveZ) : angleTo(f, foe) + Math.PI;
    f.x += Math.sin(ang) * 0.9;
    f.z += Math.cos(ang) * 0.9;
    return;
  }
  if (input.pressed.finisher && f.finishers > 0 && !foeDown) {
    f.finishers -= 1;
    startMove(state, f, moves.finisher);
    return;
  }
  if (input.pressed.signature && f.signatures > 0 && !foeDown) {
    f.signatures = 0;
    startMove(state, f, moves.signature);
    return;
  }
  if (input.pressed.grapple && !foeDown) return startMove(state, f, moves.grapple);
  if (input.pressed.heavy) return startMove(state, f, foeDown ? moves.ground : moves.heavy);
  if (input.pressed.light) return startMove(state, f, foeDown ? moves.ground : f.state === "run" ? moves.running : moves.light);
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
  const [p, o] = state.fighters;

  for (const f of state.fighters) {
    f.stateTime += dt;
    f.animTime += dt;
    f.reversalLockout = Math.max(0, f.reversalLockout - dt);
    f.invulnerable = Math.max(0, f.invulnerable - dt);
    // Stamina regeneration while not exerting
    if (f.state === "idle" || f.state === "walk" || f.state === "down") f.stamina = clamp(f.stamina + dt * (5 + f.attrs.stamina * 0.06 + f.attrs.recovery * 0.03));
    if (f.state === "down") f.health = clamp(f.health + dt * 0.4);
  }

  if (state.pin) {
    updatePinOrSubmission(state, rng, dt, playerInput);
    if (state.over) return state;
  }

  // Resolve timed states
  for (const f of state.fighters) {
    const foe = f === p ? o : p;
    if (f.state === "attack" && f.move) {
      if (!f.moveHit && f.stateTime >= f.move.startup) tryHit(state, f, foe);
      if (f.stateTime >= f.stateDuration) {
        f.move = null;
        setState(f, "idle");
      }
    } else if (f.state === "attack" && f.stateTime >= f.stateDuration) setState(f, "idle");
    else if (f.state === "lockup" && f.stateTime >= f.stateDuration) {
      // Nobody chose a follow-up: break the tie-up.
      setState(f, "idle");
      if (foe.state === "grappled") setState(foe, "stunned", 0.2, "stagger");
      state.events.push({ type: "message", text: "Break!" });
    } else if (f.state === "grappled" && f.stateTime >= f.stateDuration) setState(f, "idle");
    else if ((f.state === "stunned" || f.state === "dodge") && f.stateTime >= f.stateDuration) setState(f, "idle");
    else if (f.state === "down" && f.stateTime >= f.stateDuration) setState(f, "getup", 0.7, "getup");
    else if (f.state === "getup" && f.stateTime >= f.stateDuration) {
      setState(f, "idle");
      f.invulnerable = 0.3;
    }
  }

  // AI
  state.ai.thinkTimer -= dt;
  let aiInput: MatchInput = { moveX: 0, moveZ: 0, run: false, pressed: {} };
  // Reversal reaction: rolled once per incoming move, when its window opens.
  if (p.state === "attack" && p.move && !p.moveHit && p.move.reversalWindow > 0 && state.ai.reversalRolledFor !== p.moveId) {
    if (p.stateTime >= p.move.startup - p.move.reversalWindow) {
      state.ai.reversalRolledFor = p.moveId;
      const chance = clamp((0.1 + (o.attrs.reversal - 55) / 160) * state.ai.difficulty * (p.move.kind === "finisher" ? 0.6 : 1) * (o.stamina < 15 ? 0.5 : 1), 0.02, 0.6);
      if (dist(p, o) < p.move.range + 0.4 && (isUp(o) || o.state === "grappled") && rng.chance(chance)) aiInput.pressed.reverse = true;
    }
  }
  if (o.state === "lockup") {
    if (o.stateTime > 0.35) {
      const pick = rng.next();
      if (o.finishers > 0 && p.health < 60) aiInput.pressed.finisher = true;
      else if (o.signatures > 0 && pick < 0.4) aiInput.pressed.signature = true;
      else if (pick < 0.55 + (o.attrs.strength - 70) / 100) aiInput.pressed.heavy = true;
      else aiInput.pressed.light = true;
    }
  } else if (state.ai.thinkTimer <= 0 && !aiInput.pressed.reverse) {
    const reaction = 0.32 / state.ai.difficulty;
    state.ai.thinkTimer = rng.range(reaction * 0.6, reaction * 1.4);
    const thought = aiThink(state, rng, o, p);
    aiInput = thought;
    state.ai.intent = Object.keys(thought.pressed)[0] ?? (Math.hypot(thought.moveX, thought.moveZ) > 0 ? "move" : "wait");
    state.ai.lastMove = { ...thought, pressed: {} };
  } else if (state.ai.lastMove && canAct(o)) {
    aiInput = { ...state.ai.lastMove, pressed: aiInput.pressed };
  }

  applyInput(state, p, o, playerInput, dt);
  applyInput(state, o, p, aiInput, dt);

  // Constrain to the ring and keep fighters apart.
  for (const f of state.fighters) {
    f.x = clamp(f.x, -RING_LIMIT, RING_LIMIT);
    f.z = clamp(f.z, -RING_LIMIT, RING_LIMIT);
  }
  if (!state.pin && p.state !== "lockup" && o.state !== "lockup" && p.state !== "grappled" && o.state !== "grappled") {
    const d = dist(p, o);
    if (d < MIN_SEPARATION && d > 0.0001) {
      const push = (MIN_SEPARATION - d) / 2;
      const nx = (p.x - o.x) / d;
      const nz = (p.z - o.z) / d;
      p.x += nx * push;
      p.z += nz * push;
      o.x -= nx * push;
      o.z -= nz * push;
    }
  }

  // Referee drifts to a good viewing spot.
  const mx = (p.x + o.x) / 2;
  const mz = (p.z + o.z) / 2;
  const target = state.pin ? { x: state.fighters[state.pin.defender].x - 0.2, z: state.fighters[state.pin.defender].z + 0.9 } : { x: clamp(mx + 1.6, -2.7, 2.7), z: clamp(mz + 1.6, -2.7, 2.7) };
  state.referee.x += (target.x - state.referee.x) * Math.min(1, dt * 2);
  state.referee.z += (target.z - state.referee.z) * Math.min(1, dt * 2);

  state.crowdHeat = clamp(state.crowdHeat - dt * 0.015, 0.2, 1);
  if (state.time >= state.timeLimit && !state.over) finish(state, null, "Time-limit draw");
  return state;
}

/** 0–100 quality for recording the played match into the universe. */
export function playedMatchQuality(state: MatchState) {
  const [a, b] = state.fighters;
  const variety = a.uniqueMoves.size + b.uniqueMoves.size;
  const reversals = a.reversals + b.reversals;
  const minutes = state.time / 60;
  const close = 100 - Math.abs(a.health - b.health);
  const q = 42 + Math.min(16, variety * 2) + Math.min(12, reversals * 2) + Math.min(16, state.nearFalls * 5) + Math.min(8, minutes * 2) + close * 0.06;
  return Math.round(clamp(q, 25, 97));
}
