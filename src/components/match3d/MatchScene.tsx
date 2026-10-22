"use client";
/**
 * 3D presentation of a live match. The match itself is simulated by
 * `engine/live-match.ts` in the page's game loop; this scene only reads that
 * state every frame (wrestlers, referee, camera, sparks, crowd heat).
 */
import { useFrame, useThree } from "@react-three/fiber";
import { type MutableRefObject, useEffect, useMemo, useRef } from "react";
import * as THREE from "three";
import { type MatchState, playerOf } from "@/engine/live-match";
import type { Appearance, Wrestler } from "@/engine/types";
import * as sfx from "@/lib/sfx";
import { ArenaLights, ArenaShell, RING, Ring } from "./ArenaScene";
import { type Theme, themeFor } from "./branding";
import { loadRapier, type Ragdoll, RagdollWorld } from "./human/ragdoll";
import { type RigDriver, WrestlerModel } from "./WrestlerModel";

export interface MatchFx {
  shake: number;
  sparks: { x: number; z: number; y: number; big: boolean; color: string }[];
  phase: "intro" | "live" | "over";
  phaseTime: number;
  /** Hit-flash intensity per fighter, decays in the scene. */
  flash: number[];
  /** Pending body-slam impact on the canvas (0..1); the scene turns it into ring bounce. */
  mat: number;
  /** Direction each fighter was last hit from (unit XZ), and whether it was a big move. */
  hitDir: { x: number; z: number }[];
  big: boolean[];
}

/** Vertical give of the ring after a slam: a damped spring the mat and wrestlers ride on. */
type Bounce = { y: number; v: number };

const REFEREE: Pick<Wrestler, "appearance" | "division" | "heightIn"> = {
  division: "men",
  heightIn: 70,
  appearance: {
    skinTone: "#d7a07a",
    hairColor: "#2b2522",
    hairStyle: "short",
    facialHair: "none",
    primaryColor: "#1f232b",
    secondaryColor: "#e5e7eb",
    outfit: "bodysuit",
    bulk: 0.25,
    mask: false,
    muscle: 0.25,
    definition: 0.2,
    bodyFat: 0.25,
    shoulderWidth: 0.4,
    armSize: 0.4,
    legSize: 0.4,
    bootColor: "#0b0b0d",
    kneepads: false,
    wristTape: false,
  } satisfies Appearance,
};

const LIFT_MOVES = new Set(["grapple-quick", "grapple-power", "signature", "finisher"]);
const GRAB_MOVES = new Set(["grapple", "grapple-quick", "grapple-power", "signature", "finisher"]);

interface Physics {
  world: RagdollWorld | null;
  dolls: (Ragdoll | null)[];
  prevAnim: string[];
  ikW: number[];
  ikT: ({ L: THREE.Vector3; R: THREE.Vector3 } | null)[];
}

