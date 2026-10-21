"use client";
/**
 * A wrestler: one skinned human mesh (CC0 base, smoothed and sculpted per
 * wrestler) on a full skeleton with fingers, painted with skin, ring gear and
 * tattoos, plus hair, beard and eyes.
 *
 * Joints follow their keyframe targets through damped springs rather than a
 * plain blend, which gives weight, follow-through and overshoot on landings.
 * On top of that sit secondary motion layers: recoil when hit, lean into
 * movement, breathing, finger curl, and optional overrides (grapple IK and
 * ragdoll) supplied by the match scene.
 */
import { useFrame } from "@react-three/fiber";
import { type MutableRefObject, useEffect, useMemo, useRef, useState } from "react";
import * as THREE from "three";
import { hashString } from "@/engine/rng";
import type { Appearance, Wrestler } from "@/engine/types";
import { type HumanBase, loadHumanBase } from "./human/base";
import { beardMask, buildShell, createEyeMaterial, createHairMaterial, hairMask, longHairGeometry, ponytailGeometry } from "./human/parts";
import { solveArmIK } from "./human/ik";
import { buildRig, type Rig } from "./human/rig";
import { sculptWrestler } from "./human/sculpt";
import { createSkinMaterial } from "./human/skin";
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
  /** Direction the last hit travelled (world XZ), for recoil and ragdoll. */
  hitDir?: { x: number; z: number };
  /** Filled by the model each frame so the scene can read bone positions (grapples, ragdoll). */
  out?: RigOutput;
  /** Set by the scene: extra per-bone rotations and full overrides (IK, ragdoll). */
  control?: RigControl;
}

export interface RigOutput {
  rig: Rig;
  group: THREE.Group;
}

export interface RigControl {
  overrides?: Map<number, THREE.Quaternion>;
  /** When set and returning true, the bones are driven entirely by this callback (ragdoll). */
  drive?: (rig: Rig, group: THREE.Group, dt: number) => boolean;
  /** World-space hand targets (grapples). */
  ik?: { L?: THREE.Vector3; R?: THREE.Vector3; weight: number };
}

type ModelSource = Pick<Wrestler, "appearance" | "division" | "heightIn"> & { id?: string };

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

const FIST: Record<string, number> = { idle: 0.85, walk: 0.7, run: 0.6, light: 1, heavy: 1, running: 0.9, ground: 0.9, counter: 1, stagger: 0.5, hit: 0.5, flex: 1, "lat-spread": 0.9, "most-muscular": 1, taunt: 0.4, victory: 0.9 };
/** Joints that must stay above the canvas, with the flesh radius around each. */
const GROUND: [string, number][] = [
  ["spine", 0.12],
  ["spine002", 0.12],
  ["spine003", 0.12],
  ["spine005", 0.1],
  ["shinL", 0.06],
  ["shinR", 0.06],
  ["footL", 0.05],
  ["footR", 0.05],
  ["forearmL", 0.05],
  ["forearmR", 0.05],
  ["handL", 0.035],
  ["handR", 0.035],
];
const gp = new THREE.Vector3();
const IRIS = ["#3b2a1d", "#2a1c12", "#4a3622", "#3d4f5f", "#4d5a3a", "#1f1611"];

function useHumanBase() {
  const [base, setBase] = useState<HumanBase | null>(null);
  useEffect(() => {
    let live = true;
    loadHumanBase().then(
      (b) => live && setBase(b),
      (e) => console.error("wrestler base mesh failed to load", e),
    );
    return () => {
      live = false;
    };
  }, []);
  return base;
}

/** Apply world-space rest offsets to bones (and therefore their subtrees). */
function shiftBones(base: HumanBase, shifts: Map<number, THREE.Vector3>): HumanBase {
  const worldQ: THREE.Quaternion[] = [];
  base.bones.forEach((b, i) => (worldQ[i] = b.parent >= 0 ? worldQ[b.parent].clone().multiply(b.quaternion) : b.quaternion.clone()));
  const bones = base.bones.map((b, i) => {
    const s = shifts.get(i);
    if (!s || b.parent < 0) return b;
    const local = s.clone().applyQuaternion(worldQ[b.parent].clone().invert());
    return { ...b, position: b.position.clone().add(local) };
  });
  return { ...base, bones };
}

