"use client";
/**
 * Original, procedurally sculpted wrestler. The body (muscles, fat, frame,
 * gear and face paint) comes from `buildBody`; this component rigs the parts
 * into a joint hierarchy and drives it with the keyframed pose library.
 *
 * Joints follow their keyframe targets through damped springs rather than a
 * plain blend, which gives weight, follow-through and overshoot on landings.
 * On top of that sit cheap secondary motion layers: recoil when hit, lean into
 * movement, and breathing.
 */
import { useFrame } from "@react-three/fiber";
import { type MutableRefObject, useEffect, useMemo, useRef } from "react";
import * as THREE from "three";
import { RoundedBoxGeometry } from "three/examples/jsm/geometries/RoundedBoxGeometry.js";
import type { Appearance, Division, Wrestler } from "@/engine/types";
import { buildBody, disposeBody } from "./body";
import { NEUTRAL, type Pose, poseFor } from "./poses";

export interface RigDriver {
  x: number;
  z: number;
  y?: number;
  facing: number;
  anim: string;
  animTime: number;
  flash?: number;
  /** 0..1 sweat sheen, rises over a match. */
  sweat?: number;
}

type ModelSource = Pick<Wrestler, "appearance" | "division" | "heightIn">;

const POSE_KEYS = Object.keys(NEUTRAL) as (keyof Pose)[];
const ROOT_KEYS = new Set<keyof Pose>(["rootY", "rootTilt", "rootRoll"]);
const CORE_KEYS = new Set<keyof Pose>(["spine", "twist", "head"]);
/** [stiffness, damping] per joint group. Limbs are snappy, the core lags a little and the root bounces. */
const SPRING: Record<"limb" | "core" | "root", [number, number]> = {
  limb: [900, 44],
  core: [420, 26],
  root: [520, 24],
};
const springFor = (k: keyof Pose) => SPRING[ROOT_KEYS.has(k) ? "root" : CORE_KEYS.has(k) ? "core" : "limb"];