function Fighters({ wrestlers, state, fx, bounce }: { wrestlers: Wrestler[]; state: MutableRefObject<MatchState>; fx: MutableRefObject<MatchFx>; bounce: MutableRefObject<Bounce> }) {
  const n = wrestlers.length;
  const drivers = useMemo(
    () => state.current.fighters.map((f) => ({ current: { x: f.x, z: f.z, y: f.y, facing: f.facing, anim: "idle", animTime: 0 } as RigDriver })),
    // one set of drivers per match
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [n],
  );
  const ref = useRef<RigDriver>({ x: 0, z: -1.8, y: RING.matY, facing: 0, anim: "ref-watch", animTime: 0 });
  const lastRef = useRef({ x: 0, z: -1.8 });
  const physics = useRef<Physics>({ world: null, dolls: Array(n).fill(null), prevAnim: Array(n).fill("idle"), ikW: Array(n).fill(0), ikT: Array(n).fill(null) });

  useEffect(() => {
    let live = true;
    const P = physics.current;
    loadRapier().then(
      (R) => {
        if (live) P.world = new RagdollWorld(R, RING.matY);
      },
      (e) => console.warn("physics unavailable", e),
    );
    return () => {
      live = false;
      P.dolls.forEach((d) => d?.dispose());
      P.dolls = P.dolls.map(() => null);
      P.world?.dispose();
      P.world = null;
    };
  }, []);

  useFrame((_, dt) => {
    const s = state.current;
    s.fighters.forEach((f, i) => {
      const other = f.partner >= 0 ? s.fighters[f.partner] : null;
      const d = drivers[i].current;
      d.x = f.x;
      d.z = f.z;
      // the ring bounces under people standing on it
      d.y = f.y + (f.zone === "ring" && f.state !== "transition" ? bounce.current.y : 0);
      d.facing = f.facing;
      d.sweat = Math.min(1, s.time / 150);
      // A grappled defender is carried through the attacker's lift.
      if (f.state === "grappled" && other && other.state === "attack" && other.move && LIFT_MOVES.has(other.move.kind)) {
        d.anim = "lifted";
        d.animTime = other.stateTime;
        d.facing = other.facing + Math.PI;
      } else if (s.over && f.state === "victory") {
        d.anim = f.animTime > 2.6 ? "flex" : "victory";
        d.animTime = f.animTime;
      } else {
        d.anim = f.anim;
        d.animTime = f.animTime;
      }
      fx.current.flash[i] = Math.max(0, fx.current.flash[i] - dt * 4);
      d.flash = fx.current.flash[i];
      d.hitDir = fx.current.hitDir[i];
    });

    // ── Physics: ragdolls for knockdowns and slams, hand IK for grapples ──
    const P = physics.current;
    P.world?.step(dt);
    s.fighters.forEach((f, i) => {
      const d = drivers[i].current;
      const prev = P.prevAnim[i];
      if (P.world && d.anim === "fall" && prev !== "fall" && d.out && !P.dolls[i]) {
        const slam = prev === "lifted";
        const hd = fx.current.hitDir[i];
        const sp = slam ? 1 : fx.current.big[i] ? 3.2 : 2.2;
        const push = new THREE.Vector3(hd.x * sp, slam ? -3.5 : 0.6, hd.z * sp);
        P.dolls[i] = P.world.spawn(d.out.rig, d.out.group, push, slam ? 2 : 1.2);
      }
      const doll = P.dolls[i];
      if (doll && ((d.anim !== "fall" && d.anim !== "down") || doll.age > 1.8)) {
        doll.dispose();
        P.dolls[i] = null;
      }
      P.prevAnim[i] = d.anim;
      d.control ??= {};
      d.control.drive = (_rig, _group, ddt) => {
        const rd = P.dolls[i];
        if (!rd) return false;
        rd.apply(ddt);
        return true;
      };

      // hands on the opponent: the partner in a tie-up, otherwise the current target
      const oi = f.partner >= 0 ? f.partner : f.target;
      const other = oi >= 0 ? s.fighters[oi] : null;
      const me = d.out;
      const them = oi >= 0 ? drivers[oi].current.out : undefined;
      let want = 0;
      if (me && them && other) {
        const left = new THREE.Vector3(Math.cos(f.facing), 0, -Math.sin(f.facing));
        const at = (bone: string) => them.rig.by(bone).getWorldPosition(new THREE.Vector3());
        if (f.state === "lockup" || (f.state === "grappled" && other.state === "lockup")) {
          // collar-and-elbow: one hand behind the neck, the other on the arm
          P.ikT[i] = { L: at("spine004").addScaledVector(left, 0.06), R: at("upper_armL") };
          want = 1;
        } else if (f.state === "attack" && f.move && GRAB_MOVES.has(f.move.kind) && other.state === "grappled" && !f.moveHit) {
          const c = at("spine003");
          P.ikT[i] = { L: c.clone().addScaledVector(left, 0.17), R: c.clone().addScaledVector(left, -0.17) };
          want = 1;
        } else if (f.anim === "pin" || f.anim === "submission") {
          const c = at(f.anim === "pin" ? "spine003" : "spine004");
          P.ikT[i] = { L: c.clone().addScaledVector(left, 0.12), R: c.clone().addScaledVector(left, -0.12) };
          want = 1;
        }
      }
      P.ikW[i] += (want - P.ikW[i]) * Math.min(1, dt * 10);
      const tgt = P.ikT[i];
      d.control.ik = tgt && P.ikW[i] > 0.01 ? { L: tgt.L, R: tgt.R, weight: P.ikW[i] } : undefined;
    });
    // Referee
    const r = ref.current;
    const speed = Math.hypot(s.referee.x - lastRef.current.x, s.referee.z - lastRef.current.z) / Math.max(dt, 1e-3);
    lastRef.current = { x: s.referee.x, z: s.referee.z };
    r.x = s.referee.x;
    r.z = s.referee.z;
    r.y = RING.matY + bounce.current.y;
    if (s.pin && s.pin.kind === "pin") {
      const victim = s.fighters[s.pin.defender];
      r.facing = Math.atan2(victim.x - r.x, victim.z - r.z);
      r.anim = "ref-count";
      r.animTime = s.referee.countTime;
    } else {
      const p = playerOf(s);
      const q = p.target >= 0 ? s.fighters[p.target] : s.fighters.find((x) => x !== p) ?? p;
      const out = s.referee.outCount > 0 ? s.fighters.find((x) => x.zone === "floor") : null;
      const mx = out ? out.x : (p.x + q.x) / 2;
      const mz = out ? out.z : (p.z + q.z) / 2;
      r.facing = Math.atan2(mx - r.x, mz - r.z);
      if (speed > 0.4) {
        r.anim = "walk";
        r.animTime += dt;
      } else {
        if (r.anim !== "ref-watch") r.animTime = 0;
        r.anim = "ref-watch";
        r.animTime += dt;
      }
    }
  });

  return (
    <>
      {wrestlers.map((w, i) => (
        <WrestlerModel key={w.id} wrestler={w} driver={drivers[i]} />
      ))}
      <WrestlerModel wrestler={REFEREE} driver={ref} castShadow={false} />
    </>
  );
}