export function build(base: HumanBase, w: ModelSource, castShadow: boolean) {
  const a = w.appearance as Appearance;
  const id = w.id ?? JSON.stringify(a);
  const seed = hashString(id);
  const sculpt = sculptWrestler(base, a, id);
  const rig = buildRig(shiftBones(base, sculpt.boneShift));
  const lm = sculpt.landmarks;
  const { material, uniforms } = createSkinMaterial(a, lm, seed);

  const body = new THREE.SkinnedMesh(sculpt.geometry, material);
  body.castShadow = castShadow;
  body.receiveShadow = true;
  body.frustumCulled = false;
  body.add(rig.root);
  body.updateMatrixWorld(true);
  rig.skeleton.calculateInverses();
  body.bind(rig.skeleton, new THREE.Matrix4());

  const group = new THREE.Group();
  group.add(body);
  const disposables: { dispose: () => void }[] = [sculpt.geometry, material];

  // scalp hair and beard shells
  const hairMat = createHairMaterial(a.hairColor);
  disposables.push(hairMat);
  const thickness = { bald: 0, buzz: 0, short: 0.009, long: 0.012, mohawk: 0.03, ponytail: 0.006 }[a.hairStyle];
  const r = new THREE.Vector3();
  const shells: THREE.BufferGeometry[] = [];
  if (!a.mask && thickness > 0) {
    const g = buildShell(sculpt.geometry, (p) => hairMask(a.hairStyle, r.copy(p), lm), thickness);
    if (g) shells.push(g);
  }
  if (!a.mask && (a.facialHair === "beard" || a.facialHair === "goatee")) {
    const g = buildShell(sculpt.geometry, (p) => beardMask(a.facialHair, r.copy(p), lm), a.facialHair === "beard" ? 0.0055 : 0.004, 0.3);
    if (g) shells.push(g);
  }
  for (const g of shells) {
    const shell = new THREE.SkinnedMesh(g, hairMat);
    shell.castShadow = castShadow;
    shell.frustumCulled = false;
    shell.bind(rig.skeleton, new THREE.Matrix4());
    group.add(shell);
    disposables.push(g);
  }

  // head attachments, positioned in the head bone's bind-pose frame
  const head = rig.by("spine005");
  const toHead = new THREE.Matrix4().copy(head.matrixWorld).invert();
  const attach = (obj: THREE.Object3D) => {
    obj.updateMatrix();
    obj.applyMatrix4(toHead);
    head.add(obj);
  };
  if (!a.mask && (a.hairStyle === "long" || a.hairStyle === "ponytail")) {
    const g = a.hairStyle === "long" ? longHairGeometry(lm, 0.26 + (seed % 7) * 0.012) : ponytailGeometry(lm);
    const m = new THREE.Mesh(g, hairMat);
    m.castShadow = castShadow;
    attach(m);
    disposables.push(g);
  }
  const eyeGeo = new THREE.SphereGeometry(0.0118, 20, 14);
  const lidGeo = new THREE.SphereGeometry(0.0127, 20, 8, 0, Math.PI * 2, 0, Math.PI * 0.36);
  const eyeMat = createEyeMaterial(IRIS[seed % IRIS.length]);
  const lidMat = new THREE.MeshStandardMaterial({ color: a.mask ? a.primaryColor : a.skinTone, roughness: 0.6 });
  disposables.push(eyeGeo, lidGeo, eyeMat, lidMat);
  for (const s of [1, -1]) {
    const eye = new THREE.Mesh(eyeGeo, eyeMat);
    eye.position.set(s * sculpt.eye.x, sculpt.eye.y, sculpt.eye.z - 0.0105);
    const lid = new THREE.Mesh(lidGeo, lidMat);
    lid.position.copy(eye.position);
    lid.rotation.set(0.15, 0, 0);
    attach(eye);
    attach(lid);
  }

  return {
    group,
    rig,
    uniforms,
    material,
    dispose: () => disposables.forEach((d) => d.dispose()),
  };
}

