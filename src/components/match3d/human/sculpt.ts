/**
 * Per-wrestler sculpt of the shared base mesh. Every vertex belongs (through
 * its skin weights) to body segments such as torso, upper arm or shin. Within a
 * segment it has cylindrical coordinates (t along the bone, φ around it, with
 * φ = 0 facing the character's front and +π/2 its left), so muscles, fat and
 * gear are shaped as radial scaling plus Gaussian bumps along the normal,
 * blended by skin weight so joints stay seamless. Face shape and gear volume
 * (pants, boots, pads, gloves) are sculpted the same way. Also outputs the
 * paint coordinates the skin/gear shader uses.
 */
import * as THREE from "three";
import { faceFor } from "@/engine/appearance";
import type { Appearance, FaceShape } from "@/engine/types";

export { faceFor };
import type { HumanBase } from "./base";

export interface Landmarks {
  headTop: number;
  eyeY: number;
  eyeX: number;
  eyeZ: number;
  mouthY: number;
  chinY: number;
  neckY: number;
  chestY: number;
  navelY: number;
  pelvisY: number;
  kneeY: number;
  ankleY: number;
  /** Rest-space arm axes (shoulder → wrist) for the shader, left then right. */
  armA: [THREE.Vector3, THREE.Vector3];
  armB: [THREE.Vector3, THREE.Vector3];
}

export interface Sculpted {
  geometry: THREE.BufferGeometry;
  /** World-space rest offsets for bones (shoulder width, hip width). */
  boneShift: Map<number, THREE.Vector3>;
  landmarks: Landmarks;
  face: FaceShape;
  /** Left eye socket front after sculpting (mirror x for the right). */
  eye: THREE.Vector3;
}

interface Bump {
  t: number;
  phi: number;
  st: number;
  sp: number;
  a: number;
  stBelow?: number;
}

const TAU = Math.PI * 2;
const angDiff = (a: number, b: number) => {
  let d = a - b;
  while (d > Math.PI) d -= TAU;
  while (d < -Math.PI) d += TAU;
  return d;
};
function bumpField(bumps: Bump[], t: number, phi: number) {
  let s = 0;
  for (const b of bumps) {
    const dt = t - b.t;
    const st = dt > 0 && b.stBelow ? b.stBelow : b.st;
    const dp = angDiff(phi, b.phi);
    s += b.a * Math.exp(-((dt * dt) / (2 * st * st) + (dp * dp) / (2 * b.sp * b.sp)));
  }
  return s;
}
function curve(keys: [number, number][]) {
  return (t: number) => {
    if (t <= keys[0][0]) return keys[0][1];
    for (let i = 0; i < keys.length - 1; i++) {
      const [t0, v0] = keys[i];
      const [t1, v1] = keys[i + 1];
      if (t <= t1) {
        const k = (t - t0) / (t1 - t0);
        return v0 + (v1 - v0) * k * k * (3 - 2 * k);
      }
    }
    return keys[keys.length - 1][1];
  };
}
const smooth = (e0: number, e1: number, x: number) => {
  const k = Math.min(1, Math.max(0, (x - e0) / (e1 - e0)));
  return k * k * (3 - 2 * k);
};
const gauss = (x: number, s: number) => Math.exp(-(x * x) / (2 * s * s));

/** Rest world positions of every bone. */
export function restBonePositions(base: HumanBase) {
  const world: THREE.Matrix4[] = [];
  base.bones.forEach((b, i) => {
    const local = new THREE.Matrix4().compose(b.position, b.quaternion, new THREE.Vector3(1, 1, 1));
    world[i] = b.parent >= 0 ? new THREE.Matrix4().multiplyMatrices(world[b.parent], local) : local;
  });
  return world.map((m) => new THREE.Vector3().setFromMatrixPosition(m));
}

