"use client";
/**
 * 3D presentation of a live match. The match itself is simulated by
 * `engine/live-match.ts` in the page's game loop; this scene only reads that
 * state every frame (wrestlers, referee, camera, sparks, crowd heat).
 */
import { useFrame, useThree } from "@react-three/fiber";
import { type MutableRefObject, useMemo, useRef } from "react";
import * as THREE from "three";
import type { MatchState } from "@/engine/live-match";
import type { Appearance, Wrestler } from "@/engine/types";
import { ArenaLights, ArenaShell, RING, Ring } from "./ArenaScene";
import { type RigDriver, WrestlerModel } from "./WrestlerModel";

export interface MatchFx {
  shake: number;
  sparks: { x: number; z: number; y: number; big: boolean; color: string }[];
  phase: "intro" | "live" | "over";
  phaseTime: number;
  /** Hit-flash intensity per fighter, decays in the scene. */
  flash: [number, number];
}

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

function Fighters({ wrestlers, state, fx }: { wrestlers: [Wrestler, Wrestler]; state: MutableRefObject<MatchState>; fx: MutableRefObject<MatchFx> }) {
  const drivers = [useRef<RigDriver>({ x: -1.6, z: 0, y: RING.matY, facing: Math.PI / 2, anim: "idle", animTime: 0 }), useRef<RigDriver>({ x: 1.6, z: 0, y: RING.matY, facing: -Math.PI / 2, anim: "idle", animTime: 0 })];
  const ref = useRef<RigDriver>({ x: 0, z: -1.8, y: RING.matY, facing: 0, anim: "ref-watch", animTime: 0 });
  const lastRef = useRef({ x: 0, z: -1.8 });

  useFrame((_, dt) => {
    const s = state.current;
    s.fighters.forEach((f, i) => {
      const other = s.fighters[1 - i];
      const d = drivers[i].current;
      d.x = f.x;
      d.z = f.z;
      d.y = RING.matY;
      d.facing = f.facing;
      // A grappled defender is carried through the attacker's lift.
      if (f.state === "grappled" && other.state === "attack" && other.move && LIFT_MOVES.has(other.move.kind)) {
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
    });
    // Referee
    const r = ref.current;
    const speed = Math.hypot(s.referee.x - lastRef.current.x, s.referee.z - lastRef.current.z) / Math.max(dt, 1e-3);
    lastRef.current = { x: s.referee.x, z: s.referee.z };
    r.x = s.referee.x;
    r.z = s.referee.z;
    if (s.pin && s.pin.kind === "pin") {
      const victim = s.fighters[s.pin.defender];
      r.facing = Math.atan2(victim.x - r.x, victim.z - r.z);
      r.anim = "ref-count";
      r.animTime = s.referee.countTime;
    } else {
      const mx = (s.fighters[0].x + s.fighters[1].x) / 2;
      const mz = (s.fighters[0].z + s.fighters[1].z) / 2;
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
      <WrestlerModel wrestler={wrestlers[0]} driver={drivers[0]} />
      <WrestlerModel wrestler={wrestlers[1]} driver={drivers[1]} />
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
    const [a, b] = s.fighters;
    const mx = (a.x + b.x) / 2;
    const mz = (a.z + b.z) / 2;
    const dist = Math.hypot(a.x - b.x, a.z - b.z);
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
      target = new THREE.Vector3(w.x + Math.sin(ang) * 3.6, 2.9, w.z + Math.cos(ang) * 3.6 + 0.5);
      lookAt = new THREE.Vector3(w.x, 2.25, w.z);
    } else {
      // Hard-camera framing: stays on the +z side so the controls never flip.
      const zoom = 4.6 + dist * 0.9 + (s.pin ? -0.8 : 0);
      // High enough that the top rope sits below the wrestlers' chests.
      target = new THREE.Vector3(mx * 0.7, 3.25 + dist * 0.25, mz + zoom);
      lookAt = new THREE.Vector3(mx * 0.9, 1.95, mz);
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


export default function MatchScene({ wrestlers, state, fx, reducedMotion, lowGraphics = false }: { wrestlers: [Wrestler, Wrestler]; state: MutableRefObject<MatchState>; fx: MutableRefObject<MatchFx>; reducedMotion: boolean; lowGraphics?: boolean }) {
  return (
    <>
      <color attach="background" args={["#05060a"]} />
      <fog attach="fog" args={["#05060a", 18, 40]} />
      <ArenaLights shadows={!lowGraphics} />
      <ArenaShell heat={() => state.current.crowdHeat} crowdCount={lowGraphics ? 500 : 1400} />
      <Ring />
      <Fighters wrestlers={wrestlers} state={state} fx={fx} />
      <Sparks fx={fx} />
      <CameraRig state={state} fx={fx} reducedMotion={reducedMotion} />
    </>
  );
}