export function WrestlerModel({ wrestler, driver, castShadow = true }: { wrestler: ModelSource; driver: MutableRefObject<RigDriver>; castShadow?: boolean }) {
  const a = wrestler.appearance;
  const key = JSON.stringify(a) + wrestler.division;
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const body = useMemo(() => buildBody(a as Appearance, wrestler.division as Division), [key]);
  useEffect(() => () => disposeBody(body), [body]);
  const dims = body.dims;
  const scale = wrestler.heightIn / 74;

  const parts = useMemo(() => {
    const hr = dims.handR;
    const fist = new RoundedBoxGeometry(hr * 2.05, hr * 2.25, hr * 1.8, 2, hr * 0.5);
    const thumb = new THREE.CapsuleGeometry(hr * 0.34, hr * 0.7, 3, 8);
    const foot = new RoundedBoxGeometry(0.108, 0.08, 0.255, 2, 0.032);
    const sole = new RoundedBoxGeometry(0.114, 0.02, 0.262, 1, 0.008);
    return { fist, thumb, foot, sole };
  }, [dims.handR]);
  useEffect(() => () => Object.values(parts).forEach((g) => g.dispose()), [parts]);

  const mats = useMemo(() => {
    const skinLike = { roughness: 0.52, clearcoat: 0.12, clearcoatRoughness: 0.35, sheen: 0.45, sheenRoughness: 0.5, sheenColor: new THREE.Color("#ff9070") };
    const flesh = new THREE.MeshPhysicalMaterial({ vertexColors: true, ...skinLike });
    const skin = new THREE.MeshPhysicalMaterial({ color: a.skinTone, ...skinLike });
    const hair = new THREE.MeshStandardMaterial({ color: a.hairColor, roughness: 0.75 });
    const hairShell = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.8 });
    const boot = new THREE.MeshPhysicalMaterial({ color: a.bootColor, roughness: 0.3, clearcoat: 0.6, clearcoatRoughness: 0.25 });
    const sole = new THREE.MeshStandardMaterial({ color: "#0a0a0c", roughness: 0.8 });
    const knee = new THREE.MeshStandardMaterial({ color: body.knee[0], roughness: 0.55 });
    const eyeWhite = new THREE.MeshStandardMaterial({ color: "#e2ddd6", roughness: 0.25 });
    const iris = new THREE.MeshStandardMaterial({ color: "#1b1410", roughness: 0.15 });
    const flash = new THREE.MeshBasicMaterial({ color: "#ffffff", transparent: true, opacity: 0, depthWrite: false });
    return { flesh, skin, hair, hairShell, boot, sole, knee, eyeWhite, iris, flash };
  }, [a.skinTone, a.hairColor, a.bootColor, body.knee]);
  useEffect(() => () => Object.values(mats).forEach((m) => m.dispose()), [mats]);

  const root = useRef<THREE.Group>(null);
  const bodyG = useRef<THREE.Group>(null);
  const spine = useRef<THREE.Group>(null);
  const chest = useRef<THREE.Mesh>(null);
  const head = useRef<THREE.Group>(null);
  const lSh = useRef<THREE.Group>(null);
  const rSh = useRef<THREE.Group>(null);
  const lEl = useRef<THREE.Group>(null);
  const rEl = useRef<THREE.Group>(null);
  const lHip = useRef<THREE.Group>(null);
  const rHip = useRef<THREE.Group>(null);
  const lKn = useRef<THREE.Group>(null);
  const rKn = useRef<THREE.Group>(null);
  const sim = useRef({
    pose: { ...NEUTRAL } as Pose,
    vel: Object.fromEntries(POSE_KEYS.map((k) => [k, 0])) as unknown as Pose,
    lastFlash: 0,
    lastX: driver.current.x,
    lastZ: driver.current.z,
    speed: 0,
    turn: 0,
    breath: driver.current.animTime * 2.3,
    started: false,
  });

  useFrame((_, rawDt) => {
    const dt = Math.min(rawDt, 1 / 20);
    if (dt <= 0) return;
    const d = driver.current;
    const st = sim.current;
    const target = poseFor(d.anim, d.animTime);

    // ── Secondary motion: lean into movement and turns ──
    const vx = (d.x - st.lastX) / dt;
    const vz = (d.z - st.lastZ) / dt;
    st.lastX = d.x;
    st.lastZ = d.z;
    const fwd = st.started ? vx * Math.sin(d.facing) + vz * Math.cos(d.facing) : 0;
    st.speed += (Math.max(-4, Math.min(8, fwd)) - st.speed) * Math.min(1, dt * 8);
    st.started = true;
    const grounded = target.rootTilt > -0.6 && target.rootTilt < 0.6;
    if (grounded) {
      target.spine += Math.max(-0.12, Math.min(0.28, st.speed * 0.045));
      target.rootRoll += Math.max(-0.12, Math.min(0.12, st.turn * 0.05));
    }

    // ── Hit recoil: a fresh flash means we just got hit ──
    const fl = d.flash ?? 0;
    if (fl > st.lastFlash + 0.3) {
      const side = Math.random() < 0.5 ? -1 : 1;
      st.vel.spine -= 10 * fl;
      st.vel.head -= 16 * fl;
      st.vel.rootTilt -= 2.5 * fl;
      st.vel.twist += side * 6 * fl;
      st.vel.lShoulderSide += 8 * fl;
      st.vel.rShoulderSide += 8 * fl;
      st.vel.rootY -= 0.8 * fl;
    }
    st.lastFlash = fl;

    // ── Integrate the joint springs (two semi-implicit substeps) ──
    const h = dt / 2;
    for (let pass = 0; pass < 2; pass++) {
      for (const k of POSE_KEYS) {
        const [stiff, damp] = springFor(k);
        const acc = (target[k] - st.pose[k]) * stiff - st.vel[k] * damp;
        st.vel[k] += acc * h;
        st.pose[k] += st.vel[k] * h;
      }
    }
    const p = st.pose;

    if (root.current) {
      root.current.position.set(d.x, d.y ?? 1.2, d.z);
      let diff = d.facing - root.current.rotation.y;
      while (diff > Math.PI) diff -= Math.PI * 2;
      while (diff < -Math.PI) diff += Math.PI * 2;
      const step = diff * Math.min(1, dt * 14);
      st.turn += (step / dt - st.turn) * Math.min(1, dt * 6);
      root.current.rotation.y += step;
    }
    if (bodyG.current) {
      bodyG.current.position.y = dims.hipY + p.rootY;
      bodyG.current.rotation.set(p.rootTilt, 0, p.rootRoll);
    }
    spine.current?.rotation.set(p.spine, p.twist, 0);
    head.current?.rotation.set(p.head, 0, 0);
    lSh.current?.rotation.set(-p.lShoulder, p.lArmTwist, p.lShoulderSide, "XZY");
    rSh.current?.rotation.set(-p.rShoulder, -p.rArmTwist, -p.rShoulderSide, "XZY");
    lEl.current?.rotation.set(-p.lElbow, 0, 0);
    rEl.current?.rotation.set(-p.rElbow, 0, 0);
    lHip.current?.rotation.set(-p.lHip, 0, 0.05);
    rHip.current?.rotation.set(-p.rHip, 0, -0.05);
    lKn.current?.rotation.set(p.lKnee, 0, 0);
    rKn.current?.rotation.set(p.rKnee, 0, 0);

    // ── Breathing: faster and deeper when moving or hurt ──
    const effort = Math.min(1, Math.abs(st.speed) / 5 + fl);
    st.breath += dt * (1.7 + effort * 2.2);
    const b = Math.sin(st.breath) * (0.012 + effort * 0.012);
    chest.current?.scale.set(1 + b, 1, 1 + b * 1.4);

    const sweat = d.sweat ?? 0;
    mats.flesh.clearcoat = mats.skin.clearcoat = 0.12 + sweat * 0.55;
    mats.flesh.roughness = mats.skin.roughness = 0.52 - sweat * 0.14;
    mats.flash.opacity = Math.max(0, fl * 0.55);
  });

  const hR = dims.headR;
  const hairMesh = (() => {
    if (a.mask) return null;
    const shell = body.hair ? <mesh geometry={body.hair} material={mats.hairShell} castShadow={castShadow} /> : null;
    switch (a.hairStyle) {
      case "ponytail":
        return (
          <group>
            {shell}
            <mesh position={[0, 0.13, -hR * 0.98]} material={mats.hair}>
              <sphereGeometry args={[0.024, 10, 8]} />
            </mesh>
            <mesh position={[0, 0.02, -hR * 1.12]} rotation={[0.3, 0, 0]} material={mats.hair} castShadow={castShadow}>
              <capsuleGeometry args={[0.028, 0.22, 4, 10]} />
            </mesh>
          </group>
        );
      case "long":
        return (
          <group>
            {shell}
            <mesh position={[0, -0.04, -hR * 0.62]} rotation={[0.1, 0, 0]} scale={[1.05, 1, 0.5]} material={mats.hair} castShadow={castShadow}>
              <capsuleGeometry args={[hR * 0.92, 0.24, 6, 16]} />
            </mesh>
          </group>
        );
      default:
        return shell;
    }
  })();

  const arm = (side: 1 | -1, shRef: typeof lSh, elRef: typeof lEl) => {
    const i = side === 1 ? 0 : 1;
    const hr = dims.handR;
    const handY = -dims.foreArm - hr * 1.05;
    return (
      <group ref={shRef} position={[side * dims.shoulderX, dims.shoulderY, 0]}>
        <mesh geometry={body.delt[i]} material={mats.flesh} castShadow={castShadow} />
        <mesh geometry={body.upperArm[i]} material={mats.flesh} castShadow={castShadow} />
        <group ref={elRef} position={[0, -dims.upperArm, 0]}>
          <mesh material={mats.skin}>
            <sphereGeometry args={[dims.armR * 0.84, 14, 10]} />
          </mesh>
          <mesh geometry={body.foreArm[i]} material={mats.flesh} castShadow={castShadow} />
          {/* closed fist with a thumb wrapped over the front */}
          <group position={[0, handY, 0.004]} rotation={[0.12, 0, 0]}>
            <mesh geometry={parts.fist} material={mats.skin} castShadow={castShadow} />
            <mesh geometry={parts.thumb} position={[-side * hr * 0.35, hr * 0.25, hr * 0.85]} rotation={[0.2, 0, side * 1.2]} material={mats.skin} />
          </group>
        </group>
      </group>
    );
  };

  const leg = (side: 1 | -1, hipRef: typeof lHip, kneeRef: typeof lKn) => {
    const i = side === 1 ? 0 : 1;
    return (
      <group ref={hipRef} position={[side * dims.hipX, -0.04, 0]}>
        <mesh geometry={body.thigh[i]} material={mats.flesh} castShadow={castShadow} />
        <group ref={kneeRef} position={[0, -dims.thigh, 0]}>
          <mesh material={mats.knee}>
            <sphereGeometry args={[dims.legR * 0.68, 14, 10]} />
          </mesh>
          <mesh geometry={body.shin[i]} material={mats.flesh} castShadow={castShadow} />
          <group position={[0, -dims.shin - 0.035, 0.045]}>
            <mesh geometry={parts.foot} material={mats.boot} castShadow={castShadow} />
            <mesh geometry={parts.sole} position={[0, -0.035, 0.002]} material={mats.sole} />
          </group>
        </group>
      </group>
    );
  };

  return (
    <group ref={root} scale={scale}>
      <group ref={bodyG}>
        <mesh geometry={body.pelvis} material={mats.flesh} castShadow={castShadow} />
        <group ref={spine}>
          <mesh ref={chest} geometry={body.torso} material={mats.flesh} castShadow={castShadow} receiveShadow />
          <mesh geometry={body.neck} material={mats.flesh} castShadow={castShadow} />
          <group ref={head} position={[0, dims.neckTop, -0.004]} scale={1.06}>
            <mesh geometry={body.head} material={mats.flesh} castShadow={castShadow} />
            {[1, -1].map((s) => (
              <group key={s} position={[s * 0.03, 0.112, 0.084]}>
                <mesh material={mats.eyeWhite} scale={[1, 0.8, 0.7]}>
                  <sphereGeometry args={[0.0105, 12, 8]} />
                </mesh>
                <mesh position={[0, 0, 0.0062]} scale={[1, 1, 0.5]} material={mats.iris}>
                  <sphereGeometry args={[0.0058, 10, 8]} />
                </mesh>
              </group>
            ))}
            {hairMesh}
          </group>
          {arm(1, lSh, lEl)}
          {arm(-1, rSh, rEl)}
        </group>
        {leg(1, lHip, lKn)}
        {leg(-1, rHip, rKn)}
        <mesh position={[0, 0.3, 0]} material={mats.flash}>
          <sphereGeometry args={[0.6, 12, 10]} />
        </mesh>
      </group>
    </group>
  );
}