export function sculptWrestler(base: HumanBase, a: Appearance, id: string): Sculpted {
  const bonesW = restBonePositions(base);
  const B = (n: string) => bonesW[base.boneIndex[n]];
  const bi = base.boneIndex;
  const face = faceFor(id, a);

  const m = a.muscle;
  const def = a.definition;
  const f = a.bodyFat;
  const b = a.bulk;
  const sw = a.shoulderWidth;
  const armK = 0.8 + a.armSize * 0.4;
  const legK = 0.82 + a.legSize * 0.36;
  const cut = def * (1 - f * 0.85);

  // ── Landmarks from the rest skeleton and mesh ──
  const P = base.positions;
  let headTop = 0;
  for (let i = 1; i < P.length; i += 3) headTop = Math.max(headTop, P[i]);
  const neckY = B("spine004").y;
  const headLen = headTop - neckY;
  const eyeY = headTop - headLen * 0.4;
  const mouthY = headTop - headLen * 0.63;
  const chinY = headTop - headLen * 0.76;
  const pelvisY = B("spine").y;
  const chestY = B("spine003").y;
  // the face's front surface at eye height, slightly off-centre
  let eyeZ = 0;
  const eyeX = 0.032;
  for (let i = 0; i < P.length; i += 3) if (Math.abs(Math.abs(P[i]) - eyeX) < 0.012 && Math.abs(P[i + 1] - eyeY) < 0.012) eyeZ = Math.max(eyeZ, P[i + 2]);

  const landmarks: Landmarks = {
    headTop,
    eyeY,
    eyeX,
    eyeZ,
    mouthY,
    chinY,
    neckY,
    chestY,
    navelY: pelvisY + (chestY - pelvisY) * 0.35,
    pelvisY,
    kneeY: B("shinL").y,
    ankleY: B("footL").y,
    armA: [B("upper_armL").clone(), B("upper_armR").clone()],
    armB: [B("handL").clone(), B("handR").clone()],
  };

  // ── Bone shifts: broader shoulders and hips move the joints, not just the skin ──
  const shoulderOut = 0.012 * (sw - 0.5) * 2 + 0.032 * m + 0.016 * b + 0.01 * f;
  const hipOut = 0.012 * f + 0.008 * b + 0.004 * m;
  const boneShift = new Map<number, THREE.Vector3>();
  boneShift.set(bi.upper_armL, new THREE.Vector3(shoulderOut, 0.004 * m, 0));
  boneShift.set(bi.upper_armR, new THREE.Vector3(-shoulderOut, 0.004 * m, 0));
  boneShift.set(bi.thighL, new THREE.Vector3(hipOut, 0, 0));
  boneShift.set(bi.thighR, new THREE.Vector3(-hipOut, 0, 0));
  // vertices follow the shift of the limb they belong to (descendants included)
  const shiftOf = new Map<number, THREE.Vector3>();
  const descend = (root: number, v: THREE.Vector3, k = 1) => {
    const stack = [root];
    while (stack.length) {
      const i = stack.pop()!;
      shiftOf.set(i, v.clone().multiplyScalar(k));
      base.bones.forEach((bb, j) => bb.parent === i && stack.push(j));
    }
  };
  for (const [i, v] of boneShift) descend(i, v);
  shiftOf.set(bi.shoulderL, boneShift.get(bi.upper_armL)!.clone().multiplyScalar(0.55));
  shiftOf.set(bi.shoulderR, boneShift.get(bi.upper_armR)!.clone().multiplyScalar(0.55));

  // ── Segments ──
  type Seg = { a: THREE.Vector3; b: THREE.Vector3; bones: number[]; shape: (t: number, phi: number) => { kx: number; kz: number; k: number; bump: number } };
  const bones = (...names: string[]) => names.map((n) => bi[n]).filter((x) => x != null);
  const fingers = (s: string) => ["f_index", "f_middle", "f_ring", "f_pinky"].flatMap((n) => [1, 2, 3].map((j) => `${n}0${j}${s}`)).concat([1, 2, 3].map((j) => `thumb0${j}${s}`));

  const absA = (0.003 + def * 0.012 + m * 0.004) * (1 - f * 0.9);
  const torsoBumps: Bump[] = [
    { t: 0.73, phi: 0.5, st: 0.085, stBelow: 0.03, sp: 0.42, a: 0.008 + m * 0.045 },
    { t: 0.73, phi: -0.5, st: 0.085, stBelow: 0.03, sp: 0.42, a: 0.008 + m * 0.045 },
    { t: 0.73, phi: 0, st: 0.12, sp: 0.07, a: -(0.003 + m * 0.014) },
    ...[0.53, 0.43, 0.33, 0.23].flatMap((t, i) => [0.2, -0.2].map((phi) => ({ t, phi, st: 0.036, sp: 0.12, a: absA * (i === 3 ? 0.6 : 1) }))),
    { t: 0.38, phi: 0, st: 0.22, sp: 0.05, a: -def * 0.004 * (1 - f * 0.8) },
    { t: 0.28, phi: 1.05, st: 0.1, sp: 0.3, a: m * 0.006 + f * 0.012 },
    { t: 0.28, phi: -1.05, st: 0.1, sp: 0.3, a: m * 0.006 + f * 0.012 },
    ...[0.56, 0.62].flatMap((t) => [0.98, -0.98].map((phi) => ({ t, phi, st: 0.022, sp: 0.1, a: cut * m * 0.004 }))),
    { t: 0.64, phi: 1.9, st: 0.15, sp: 0.42, a: 0.004 + m * 0.022 },
    { t: 0.64, phi: -1.9, st: 0.15, sp: 0.42, a: 0.004 + m * 0.022 },
    { t: 0.8, phi: Math.PI - 0.55, st: 0.1, sp: 0.35, a: m * 0.012 },
    { t: 0.8, phi: Math.PI + 0.55, st: 0.1, sp: 0.35, a: m * 0.012 },
    { t: 0.5, phi: Math.PI, st: 0.3, sp: 0.07, a: -(0.003 + m * 0.006) },
    { t: 0.25, phi: Math.PI - 0.2, st: 0.12, sp: 0.13, a: m * 0.008 },
    { t: 0.25, phi: Math.PI + 0.2, st: 0.12, sp: 0.13, a: m * 0.008 },
    { t: 0.95, phi: 1.2, st: 0.06, sp: 0.5, a: m * 0.03 + b * 0.008 },
    { t: 0.95, phi: -1.2, st: 0.06, sp: 0.5, a: m * 0.03 + b * 0.008 },
    { t: 0.93, phi: Math.PI, st: 0.07, sp: 0.9, a: m * 0.022 },
    { t: 0.32, phi: 0, st: 0.16, sp: 1.0, a: f * 0.08 },
    { t: 0.12, phi: 1.55, st: 0.08, sp: 0.4, a: f * 0.035 },
    { t: 0.12, phi: -1.55, st: 0.08, sp: 0.4, a: f * 0.035 },
    // glutes
    { t: 0.02, phi: Math.PI - 0.45, st: 0.08, sp: 0.5, a: 0.004 + m * 0.012 + f * 0.01 },
    { t: 0.02, phi: Math.PI + 0.45, st: 0.08, sp: 0.5, a: 0.004 + m * 0.012 + f * 0.01 },
  ];
  const torsoKx = curve([
    [0, 1.0 + 0.1 * f + 0.07 * b + 0.04 * m],
    [0.28, 0.94 + 0.06 * m + 0.38 * f + 0.12 * b],
    [0.55, 1.0 + 0.12 * m + 0.2 * f + 0.1 * b],
    [0.74, 1.02 + 0.2 * m + 0.08 * (sw - 0.5) + 0.1 * b + 0.06 * f],
    [0.92, 1.02 + 0.16 * m + 0.08 * b],
    [1, 1.0 + 0.2 * m],
  ]);
  const torsoKz = curve([
    [0, 1.0 + 0.12 * f + 0.06 * b + 0.06 * m],
    [0.3, 0.95 + 0.05 * m + 0.6 * f + 0.1 * b],
    [0.6, 1.0 + 0.12 * m + 0.25 * f + 0.08 * b],
    [0.76, 1.02 + 0.2 * m + 0.08 * b + 0.06 * f],
    [1, 1.0 + 0.14 * m],
  ]);

  const armShape = (side: 1 | -1) => (t: number, phi: number) => {
    const k = curve([
      [0, 1.06 + 0.3 * m + 0.1 * b],
      [0.45, 1.04 + 0.52 * m * armK + 0.12 * b + 0.14 * f],
      [1, 1.02 + 0.26 * m * armK + 0.08 * b],
    ])(t);
    const bump = bumpField(
      [
        { t: 0.52, phi: 0.1 * side, st: 0.16, sp: 0.65, a: (0.003 + m * 0.02) * armK },
        { t: 0.42, phi: Math.PI, st: 0.2, sp: 0.8, a: (0.002 + m * 0.016) * armK },
        { t: 0.1, phi: Math.PI / 2, st: 0.12, sp: 0.9, a: m * 0.016 + b * 0.004 },
        { t: 0.7, phi: Math.PI / 2, st: 0.12, sp: 0.4, a: m * 0.005 },
      ],
      t,
      phi,
    );
    return { kx: 1, kz: 1, k, bump };
  };
  const foreShape = (t: number, phi: number) => {
    const k = curve([
      [0, 1.04 + 0.34 * m * armK + 0.08 * b],
      [0.35, 1.04 + 0.32 * m * armK + 0.08 * b + 0.05 * f],
      [1, 1.02 + 0.12 * m + 0.05 * b],
    ])(t);
    const bump = bumpField([{ t: 0.22, phi: 0.9, st: 0.14, sp: 0.5, a: (0.002 + m * 0.01) * armK }], t, phi);
    return { kx: 1, kz: 1, k, bump };
  };
  const handShape = () => ({ kx: 1, kz: 1, k: 1.06 + 0.1 * m + 0.08 * b, bump: 0 });
  const thighShape = (side: 1 | -1) => (t: number, phi: number) => {
    const k = curve([
      [0, 1.04 + 0.22 * m * legK + 0.2 * f + 0.12 * b],
      [0.4, 1.04 + 0.3 * m * legK + 0.2 * f + 0.12 * b],
      [1, 1.02 + 0.12 * m + 0.06 * b + 0.06 * f],
    ])(t);
    const bump = bumpField(
      [
        { t: 0.5, phi: 0, st: 0.2, sp: 0.4, a: m * 0.012 * legK },
        { t: 0.5, phi: side * 0.95, st: 0.2, sp: 0.45, a: (0.002 + m * 0.014) * legK },
        { t: 0.84, phi: -side * 0.5, st: 0.07, sp: 0.35, a: (0.002 + m * 0.012 * (0.5 + def * 0.5)) * legK },
        { t: 0.42, phi: Math.PI, st: 0.22, sp: 0.6, a: (0.002 + m * 0.012) * legK },
      ],
      t,
      phi,
    );
    return { kx: 1, kz: 1, k, bump };
  };
  const shinShape = (t: number, phi: number) => {
    const k = curve([
      [0, 1.02 + 0.14 * m + 0.06 * b],
      [0.35, 1.03 + 0.18 * m + 0.08 * b + 0.06 * f],
      [1, 1.0 + 0.04 * b],
    ])(t);
    const bump = bumpField(
      [
        { t: 0.3, phi: Math.PI - 0.4, st: 0.1, stBelow: 0.15, sp: 0.4, a: (0.004 + m * 0.014) * legK },
        { t: 0.3, phi: Math.PI + 0.4, st: 0.1, stBelow: 0.15, sp: 0.4, a: (0.004 + m * 0.014) * legK },
      ],
      t,
      phi,
    );
    return { kx: 1, kz: 1, k, bump };
  };
  const neckK = 1.04 + 0.3 * m + 0.12 * b + 0.08 * f;

  const segs: Seg[] = [
    { a: B("spine"), b: B("spine004"), bones: bones("spine", "spine001", "spine002", "spine003", "shoulderL", "shoulderR", "pelvisL", "pelvisR"), shape: (t, phi) => ({ kx: torsoKx(t), kz: torsoKz(t), k: 1, bump: bumpField(torsoBumps, t, phi) }) },
    { a: B("upper_armL"), b: B("forearmL"), bones: bones("upper_armL"), shape: armShape(1) },
    { a: B("upper_armR"), b: B("forearmR"), bones: bones("upper_armR"), shape: armShape(-1) },
    { a: B("forearmL"), b: B("handL"), bones: bones("forearmL"), shape: foreShape },
    { a: B("forearmR"), b: B("handR"), bones: bones("forearmR"), shape: foreShape },
    { a: B("handL"), b: B("f_middle03L"), bones: bones("handL", ...fingers("L")), shape: handShape },
    { a: B("handR"), b: B("f_middle03R"), bones: bones("handR", ...fingers("R")), shape: handShape },
    { a: B("thighL"), b: B("shinL"), bones: bones("thighL"), shape: thighShape(1) },
    { a: B("thighR"), b: B("shinR"), bones: bones("thighR"), shape: thighShape(-1) },
    { a: B("shinL"), b: B("footL"), bones: bones("shinL"), shape: shinShape },
    { a: B("shinR"), b: B("footR"), bones: bones("shinR"), shape: shinShape },
  ];
  const headBones = new Set(bones("spine004", "spine005"));
  const segOf = new Map<number, number>();
  segs.forEach((s, i) => s.bones.forEach((bn) => segOf.set(bn, i)));

  // ── Per-vertex sculpt ──
  const n = P.length / 3;
  const out = new Float32Array(P.length);
  const aRegA = new Float32Array(n * 4); // torso, head, upper arm, forearm
  const aRegB = new Float32Array(n * 4); // hand, thigh, shin, foot
  const aLimb = new Float32Array(n * 4); // t along arm (0 shoulder..1 wrist, hand >1) or −1−t on legs, cos φ, sin φ, side
  const v = new THREE.Vector3();
  const nrm = new THREE.Vector3();
  const rel = new THREE.Vector3();
  const axis = new THREE.Vector3();
  const fwd = new THREE.Vector3();
  const sideV = new THREE.Vector3();
  const disp = new THREE.Vector3();
  const Z = new THREE.Vector3(0, 0, 1);
  const segW = new Float32Array(segs.length);
  const fc = (x: number) => (x - 0.5) * 2; // −1..1

  const outfit = a.outfit;
  const fullLegs = outfit === "tights" || outfit === "pants" || outfit === "bodysuit";

  for (let i = 0; i < n; i++) {
    v.fromArray(P, i * 3);
    nrm.fromArray(base.normals, i * 3);
    segW.fill(0);
    let headW = 0;
    disp.set(0, 0, 0);
    const shift = new THREE.Vector3();
    for (let k = 0; k < 4; k++) {
      const bn = base.skinIndex[i * 4 + k];
      const w = base.skinWeight[i * 4 + k];
      if (w <= 0) continue;
      const s = segOf.get(bn);
      if (s != null) segW[s] += w;
      if (headBones.has(bn)) headW += w;
      const sh = shiftOf.get(bn);
      if (sh) shift.addScaledVector(sh, w);
    }
    // body segments
    let limbT = 0;
    let limbPhi = 0;
    let limbSide = 0;
    let limbIsLeg = 0;
    for (let s = 0; s < segs.length; s++) {
      const w = segW[s];
      if (w < 0.002) continue;
      const seg = segs[s];
      axis.subVectors(seg.b, seg.a);
      const L = axis.length();
      axis.divideScalar(L);
      rel.subVectors(v, seg.a);
      const along = rel.dot(axis);
      const t = along / L;
      rel.addScaledVector(axis, -along); // radial
      fwd.copy(Z).addScaledVector(axis, -axis.dot(Z));
      if (fwd.lengthSq() < 1e-4) fwd.set(0, 1, 0);
      fwd.normalize();
      sideV.crossVectors(fwd, axis).normalize();
      const phi = Math.atan2(rel.dot(sideV), rel.dot(fwd));
      const sh = seg.shape(Math.max(0, Math.min(1, t)), phi);
      if (s === 0) {
        disp.x += w * (sh.kx - 1) * rel.x;
        disp.z += w * (sh.kz - 1) * rel.z;
      } else {
        disp.addScaledVector(rel, w * (sh.k - 1));
      }
      disp.addScaledVector(nrm, w * sh.bump);
      // paint coordinates along the whole arm / leg
      if (s >= 1 && s <= 6 && w > 0.3) {
        const isFore = s === 3 || s === 4;
        const isHand = s === 5 || s === 6;
        limbT = isHand ? 1 + t * 0.3 : isFore ? 0.5 + t * 0.5 : t * 0.5;
        limbPhi = phi;
        limbSide = s % 2 === 1 ? 1 : -1;
        if (isHand) limbSide = s === 5 ? 1 : -1;
        if (isFore) limbSide = s === 3 ? 1 : -1;
      }
      if (s >= 7 && w > 0.3) {
        const isShin = s >= 9;
        limbT = isShin ? 0.5 + t * 0.5 : t * 0.5;
        limbPhi = phi;
        limbSide = s % 2 === 1 ? 1 : -1;
        limbIsLeg = 1;
      }
    }
    // neck and head
    if (headW > 0.002) {
      const y = v.y;
      const cz = v.z;
      const front = Math.max(0, cz) / 0.1;
      // neck thickness below the jaw
      const neckMask = 1 - smooth(chinY - 0.05, chinY - 0.01, y);
      const nb = B("spine004");
      disp.x += headW * neckMask * (neckK - 1) * (v.x - nb.x);
      disp.z += headW * neckMask * (neckK - 1) * 0.85 * (v.z - nb.z);
      // head proportions
      const headMask = smooth(chinY - 0.02, chinY + 0.03, y);
      const hc = (eyeY + chinY) / 2;
      // bigger heads on bigger bodies so they don't look pinned on
      const hs = 0.06 + b * 0.05 + m * 0.03;
      disp.x += headW * headMask * hs * v.x;
      disp.y += headW * headMask * hs * (y - chinY);
      disp.z += headW * headMask * hs * (v.z - B("spine005").z);
      disp.x += headW * headMask * fc(face.width) * 0.08 * v.x;
      disp.y += headW * headMask * fc(face.length) * 0.05 * (y - hc);
      // jaw: wider and squarer low on the face
      const jawMask = gauss(y - (chinY + mouthY) / 2, 0.022) * headMask;
      disp.x += headW * jawMask * (0.06 + fc(face.jaw) * 0.18 + b * 0.05) * v.x;
      // a defined jawline: the jaw stands proud of the neck, with a recess underneath
      const underJaw = gauss(y - (chinY - 0.012), 0.008) * smooth(-0.04, 0.0, v.z);
      disp.addScaledVector(nrm, -headW * underJaw * 0.006);
      disp.addScaledVector(nrm, headW * gauss(y - (chinY + 0.006), 0.009) * smooth(0.02, 0.05, Math.abs(v.x)) * (0.004 + fc(face.jaw) * 0.003));
      // facial convexity: the middle of the face comes forward, the outer cheeks fall back
      const faceBand = smooth(chinY - 0.005, chinY + 0.02, y) * (1 - smooth(eyeY + 0.03, eyeY + 0.06, y)) * front;
      disp.z += headW * faceBand * (gauss(v.x, 0.03) * 0.012 - smooth(0.045, 0.07, Math.abs(v.x)) * 0.008);
      // soften the boxy corners of the base head
      const corner = smooth(0.05, 0.075, Math.abs(v.x)) * smooth(0.02, 0.06, Math.abs(v.z - B("spine005").z));
      disp.x -= headW * headMask * corner * 0.008 * Math.sign(v.x);
      // rounder cranium above the brow
      const crown = smooth(eyeY + 0.01, eyeY + 0.05, y) * (1 - smooth(headTop - 0.03, headTop, y));
      disp.x += headW * crown * 0.05 * v.x;
      disp.z += headW * crown * 0.04 * (v.z - B("spine005").z);
      // chin forward / down
      disp.z += headW * gauss(y - chinY - 0.012, 0.014) * gauss(v.x, 0.022) * front * (0.004 + fc(face.chin) * 0.006);
      // brow ridge
      disp.z += headW * gauss(y - (eyeY + 0.022), 0.008) * gauss(Math.abs(v.x) - 0.03, 0.025) * front * (0.006 + fc(face.brow) * 0.004);
      // eye sockets
      disp.z -= headW * gauss(y - eyeY, 0.009) * gauss(Math.abs(v.x) - eyeX, 0.012) * front * 0.007;
      // nose: bridge + tip + nostrils
      const noseY = (eyeY + mouthY) / 2;
      disp.z += headW * gauss(v.x, 0.008 + face.nose * 0.004) * front * (gauss(y - noseY, 0.016) * (0.014 + face.nose * 0.008) + gauss(y - (eyeY - 0.004), 0.01) * 0.004);
      disp.z += headW * gauss(Math.abs(v.x) - 0.012, 0.005) * gauss(y - (noseY - 0.008), 0.006) * front * 0.004;
      // cheekbones
      disp.addScaledVector(nrm, headW * gauss(y - (eyeY - 0.022), 0.012) * gauss(Math.abs(v.x) - 0.048, 0.016) * (0.002 + face.cheeks * 0.005));
      // lips
      disp.z += headW * gauss(y - mouthY, 0.005) * gauss(v.x, 0.016) * front * 0.0035;
      disp.z -= headW * gauss(y - (mouthY - 0.006), 0.0025) * gauss(v.x, 0.02) * front * 0.0015;
      // ears
      disp.x += headW * gauss(y - (eyeY - 0.01), 0.018) * gauss(v.z + 0.005, 0.014) * Math.sign(v.x) * smooth(0.055, 0.07, Math.abs(v.x)) * 0.008;
    }

    // ── Gear volume ──
    const thighW = segW[7] + segW[8];
    const shinW = segW[9] + segW[10];
    if (outfit === "pants") {
      const legMask = (thighW + shinW) * smooth(0.06, 0.14, v.y);
      disp.addScaledVector(nrm, legMask * (0.012 + 0.006 * Math.sin(v.y * 40 + v.x * 30)));
    }
    if (fullLegs && outfit !== "pants") disp.addScaledVector(nrm, (thighW + shinW) * 0.0015);
    // boots up to mid-shin, kneepads, elbow pads, gloves
    const ankle = landmarks.ankleY;
    const bootTop = ankle + (landmarks.kneeY - ankle) * 0.55;
    if (v.y < bootTop) disp.addScaledVector(nrm, 0.006 * smooth(bootTop, bootTop - 0.02, v.y));
    if (a.kneepads) disp.addScaledVector(nrm, (thighW + shinW) * 0.012 * gauss(v.y - landmarks.kneeY, 0.03) * smooth(-0.3, 0.6, Math.cos(limbPhi)));
    if (a.elbowPads && limbIsLeg === 0 && limbSide !== 0) disp.addScaledVector(nrm, 0.008 * gauss(limbT - 0.5, 0.05) * smooth(-0.2, 0.6, -Math.cos(limbPhi)));
    if (a.gloves && limbT > 0.97 && limbIsLeg === 0) disp.addScaledVector(nrm, 0.003);

    out[i * 3] = v.x + disp.x + shift.x;
    out[i * 3 + 1] = v.y + disp.y + shift.y;
    out[i * 3 + 2] = v.z + disp.z + shift.z;
    aRegA.set([segW[0], headW, segW[1] + segW[2], segW[3] + segW[4]], i * 4);
    aRegB.set([segW[5] + segW[6], thighW, shinW, Math.max(0, 1 - segW.reduce((s2, x) => s2 + x, 0) - headW)], i * 4);
    aLimb.set([limbIsLeg ? -1 - limbT : limbT, Math.cos(limbPhi), Math.sin(limbPhi), limbSide], i * 4);
  }

  // where the eye socket ended up after sculpting
  const eye = new THREE.Vector3();
  let eyeN = 0;
  for (let i = 0; i < n; i++) {
    const dx = P[i * 3] - eyeX;
    const dy = P[i * 3 + 1] - eyeY;
    const dz = P[i * 3 + 2] - eyeZ;
    if (dx * dx + dy * dy + dz * dz < 0.012 * 0.012) {
      eye.x += out[i * 3] - P[i * 3];
      eye.y += out[i * 3 + 1] - P[i * 3 + 1];
      eye.z += out[i * 3 + 2] - P[i * 3 + 2];
      eyeN++;
    }
  }
  eye.divideScalar(Math.max(1, eyeN)).add(new THREE.Vector3(eyeX, eyeY, eyeZ));

  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute("position", new THREE.BufferAttribute(out, 3));
  geometry.setAttribute("aRest", new THREE.BufferAttribute(P.slice(), 3));
  geometry.setAttribute("uv", new THREE.BufferAttribute(base.uvs, 2));
  geometry.setAttribute("skinIndex", new THREE.BufferAttribute(base.skinIndex, 4));
  geometry.setAttribute("skinWeight", new THREE.BufferAttribute(base.skinWeight, 4));
  geometry.setAttribute("aRegA", new THREE.BufferAttribute(aRegA, 4));
  geometry.setAttribute("aRegB", new THREE.BufferAttribute(aRegB, 4));
  geometry.setAttribute("aLimb", new THREE.BufferAttribute(aLimb, 4));
  geometry.setIndex(new THREE.BufferAttribute(base.index, 1));
  smoothNormals(geometry, base.topo, base.topoCount);
  geometry.computeBoundingSphere();
  geometry.boundingSphere!.radius *= 1.6; // posed limbs reach further than the bind pose
  return { geometry, boneShift, landmarks, face, eye };
}

