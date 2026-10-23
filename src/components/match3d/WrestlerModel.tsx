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
import { type HumanAssets, loadHumanAssets } from "./human/assets";
import type { HumanBase } from "./human/base";
import { browMask, buildFurGeometry, buildPartGeometry, createCardMaterial, createEyeMaterial, createFurMaterial, facialHairMask, type FurStyle, hairMask } from "./human/parts";
import { solveArmIK } from "./human/ik";
import { buildRig, type Rig } from "./human/rig";
import { sculptWrestler } from "./human/sculpt";
import { createSkinMaterial, gearTextTexture } from "./human/skin";
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

type ModelSource = Pick<Wrestler, "appearance" | "division" | "heightIn"> & { id?: string; age?: number };

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
/** Iris tints over the brown iris texture. */
const IRIS = ["#ffffff", "#e8ddd0", "#c9b8a6", "#b9c9d8", "#c3cfae", "#9a8a7a"];

function useHumanAssets() {
  const [assets, setAssets] = useState<HumanAssets | null>(null);
  useEffect(() => {
    let live = true;
    loadHumanAssets().then(
      (x) => live && setAssets(x),
      (e) => console.error("wrestler model assets failed to load", e),
    );
    return () => {
      live = false;
    };
  }, []);
  return assets;
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

export function build(assets: HumanAssets, w: ModelSource, castShadow: boolean) {
  const { base, tex, mean } = assets;
  const a = w.appearance as Appearance;
  const id = w.id ?? JSON.stringify(a);
  const seed = hashString(id);
  const sculpt = sculptWrestler(base, a, id, w.age);
  const rig = buildRig(shiftBones(base, sculpt.boneShift));
  const lm = sculpt.landmarks;
  // darker tones use the darker skin map (different lip and crease contrast)
  const tone = new THREE.Color(a.skinTone);
  const skinKey = tone.r * 0.3 + tone.g * 0.59 + tone.b * 0.11 < 0.22 ? "skin_dark" : "skin_light";
  const fallbackMean = new THREE.Vector3(0.5, 0.4, 0.35);
  const textMap = a.gearText ? gearTextTexture(a.gearText, a.accentColor ?? a.secondaryColor) : null;
  const { material, uniforms } = createSkinMaterial(a, lm, seed, tex[skinKey] ?? null, mean[`${skinKey}_body`] ?? fallbackMean, mean[`${skinKey}_head`] ?? fallbackMean, textMap);

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
  if (textMap) disposables.push(textMap);
  const skinned = (g: THREE.BufferGeometry, mat: THREE.Material, shadow = castShadow) => {
    const m = new THREE.SkinnedMesh(g, mat);
    m.castShadow = shadow;
    m.frustumCulled = false;
    m.bind(rig.skeleton, new THREE.Matrix4());
    group.add(m);
    disposables.push(g);
    return m;
  };
  const part = (name: string, mat: THREE.Material, shadow = castShadow) => {
    const p = base.parts[name];
    if (p) skinned(buildPartGeometry(p, base, sculpt.topoDisp), mat, shadow);
  };

  const r = new THREE.Vector3();
  const fur = (mask: (p: THREE.Vector3) => number, layers: number, style: FurStyle, color: string, shadow = false) => {
    const g = buildFurGeometry(sculpt.geometry, (p) => mask(r.copy(p)), layers);
    if (!g) return;
    const mat = createFurMaterial(color, style);
    disposables.push(mat);
    skinned(g, mat, shadow);
  };

  // eyes and lashes (fitted MakeHuman parts), brows as dense short fur
  const eyeMat = createEyeMaterial(tex.iris, IRIS[seed % IRIS.length]);
  disposables.push(eyeMat);
  part("eyes", eyeMat, false);
  const hairTone = new THREE.Color(a.hairColor);
  // brows and beards read a touch darker than the scalp hair
  const browColor = "#" + hairTone.clone().multiplyScalar(0.75).getHexString();
  if (!a.mask || a.maskStyle === "eyes" || a.maskStyle === "half") {
    const lashMat = createCardMaterial(tex.eyelashes, "#120d0a", mean.eyelashes, { sheen: 0 });
    disposables.push(lashMat);
    part("eyelashes", lashMat, false);
  }
  if (!a.mask) {
    const thick = 0.9 + ((seed >>> 4) % 5) * 0.12 + a.bulk * 0.2;
    fur((p) => browMask(p, lm, thick), 7, { length: 0.0045, density: 2100, cover: 0.9, thickness: 0.32, comb: [1, 0.25, 0.2], solidBase: true }, browColor);

    // facial hair
    if (a.facialHair === "beard") fur((p) => facialHairMask("beard", p, lm), 12, { length: 0.012, density: 1250, cover: 0.9, thickness: 0.42, comb: [0.35, -1, 0.35], solidBase: false }, browColor, castShadow);
    if (a.facialHair === "goatee") fur((p) => facialHairMask("goatee", p, lm), 10, { length: 0.009, density: 1300, cover: 0.9, thickness: 0.42, comb: [0.2, -1, 0.3], solidBase: false }, browColor);
    if (a.facialHair === "stubble") fur((p) => facialHairMask("stubble", p, lm), 3, { length: 0.0016, density: 2800, cover: 0.55, thickness: 0.3, comb: [0, -1, 0.4], solidBase: false }, browColor);

    // hair: MakeHuman hair cards for long and ponytail; fur for buzz, short and mohawk
    const card = { long: "hair_long", ponytail: "hair_ponytail" }[a.hairStyle as "long" | "ponytail"];
    if (card && tex[card]) {
      const hairMat = createCardMaterial(tex[card], a.hairColor, mean[card]);
      disposables.push(hairMat);
      part(card, hairMat);
    }
    if (a.hairStyle === "buzz") fur((p) => hairMask("short", p, lm), 4, { length: 0.0025, density: 2400, cover: 0.8, thickness: 0.32, comb: [0, -0.2, -1], solidBase: true }, a.hairColor);
    if (a.hairStyle === "short") fur((p) => hairMask("short", p, lm), 14, { length: 0.016, density: 1150, cover: 0.95, thickness: 0.4, comb: [0.25, -0.15, -1], solidBase: true }, a.hairColor, castShadow);
    if (a.hairStyle === "mohawk") fur((p) => hairMask("mohawk", p, lm), 16, { length: 0.05, density: 1000, cover: 0.95, thickness: 0.42, comb: [0, 0.6, -1], solidBase: true }, a.hairColor, castShadow);
    if (card) fur((p) => hairMask("short", p, lm), 6, { length: 0.006, density: 1300, cover: 0.95, thickness: 0.42, comb: [0.2, -0.3, -1], solidBase: true }, a.hairColor);
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
  const assets = useHumanAssets();
  const key = JSON.stringify(wrestler.appearance) + (wrestler.id ?? "") + (wrestler.age ?? "");
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const model = useMemo(() => (assets ? build(assets, wrestler, castShadow) : null), [assets, key, castShadow]);
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
