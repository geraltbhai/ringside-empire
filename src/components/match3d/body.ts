/**
 * Builds a wrestler's sculpted body from their appearance. Pure: same input,
 * same geometry. All lengths are metres for a 6'2" (74 in) wrestler; the model
 * is uniformly scaled by height afterwards.
 */
import * as THREE from "three";
import type { Appearance, Division } from "@/engine/types";
import { type Bump, curve, frontness, nearPhi, sculptTube, smoothstep } from "./anatomy";

export interface BodyDims {
  hipY: number;
  torsoTop: number;
  shoulderX: number;
  shoulderY: number;
  hipX: number;
  upperArm: number;
  foreArm: number;
  thigh: number;
  shin: number;
  neckTop: number;
  headR: number;
  headCenterY: number;
  handR: number;
  legR: number;
  armR: number;
}

export interface BodyGeometry {
  dims: BodyDims;
  pelvis: THREE.BufferGeometry;
  torso: THREE.BufferGeometry;
  neck: THREE.BufferGeometry;
  head: THREE.BufferGeometry;
  delt: [THREE.BufferGeometry, THREE.BufferGeometry];
  upperArm: [THREE.BufferGeometry, THREE.BufferGeometry];
  foreArm: [THREE.BufferGeometry, THREE.BufferGeometry];
  thigh: [THREE.BufferGeometry, THREE.BufferGeometry];
  shin: [THREE.BufferGeometry, THREE.BufferGeometry];
  knee: [THREE.Color, THREE.Color];
  /** Hair volume sculpted on the head shape (null for bald / buzz / masked). */
  hair: THREE.BufferGeometry | null;
}

const PI = Math.PI;
const lerp = (a: number, b: number, k: number) => a + (b - a) * k;