/** Normals averaged over welded topology so UV seams don't show. */
export function smoothNormals(geo: THREE.BufferGeometry, topo: Uint32Array, topoCount: number) {
  const pos = geo.getAttribute("position") as THREE.BufferAttribute;
  const idx = geo.index!.array;
  const acc = new Float32Array(topoCount * 3);
  const a = new THREE.Vector3();
  const b = new THREE.Vector3();
  const c = new THREE.Vector3();
  for (let f = 0; f < idx.length; f += 3) {
    const [i, j, k] = [idx[f], idx[f + 1], idx[f + 2]];
    a.fromBufferAttribute(pos, i);
    b.fromBufferAttribute(pos, j).sub(a);
    c.fromBufferAttribute(pos, k).sub(a);
    b.cross(c);
    for (const q of [i, j, k]) {
      const t = topo[q];
      acc[t * 3] += b.x;
      acc[t * 3 + 1] += b.y;
      acc[t * 3 + 2] += b.z;
    }
  }
  const normals = new Float32Array(pos.count * 3);
  for (let i = 0; i < pos.count; i++) {
    const t = topo[i];
    a.set(acc[t * 3], acc[t * 3 + 1], acc[t * 3 + 2]).normalize();
    normals.set([a.x, a.y, a.z], i * 3);
  }
  geo.setAttribute("normal", new THREE.BufferAttribute(normals, 3));
}