const MAX_SPARKS = 90;
function Sparks({ fx }: { fx: MutableRefObject<MatchFx> }) {
  const mesh = useRef<THREE.InstancedMesh>(null);
  const particles = useMemo(() => Array.from({ length: MAX_SPARKS }, () => ({ alive: 0, x: 0, y: 0, z: 0, vx: 0, vy: 0, vz: 0, s: 1 })), []);
  const dummy = useMemo(() => new THREE.Object3D(), []);
  const color = useMemo(() => new THREE.Color(), []);
  useFrame((_, dt) => {
    const m = mesh.current;
    if (!m) return;
    // spawn from queued sparks
    for (const sp of fx.current.sparks.splice(0)) {
      const n = sp.big ? 26 : 10;
      for (let k = 0; k < n; k++) {
        const p = particles.find((q) => q.alive <= 0);
        if (!p) break;
        p.alive = 0.35 + Math.random() * 0.25;
        p.x = sp.x;
        p.y = sp.y;
        p.z = sp.z;
        const a = Math.random() * Math.PI * 2;
        const v = (sp.big ? 4 : 2.4) * (0.4 + Math.random());
        p.vx = Math.cos(a) * v;
        p.vz = Math.sin(a) * v;
        p.vy = Math.random() * v * 0.9;
        p.s = sp.big ? 0.05 : 0.035;
      }
      color.set(sp.color);
    }
    particles.forEach((p, i) => {
      if (p.alive > 0) {
        p.alive -= dt;
        p.vy -= 9 * dt;
        p.x += p.vx * dt;
        p.y += p.vy * dt;
        p.z += p.vz * dt;
        dummy.position.set(p.x, p.y, p.z);
        dummy.scale.setScalar(Math.max(0, p.alive * 3) * p.s * 10);
      } else dummy.scale.setScalar(0);
      dummy.updateMatrix();
      m.setMatrixAt(i, dummy.matrix);
    });
    m.instanceMatrix.needsUpdate = true;
  });
  return (
    <instancedMesh ref={mesh} args={[undefined, undefined, MAX_SPARKS]}>
      <sphereGeometry args={[0.1, 6, 4]} />
      <meshBasicMaterial color="#ffd27a" toneMapped={false} />
    </instancedMesh>
  );
}