export function buildBody(a: Appearance, division: Division): BodyGeometry {
  const W = division === "women";
  const m = a.muscle;
  const d = a.definition;
  const f = a.bodyFat;
  const b = a.bulk;
  const sw = a.shoulderWidth;
  const armK = 0.8 + a.armSize * 0.4;
  const legK = 0.82 + a.legSize * 0.36;
  const cut = d * (1 - f * 0.85); // visible definition
  const cavity = 0.25 + cut * 0.9;

  const skin = new THREE.Color(a.skinTone);
  const prim = new THREE.Color(a.primaryColor);
  const sec = new THREE.Color(a.secondaryColor);
  const hair = new THREE.Color(a.hairColor);
  const boot = new THREE.Color(a.bootColor);
  const tape = new THREE.Color("#e7e5e4");
  const lips = skin.clone().lerp(new THREE.Color("#7a2e2e"), 0.35);
  const stubble = skin.clone().lerp(hair, 0.4);

  // ── Dimensions ───────────────────────────────────────────
  const waistW = 0.128 + f * 0.075 + b * 0.035 + m * 0.01 - (W ? 0.018 : 0);
  const waistD = 0.094 + f * 0.085 + b * 0.03 + m * 0.012 - (W ? 0.006 : 0);
  const chestW = 0.172 + m * 0.048 + sw * 0.05 + b * 0.03 + f * 0.02 - (W ? 0.03 : 0);
  const chestD = 0.108 + m * 0.036 + b * 0.02 + f * 0.03 - (W ? 0.012 : 0);
  const hipW = 0.162 + f * 0.05 + b * 0.035 + m * 0.016 + (W ? 0.022 : 0);
  const hipD = 0.104 + f * 0.04 + b * 0.02 + m * 0.012;
  const neckR = 0.056 + m * 0.032 + b * 0.014 - (W ? 0.008 : 0);
  const torsoTop = 0.56;
  const armR = (0.04 + m * 0.021 + b * 0.01 + f * 0.006) * armK - (W ? 0.004 : 0);
  const legR = (0.074 + m * 0.03 + b * 0.022 + f * 0.018) * legK;
  const deltR = 0.054 + m * 0.032 + sw * 0.012 + b * 0.01 - (W ? 0.008 : 0);
  const dims: BodyDims = {
    hipY: 0.95,
    torsoTop,
    shoulderX: chestW * 0.95 + deltR * 0.32,
    shoulderY: torsoTop - 0.07,
    hipX: hipW * 0.52,
    upperArm: 0.29,
    foreArm: 0.27,
    thigh: 0.45,
    shin: 0.43,
    neckTop: torsoTop + 0.08,
    headR: 0.1,
    headCenterY: 0.095,
    handR: 0.034 + m * 0.008 + b * 0.004 - (W ? 0.003 : 0),
    legR,
    armR,
  };

  // ── Outfit painting helpers ──────────────────────────────
  const fullLegs = a.outfit === "tights" || a.outfit === "pants" || a.outfit === "bodysuit";
  const torsoColor = (t: number, phi: number): THREE.Color => {
    if (a.outfit === "bodysuit") return t > 0.9 ? skin : t > 0.87 ? sec : prim;
    if (a.outfit === "singlet") {
      if (t < 0.6) return prim;
      const strap = nearPhi(phi, 0.62, 0.3) || nearPhi(phi, -0.62, 0.3) || nearPhi(phi, PI - 0.55, 0.3) || nearPhi(phi, PI + 0.55, 0.3);
      if (t < 0.66) return nearPhi(phi, PI / 2, 0.6) || nearPhi(phi, -PI / 2, 0.6) ? (t > 0.63 ? sec : prim) : prim;
      return strap && t < 0.97 ? prim : skin;
    }
    if (W) {
      // athletic top
      if (t > 0.57 && t < 0.8) return t < 0.6 ? sec : prim;
      if (t >= 0.8 && t < 0.95 && (nearPhi(phi, 0.55, 0.16) || nearPhi(phi, -0.55, 0.16) || nearPhi(phi, PI, 0.5))) return prim;
      return skin;
    }
    return skin;
  };

  // ── Pelvis ───────────────────────────────────────────────
  const pelvisRx = curve([
    [0, waistW * 1.04],
    [0.45, hipW],
    [0.8, hipW * 0.92],
    [1, hipW * 0.45],
  ]);
  const pelvisRz = curve([
    [0, waistD * 1.04 + f * 0.01],
    [0.45, hipD],
    [0.8, hipD * 0.85],
    [1, hipD * 0.45],
  ]);
  const pelvis = sculptTube({
    y0: 0.14,
    y1: -0.13,
    radius: (t) => [pelvisRx(t), pelvisRz(t)],
    bumps: [
      { t: 0.55, phi: PI - 0.45, st: 0.2, sp: 0.5, a: 0.01 + m * 0.018 + (W ? 0.01 : 0) },
      { t: 0.55, phi: PI + 0.45, st: 0.2, sp: 0.5, a: 0.01 + m * 0.018 + (W ? 0.01 : 0) },
      { t: 0.05, phi: 0, st: 0.15, sp: 1, a: f * 0.03 },
    ],
    color: (t) => (t < 0.12 ? sec : prim),
    radial: 32,
    rings: 14,
    capStart: true,
    capEnd: true,
    cavity: cavity * 0.6,
  });

  // ── Torso ────────────────────────────────────────────────
  const absA = (0.002 + d * 0.009 + m * 0.003) * (1 - f * 0.9);
  const torsoBumps: Bump[] = [
    // chest
    { t: 0.72, phi: 0.45, st: 0.08, stBelow: 0.032, sp: 0.38, a: W ? 0.006 + m * 0.01 : 0.01 + m * 0.04 },
    { t: 0.72, phi: -0.45, st: 0.08, stBelow: 0.032, sp: 0.38, a: W ? 0.006 + m * 0.01 : 0.01 + m * 0.04 },
    { t: 0.72, phi: 0, st: 0.12, sp: 0.07, a: -(0.003 + m * 0.012) },
    // abdomen: four rows of two
    ...[0.53, 0.42, 0.31, 0.2].flatMap((t, i) =>
      [0.19, -0.19].map((phi) => ({ t, phi, st: 0.038, sp: 0.12, a: absA * (i === 3 ? 0.6 : 1) })),
    ),
    { t: 0.37, phi: 0, st: 0.2, sp: 0.05, a: -d * 0.005 * (1 - f * 0.8) },
    // obliques & serratus
    { t: 0.25, phi: 1.0, st: 0.1, sp: 0.3, a: m * 0.006 + f * 0.01 },
    { t: 0.25, phi: -1.0, st: 0.1, sp: 0.3, a: m * 0.006 + f * 0.01 },
    ...[0.54, 0.6].flatMap((t) => [0.95, -0.95].map((phi) => ({ t, phi, st: 0.022, sp: 0.1, a: cut * m * 0.005 }))),
    // back: lats, upper back, spine groove, erectors
    { t: 0.6, phi: 1.85, st: 0.14, sp: 0.45, a: 0.004 + m * 0.022 },
    { t: 0.6, phi: -1.85, st: 0.14, sp: 0.45, a: 0.004 + m * 0.022 },
    { t: 0.75, phi: PI - 0.55, st: 0.1, sp: 0.35, a: m * 0.012 },
    { t: 0.75, phi: PI + 0.55, st: 0.1, sp: 0.35, a: m * 0.012 },
    { t: 0.5, phi: PI, st: 0.3, sp: 0.07, a: -(0.003 + m * 0.006) },
    { t: 0.25, phi: PI - 0.18, st: 0.12, sp: 0.12, a: m * 0.008 },
    { t: 0.25, phi: PI + 0.18, st: 0.12, sp: 0.12, a: m * 0.008 },
    // front delt / upper pec tie-in so the shoulder joins the chest
    { t: 0.86, phi: 1.15, st: 0.07, sp: 0.35, a: m * 0.018 },
    { t: 0.86, phi: -1.15, st: 0.07, sp: 0.35, a: m * 0.018 },
    // traps: slope from neck to shoulders
    { t: 0.93, phi: PI, st: 0.07, sp: 0.9, a: m * 0.03 },
    { t: 0.955, phi: 1.35, st: 0.05, sp: 0.45, a: m * 0.026 + b * 0.006 },
    { t: 0.955, phi: -1.35, st: 0.05, sp: 0.45, a: m * 0.026 + b * 0.006 },
    // softness
    { t: 0.3, phi: 0, st: 0.16, sp: 1.0, a: f * 0.07 },
    { t: 0.12, phi: 1.5, st: 0.08, sp: 0.4, a: f * 0.035 },
    { t: 0.12, phi: -1.5, st: 0.08, sp: 0.4, a: f * 0.035 },
  ];
  if (W) {
    torsoBumps.push({ t: 0.69, phi: 0.42, st: 0.055, sp: 0.32, a: 0.02 }, { t: 0.69, phi: -0.42, st: 0.055, sp: 0.32, a: 0.02 });
  }
  const torsoRx = curve([
    [0, waistW * 0.97],
    [0.3, waistW * 1.02],
    [0.6, lerp(waistW, chestW, 0.55) + m * 0.012],
    [0.78, chestW],
    [0.88, chestW * 0.96],
    [0.95, chestW * 0.84],
    [1, chestW * 0.55],
  ]);
  const torsoRz = curve([
    [0, waistD * 0.97],
    [0.3, waistD],
    [0.64, chestD],
    [0.76, chestD * 0.96],
    [0.88, chestD * 0.82],
    [0.96, chestD * 0.62],
    [1, chestD * 0.35],
  ]);
  const torso = sculptTube({
    y0: 0.04,
    y1: torsoTop,
    radius: (t) => [torsoRx(t), torsoRz(t)],
    centerZ: curve([
      [0, 0],
      [0.65, 0.012],
      [1, -0.012],
    ]),
    bumps: torsoBumps,
    color: torsoColor,
    radial: 44,
    rings: 36,
    capStart: true,
    capEnd: true,
    cavity,
  });

  // ── Neck ─────────────────────────────────────────────────
  const trapX = curve([
    [0, chestW * 0.78 + m * 0.02],
    [0.32, neckR * (1.3 + m * 0.35)],
    [0.62, neckR * 0.98],
    [1, neckR * 0.84],
  ]);
  const trapZ = curve([
    [0, chestD * 0.7],
    [0.35, neckR * 1.08],
    [1, neckR * 0.86],
  ]);
  const neck = sculptTube({
    y0: torsoTop - 0.07,
    y1: dims.neckTop + 0.012,
    radius: (t) => [trapX(t), trapZ(t)],
    centerZ: (t) => lerp(-0.02, -0.004, t),
    bumps: [
      { t: 0.6, phi: 0.45, st: 0.2, sp: 0.18, a: m * 0.008 },
      { t: 0.6, phi: -0.45, st: 0.2, sp: 0.18, a: m * 0.008 },
      { t: 0.25, phi: PI, st: 0.25, sp: 0.9, a: m * 0.02 },
      { t: 0.08, phi: 0, st: 0.12, sp: 0.5, a: -0.01 },
    ],
    color: (t, phi) => (a.outfit === "bodysuit" && t < 0.2 && frontness(phi) > 0.6 ? torsoColor(0.95, phi) : skin),
    radial: 32,
    rings: 14,
    cavity: cavity * 0.5,
  });

  // ── Head (in head group, pivot at neck top) ──────────────
  const headW = 0.086 + b * 0.008 + m * 0.005 - (W ? 0.004 : 0);
  const headD = 0.104 - (W ? 0.003 : 0);
  const jaw = headW * (0.86 + m * 0.06 + b * 0.04 - (W ? 0.06 : 0));
  const hasHair = a.hairStyle !== "bald";
  const headColor = (t: number, phi: number): THREE.Color => {
    const front = frontness(phi);
    if (a.mask) {
      if (t < 0.34 && front < 0.55) return t > 0.27 && t < 0.3 && front < 0.18 ? lips : skin;
      if (t > 0.48 && t < 0.62 && (nearPhi(phi, 0.36, 0.22) || nearPhi(phi, -0.36, 0.22))) return sec;
      if (t > 0.6 && front < 0.1) return sec;
      return prim;
    }
    // brows
    if (t > 0.6 && t < 0.645 && front > 0.14 && front < 0.58) return hair.clone().multiplyScalar(0.8);
    if (t > 0.27 && t < 0.295 && front < 0.18) return lips;
    // hairline
    if (a.hairStyle === "mohawk") {
      if (t > 0.8 && (front < 0.2 || front > PI - 0.2)) return hair;
      if (t > 0.7) return skin.clone().lerp(hair, 0.18);
    } else if (hasHair) {
      const hairline = front < 1.1 ? 0.84 : front < 1.9 ? 0.7 : 0.4;
      if (t > hairline) return hair;
      if (a.hairStyle === "long" && front > 2.3) return hair;
    }
    // facial hair
    if (a.facialHair === "beard" && t < 0.27 + 0.08 * Math.min(1, front / 1.3) && front < 1.75 && !(t > 0.25 && t < 0.3 && front < 0.2)) return hair;
    if (a.facialHair === "beard" && t > 0.3 && t < 0.345 && front < 0.3) return hair;
    if (a.facialHair === "goatee" && ((t < 0.25 && front < 0.4) || (t > 0.3 && t < 0.345 && front < 0.32))) return hair;
    if (a.facialHair === "stubble" && t < 0.36 && front < 1.6) return stubble;
    return skin;
  };
  const headRx = curve([
    [0, 0.03],
    [0.08, jaw * 0.62],
    [0.25, jaw],
    [0.5, headW * 0.96],
    [0.7, headW],
    [0.9, headW * 0.78],
    [1, 0.005],
  ]);
  const headRz = curve([
    [0, 0.03],
    [0.1, headD * 0.72],
    [0.3, headD * 0.94],
    [0.6, headD],
    [0.86, headD * 0.82],
    [1, 0.005],
  ]);
  const head = sculptTube({
    y0: -0.035,
    y1: 0.235,
    radius: (t) => [headRx(t), headRz(t)],
    centerZ: curve([
      [0, 0.04],
      [0.3, 0.014],
      [0.6, 0],
      [1, -0.012],
    ]),
    bumps: [
      { t: 0.42, phi: 0, st: 0.05, sp: 0.09, a: 0.017 }, // nose
      { t: 0.6, phi: 0.35, st: 0.03, sp: 0.32, a: 0.006 + m * 0.002 }, // brow
      { t: 0.6, phi: -0.35, st: 0.03, sp: 0.32, a: 0.006 + m * 0.002 },
      { t: 0.54, phi: 0.36, st: 0.03, sp: 0.14, a: -0.008 }, // eye sockets
      { t: 0.54, phi: -0.36, st: 0.03, sp: 0.14, a: -0.008 },
      { t: 0.46, phi: 0.78, st: 0.05, sp: 0.25, a: 0.006 }, // cheekbones
      { t: 0.46, phi: -0.78, st: 0.05, sp: 0.25, a: 0.006 },
      { t: 0.1, phi: 0, st: 0.05, sp: 0.32, a: 0.008 }, // chin
      { t: 0.28, phi: 0, st: 0.02, sp: 0.18, a: 0.004 }, // lips
      { t: 0.5, phi: PI / 2, st: 0.07, sp: 0.11, a: 0.012 }, // ears
      { t: 0.5, phi: -PI / 2, st: 0.07, sp: 0.11, a: 0.012 },
      { t: 0.7, phi: PI, st: 0.15, sp: 0.8, a: 0.01 }, // occipital
    ],
    color: headColor,
    radial: 48,
    rings: 36,
    capStart: true,
    capEnd: true,
    cavity: 0.4,
  });
  dims.headR = Math.max(headW, headD) + 0.006;

  // ── Hair shell: follows the skull, sinks inside the head where there is no hair ──
  const headCZ = curve([
    [0, 0.04],
    [0.3, 0.014],
    [0.6, 0],
    [1, -0.012],
  ]);
  const hairMask = (t: number, phi: number) => {
    const fr = frontness(phi);
    if (a.hairStyle === "mohawk") return smoothstep(0.74, 0.8, t) * (1 - smoothstep(0.16, 0.26, Math.min(fr, PI - fr)));
    const low = a.hairStyle === "long" ? 0.3 : 0.42;
    const hl = lerp(0.85, low, smoothstep(0.9, 2.3, fr));
    return smoothstep(hl - 0.035, hl + 0.025, t);
  };
  const thickness = { bald: 0, buzz: 0, short: 0.016, mohawk: 0.045, ponytail: 0.014, long: 0.02 }[a.hairStyle];
  const hairGeo =
    !a.mask && thickness > 0
      ? sculptTube({
          y0: -0.035 + 0.27 * 0.28,
          y1: 0.235 + 0.004,
          radius: (t) => {
            const tt = 0.28 + t * 0.72;
            return [headRx(tt), headRz(tt)];
          },
          centerZ: (t) => headCZ(0.28 + t * 0.72) - 0.002,
          bumps: [],
          color: (t, phi) => {
            const k = hairMask(0.28 + t * 0.72, phi);
            return hair.clone().multiplyScalar(0.75 + 0.25 * k);
          },
          radial: 48,
          rings: 30,
          capEnd: true,
        })
      : null;
  if (hairGeo) {
    // Push hair outward by `thickness` where the mask is on; sink 10% inside the skull elsewhere.
    const pos = hairGeo.getAttribute("position") as THREE.BufferAttribute;
    const R = 48;
    const N = 30;
    for (let i = 0; i <= N; i++) {
      const t = 0.28 + (i / N) * 0.72;
      const cz = headCZ(t) - 0.002;
      for (let j = 0; j <= R; j++) {
        const idx = i * (R + 1) + j;
        const phi = (j / R) * Math.PI * 2;
        const k = hairMask(t, phi);
        const x = pos.getX(idx);
        const z = pos.getZ(idx) - cz;
        const len = Math.hypot(x, z) || 1;
        const out = k * (thickness + (a.hairStyle === "mohawk" ? 0.02 * smoothstep(0.8, 1, t) : 0)) - (1 - k) * len * 0.1 + k * 0.003;
        pos.setX(idx, x + (x / len) * out);
        pos.setZ(idx, cz + z + (z / len) * out);
      }
    }
    pos.needsUpdate = true;
    hairGeo.computeVertexNormals();
  }

  // ── Arms ─────────────────────────────────────────────────
  const arm = (s: 1 | -1) => {
    const side = (s * PI) / 2;
    const deltRx = curve([
      [0, 0.004],
      [0.14, deltR * 0.72],
      [0.34, deltR],
      [0.58, deltR * 0.92],
      [0.84, armR * 1.12],
      [1, armR * 0.95],
    ]);
    const delt = sculptTube({
      y0: 0.075,
      y1: -0.16,
      radius: (t) => [deltRx(t), deltRx(t) * 1.08],
      centerX: (t) => s * (0.01 - 0.03 * (1 - t) * (1 - t)),
      bumps: [
        { t: 0.45, phi: 0, st: 0.2, sp: 0.5, a: m * 0.008 },
        { t: 0.45, phi: side, st: 0.2, sp: 0.5, a: m * 0.011 },
        { t: 0.45, phi: PI, st: 0.2, sp: 0.5, a: m * 0.007 },
      ],
      color: () => (a.outfit === "bodysuit" && W ? prim : skin),
      radial: 28,
      rings: 14,
      capStart: true,
      cavity,
    });
    const uaRx = curve([
      [0, armR * 1.15],
      [0.3, armR * 1.08],
      [0.85, armR * 0.86],
      [1, armR * 0.8],
    ]);
    const upperArm = sculptTube({
      y0: 0.02,
      y1: -dims.upperArm - 0.012,
      radius: (t) => [uaRx(t), uaRx(t) * 1.04],
      bumps: [
        { t: 0.52, phi: -s * 0.15, st: 0.16, sp: 0.7, a: (0.004 + m * 0.026) * armK },
        { t: 0.55, phi: -s * 0.1, st: 0.07, sp: 0.35, a: cut * m * 0.007 },
        { t: 0.35, phi: PI + s * 0.2, st: 0.2, sp: 0.8, a: (0.003 + m * 0.02) * armK },
        { t: 0.3, phi: s * (PI / 2 + 0.6), st: 0.12, sp: 0.35, a: m * 0.009 },
        { t: 0.72, phi: side, st: 0.12, sp: 0.4, a: m * 0.006 },
      ],
      color: () => skin,
      radial: 28,
      rings: 18,
      capStart: true,
      cavity,
    });
    const faRx = curve([
      [0, armR * 0.95],
      [0.25, armR * 1.0],
      [0.72, armR * 0.7],
      [1, armR * 0.56],
    ]);
    const foreArm = sculptTube({
      y0: 0.015,
      y1: -dims.foreArm,
      radius: (t) => [faRx(t), faRx(t) * 0.92],
      bumps: [
        { t: 0.2, phi: s * 0.9, st: 0.14, sp: 0.5, a: (0.003 + m * 0.014) * armK },
        { t: 0.25, phi: -s * 1.2, st: 0.16, sp: 0.6, a: m * 0.008 * armK },
      ],
      color: (t) => (a.wristTape && t > 0.8 ? tape : skin),
      radial: 24,
      rings: 16,
      cavity,
    });
    return { delt, upperArm, foreArm };
  };
  const armL = arm(1);
  const armR_ = arm(-1);

  // ── Legs ─────────────────────────────────────────────────
  const thighColor = (t: number, phi: number, s: number) => {
    if (fullLegs) return a.outfit === "tights" && nearPhi(phi, (s * PI) / 2, 0.16) ? sec : prim;
    if (a.outfit === "singlet") return t < 0.14 ? (t > 0.11 ? sec : prim) : skin;
    return t < 0.2 ? (t > 0.17 ? sec : prim) : skin;
  };
  const leg = (s: 1 | -1) => {
    const thRx = curve([
      [0, legR * 0.96],
      [0.22, legR * 1.06],
      [0.75, legR * 0.8],
      [1, legR * 0.63],
    ]);
    const thRz = curve([
      [0, legR * 1.1],
      [0.3, legR * 1.05],
      [1, legR * 0.67],
    ]);
    const thigh = sculptTube({
      y0: 0.06,
      y1: -dims.thigh,
      radius: (t) => [thRx(t), thRz(t)],
      bumps: [
        { t: 0.45, phi: 0, st: 0.2, sp: 0.4, a: m * 0.014 * legK },
        { t: 0.45, phi: s * 1.0, st: 0.2, sp: 0.45, a: (0.003 + m * 0.018) * legK },
        { t: 0.82, phi: -s * 0.55, st: 0.07, sp: 0.35, a: (0.002 + m * 0.014 * (0.5 + d * 0.5)) * legK },
        { t: 0.25, phi: -s * 1.7, st: 0.2, sp: 0.5, a: 0.004 + m * 0.008 + f * 0.01 },
        { t: 0.4, phi: PI, st: 0.22, sp: 0.6, a: (0.003 + m * 0.016) * legK },
      ],
      color: (t, phi) => thighColor(t, phi, s),
      centerX: (t) => -s * 0.01 * (1 - t),
      capStart: true,
      radial: 30,
      rings: 22,
      cavity: fullLegs ? cavity * 0.6 : cavity,
    });
    const shRx = curve([
      [0, legR * 0.64],
      [0.3, legR * 0.66],
      [0.55, legR * 0.5],
      [0.62, legR * 0.5 + 0.008],
      [1, legR * 0.46 + 0.008],
    ]);
    const kneeT = 0.17;
    const bootT = 0.55;
    const shin = sculptTube({
      y0: 0.02,
      y1: -dims.shin,
      radius: (t) => [shRx(t), shRx(t) * 1.05],
      bumps: [
        { t: 0.28, phi: PI - 0.38, st: 0.1, stBelow: 0.15, sp: 0.4, a: (0.006 + m * 0.02) * legK },
        { t: 0.28, phi: PI + 0.38, st: 0.1, stBelow: 0.15, sp: 0.4, a: (0.006 + m * 0.02) * legK },
        { t: 0.25, phi: s * 0.3, st: 0.15, sp: 0.25, a: m * 0.005 },
        ...(a.kneepads ? [{ t: 0.06, phi: 0, st: 0.07, sp: 1.2, a: 0.012 }] : []),
      ],
      color: (t) => {
        if (t > bootT) return t < bootT + 0.04 ? sec : boot;
        if (a.kneepads && t < kneeT) return sec;
        return fullLegs ? prim : skin;
      },
      radial: 28,
      rings: 20,
      cavity: fullLegs ? cavity * 0.5 : cavity,
    });
    return { thigh, shin };
  };
  const legL = leg(1);
  const legR_ = leg(-1);
  const kneeColor = a.kneepads ? sec : fullLegs ? prim : skin;

  return {
    dims,
    pelvis,
    torso,
    neck,
    head,
    delt: [armL.delt, armR_.delt],
    upperArm: [armL.upperArm, armR_.upperArm],
    foreArm: [armL.foreArm, armR_.foreArm],
    thigh: [legL.thigh, legR_.thigh],
    shin: [legL.shin, legR_.shin],
    knee: [kneeColor, kneeColor],
    hair: hairGeo,
  };
}

export function disposeBody(body: BodyGeometry) {
  for (const v of Object.values(body)) {
    if (v instanceof THREE.BufferGeometry) v.dispose();
    if (Array.isArray(v)) v.forEach((g) => g instanceof THREE.BufferGeometry && g.dispose());
  }
}