export function WrestlerModel({ wrestler, driver, castShadow = true }: { wrestler: ModelSource; driver: MutableRefObject<RigDriver>; castShadow?: boolean }) {
  const base = useHumanBase();
  const key = JSON.stringify(wrestler.appearance) + (wrestler.id ?? "");
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const model = useMemo(() => (base ? build(base, wrestler, castShadow) : null), [base, key, castShadow]);
  useEffect(() => () => model?.dispose(), [model]);
  const scale = wrestler.heightIn / 74;

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
    fistL: 0.8,
    fistR: 0.8,
    driven: false,
    /** Bone snapshot to blend out of after a ragdoll, and how far through the blend we are. */
    blend: null as null | { quats: THREE.Quaternion[]; root: THREE.Vector3; k: number },
  });

  useFrame((_, rawDt) => {
    if (!model) return;
    const dt = Math.min(rawDt, 1 / 20);
    if (dt <= 0) return;
    const d = driver.current;
    const st = sim.current;
    const g = model.group;
    d.out = { rig: model.rig, group: g };

    g.position.set(d.x, d.y ?? 1.2, d.z);
    let diff = d.facing - g.rotation.y;
    while (diff > Math.PI) diff -= Math.PI * 2;
    while (diff < -Math.PI) diff += Math.PI * 2;
    const step = diff * Math.min(1, dt * 14);
    st.turn += (step / dt - st.turn) * Math.min(1, dt * 6);
    g.rotation.y += step;
    g.scale.setScalar(scale);

    const fl = d.flash ?? 0;
    model.material.emissive.setRGB(fl * 0.22, fl * 0.2, fl * 0.18);
    model.uniforms.uSweat.value = d.sweat ?? 0;

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

    // ── Hit recoil: a fresh flash means we just got hit; snap away from the blow ──
    if (fl > st.lastFlash + 0.3) {
      const hx = d.hitDir?.x ?? -Math.sin(d.facing);
      const hz = d.hitDir?.z ?? -Math.cos(d.facing);
      const along = hx * Math.sin(d.facing) + hz * Math.cos(d.facing); // < 0: pushed backwards
      const across = hx * Math.cos(d.facing) - hz * Math.sin(d.facing);
      st.vel.spine -= 10 * fl * Math.max(0.3, -along + 0.6);
      st.vel.head -= 18 * fl;
      st.vel.rootTilt -= 2.5 * fl;
      st.vel.twist += 7 * fl * (across >= 0 ? 1 : -1);
      st.vel.rootRoll += 2 * fl * across;
      st.vel.lShoulderSide += 8 * fl;
      st.vel.rShoulderSide += 8 * fl;
      st.vel.rootY -= 0.8 * fl;
    }
    st.lastFlash = fl;

    // ── Breathing ──
    const effort = Math.min(1, Math.abs(st.speed) / 5 + fl);
    st.breath += dt * (1.7 + effort * 2.2);
    const b = Math.sin(st.breath) * (0.012 + effort * 0.012);
    target.spine -= b * 1.5;
    target.lShoulderSide += b;
    target.rShoulderSide += b;

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
    const fist = FIST[d.anim] ?? 0.25;
    st.fistL += (fist - st.fistL) * Math.min(1, dt * 12);
    st.fistR += (fist - st.fistR) * Math.min(1, dt * 12);

    // ragdoll (or another full override) owns the bones while it runs; springs keep going underneath
    const rig = model.rig;
    if (d.control?.drive && d.control.drive(rig, g, dt)) {
      st.driven = true;
      return;
    }
    if (st.driven) {
      st.driven = false;
      st.blend = { quats: rig.bones.map((bn) => bn.quaternion.clone()), root: rig.root.position.clone(), k: 0 };
    }
    rig.apply(st.pose, { fistL: st.fistL, fistR: st.fistR, plantFeet: grounded, overrides: d.control?.overrides });
    // ground contact: nothing sinks into the canvas; lying bodies settle onto it
    g.updateMatrixWorld(true);
    let need = -Infinity;
    for (const [name, radius] of GROUND) {
      g.worldToLocal(rig.by(name).getWorldPosition(gp));
      need = Math.max(need, radius - gp.y);
    }
    const lying = Math.abs(st.pose.rootTilt) > 1.1;
    if (need > 0 || lying) rig.root.position.y += need;
    if (st.blend) {
      st.blend.k = Math.min(1, st.blend.k + dt / 0.45);
      const k = st.blend.k * st.blend.k * (3 - 2 * st.blend.k);
      rig.bones.forEach((bn, i) => bn.quaternion.copy(st.blend!.quats[i].clone().slerp(bn.quaternion, k)));
      rig.root.position.copy(st.blend.root.clone().lerp(rig.root.position, k));
      if (st.blend.k >= 1) st.blend = null;
    }
    const ik = d.control?.ik;
    if (ik && ik.weight > 0) {
      g.updateMatrixWorld(true);
      if (ik.L) solveArmIK(rig, "L", ik.L, ik.weight);
      if (ik.R) solveArmIK(rig, "R", ik.R, ik.weight);
    }
  });

  return model ? <primitive object={model.group} /> : null;
}