function CameraRig({ state, fx, reducedMotion }: { state: MutableRefObject<MatchState>; fx: MutableRefObject<MatchFx>; reducedMotion: boolean }) {
  const { camera } = useThree();
  const look = useRef(new THREE.Vector3(0, 2, 0));
  const pos = useRef(new THREE.Vector3(0, 6, 12));
  useFrame((_, dt) => {
    const s = state.current;
    const f = fx.current;
    const a = playerOf(s);
    const b = (a.target >= 0 && s.fighters[a.target]) || s.fighters.find((x) => x !== a) || a;
    const mx = (a.x + b.x) / 2;
    const mz = (a.z + b.z) / 2;
    const my = (a.y + b.y) / 2;
    const dist = Math.hypot(a.x - b.x, a.z - b.z);
    // pull back when the fight spills outside
    const outside = a.zone === "floor" || b.zone === "floor" ? 1.6 : 0;
    let target: THREE.Vector3;
    let lookAt: THREE.Vector3;
    if (f.phase === "intro") {
      // slow orbit from the entrance side round to the hard camera
      const k = Math.min(1, f.phaseTime / 4);
      const ang = -Math.PI * 0.85 + k * Math.PI * 0.85;
      target = new THREE.Vector3(Math.sin(ang) * 9, 3.6 - k * 0.4, Math.cos(ang) * 9);
      lookAt = new THREE.Vector3(0, 1.9, 0);
    } else if (f.phase === "over") {
      const w = s.fighters.find((x) => x.id === s.winner) ?? a;
      const ang = f.phaseTime * 0.25;
      target = new THREE.Vector3(w.x + Math.sin(ang) * 3.6, w.y + 1.7, w.z + Math.cos(ang) * 3.6 + 0.5);
      lookAt = new THREE.Vector3(w.x, w.y + 1.05, w.z);
    } else {
      // Hard-camera framing: stays on the +z side so the controls never flip.
      const zoom = 4.6 + dist * 0.9 + (s.pin ? -0.8 : 0) + outside;
      // High enough that the top rope sits below the wrestlers' chests.
      target = new THREE.Vector3(mx * 0.7, 2.05 + my + dist * 0.25 + outside * 0.4, mz + zoom);
      lookAt = new THREE.Vector3(mx * 0.9, my + 0.75, mz);
    }
    const k = 1 - Math.exp(-dt * (f.phase === "live" ? 3.5 : 1.8));
    pos.current.lerp(target, k);
    look.current.lerp(lookAt, k);
    camera.position.copy(pos.current);
    if (!reducedMotion && f.shake > 0) {
      camera.position.x += (Math.random() - 0.5) * f.shake * 0.25;
      camera.position.y += (Math.random() - 0.5) * f.shake * 0.25;
    }
    f.shake = Math.max(0, f.shake - dt * 3);
    camera.lookAt(look.current);
  });
  return null;
}


function BouncingRing({ state, fx, bounce, theme }: { state: MutableRefObject<MatchState>; fx: MutableRefObject<MatchFx>; bounce: MutableRefObject<Bounce>; theme: Theme }) {
  const group = useRef<THREE.Group>(null);
  const bodies = () => state.current.fighters.filter((f) => f.zone === "ring" && f.state !== "transition");
  useFrame((_, rawDt) => {
    const dt = Math.min(rawDt, 1 / 30);
    const b = bounce.current;
    if (fx.current.mat > 0) {
      b.v -= fx.current.mat * 0.8;
      fx.current.mat = 0;
    }
    b.v += (-b.y * 900 - b.v * 16) * dt;
    b.y += b.v * dt;
    if (group.current) group.current.position.y = b.y;
  });
  return (
    <group ref={group}>
      <Ring theme={theme} bodies={bodies} onRopeHit={(p) => sfx.rope(p)} />
    </group>
  );
}

export default function MatchScene({ wrestlers, state, fx, reducedMotion, lowGraphics = false }: { wrestlers: Wrestler[]; state: MutableRefObject<MatchState>; fx: MutableRefObject<MatchFx>; reducedMotion: boolean; lowGraphics?: boolean }) {
  const bounce = useRef<Bounce>({ y: 0, v: 0 });
  const theme = useMemo(() => themeFor(wrestlers.map((w) => w.brand)), [wrestlers]);
  return (
    <>
      <color attach="background" args={["#05060a"]} />
      <fog attach="fog" args={["#05060a", 18, 40]} />
      <ArenaLights shadows={!lowGraphics} />
      <ArenaShell theme={theme} heat={() => state.current.crowdHeat} crowdCount={lowGraphics ? 500 : 1400} />
      <BouncingRing state={state} fx={fx} bounce={bounce} theme={theme} />
      <Fighters wrestlers={wrestlers} state={state} fx={fx} bounce={bounce} />
      <Sparks fx={fx} />
      <CameraRig state={state} fx={fx} reducedMotion={reducedMotion} />
    </>
  );
}
