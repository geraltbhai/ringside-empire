/**
 * Per-wrestler sculpt of the shared MakeHuman base.
 *
 * 1. Morphs: MakeHuman's anatomical targets (macro build, race structure,
 *    face and body details) are mixed from the wrestler's appearance, so jaw,
 *    chin, nose, brow, cheeks, head shape, pecs, lats, arms and legs come from
 *    real anatomy rather than hand-made bumps.
 * 2. Hypertrophy: wrestlers are bigger than any civilian body, so a lighter
 *    procedural layer adds radial bulk and definition per body segment
 *    (cylindrical coordinates t along the bone, φ around it, φ = 0 front and
 *    +π/2 the model's left), blended by skin weight so joints stay seamless.
 * 3. Gear volume: pants, boots, pads, gloves.
 * Joints follow the reshaped skin, and the paint coordinates for the
 * skin/gear shader are written alongside.
 */
import * as THREE from "three";
import { faceFor } from "@/engine/appearance";
import { hashString } from "@/engine/rng";
import type { Appearance, FaceShape } from "@/engine/types";
import type { HumanBase } from "./base";

export { faceFor };

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
  /** Parent-relative rest offsets for bones so joints follow the reshaped body. */
  boneShift: Map<number, THREE.Vector3>;
  landmarks: Landmarks;
  face: FaceShape;
  /** Final displacement of every topology vertex (parts bound to the body follow it). */
  topoDisp: Float32Array;
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
const clamp = (v: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, v));

/** Rest world positions of every bone. */
export function restBonePositions(base: Pick<HumanBase, "bones">) {
  const world: THREE.Matrix4[] = [];
  base.bones.forEach((b, i) => {
    const local = new THREE.Matrix4().compose(b.position, b.quaternion, new THREE.Vector3(1, 1, 1));
    world[i] = b.parent >= 0 ? new THREE.Matrix4().multiplyMatrices(world[b.parent], local) : local;
  });
  return world.map((m) => new THREE.Vector3().setFromMatrixPosition(m));
}

/** Morph weights for a wrestler: build from the body sliders, face from the face sliders and the id. */
export function morphWeights(a: Appearance, face: FaceShape, id: string, age = 30) {
  const w: Record<string, number> = {};
  const bi = (name: string, s: number) => {
    if (s > 0) w[`${name}+`] = (w[`${name}+`] ?? 0) + s;
    else if (s < 0) w[`${name}-`] = (w[`${name}-`] ?? 0) - s;
  };
  const m = a.muscle;
  const f = a.bodyFat;
  const b = a.bulk;
  const armK = 0.8 + a.armSize * 0.4;
  const legK = 0.82 + a.legSize * 0.36;
  const def = a.definition * (1 - f * 0.8);
  // macro build: wrestlers sit past MakeHuman's most muscular setting
  bi("muscle", m > 0.4 ? (m - 0.4) * 2.4 : (m - 0.4) * 1.5);
  bi("weight", f > 0.2 ? (f - 0.2) * 1.5 : (f - 0.2) * 2.5);
  w["proportions+"] = 0.55 + b * 0.35;
  if (age > 34) w["age+"] = clamp((age - 34) / 30, 0, 0.8);
  // race structure: a stable per-wrestler mix gives every face its own bone structure
  const h = hashString(`${id}:race`);
  const r = [((h >>> 0) % 1000) / 1000, ((h >>> 10) % 1000) / 1000, ((h >>> 20) % 1000) / 1000];
  const rs = r[0] + r[1] + r[2] || 1;
  w.race_african = (r[0] / rs) * 0.65;
  w.race_asian = (r[1] / rs) * 0.65;
  w.race_caucasian = (r[2] / rs) * 0.65;
  // body details
  bi("pecs", m * 1.3 - 0.1);
  bi("lats", m * 1.3 + (a.shoulderWidth - 0.5));
  bi("vshape", clamp(m * 1.2 + (a.shoulderWidth - 0.5) * 1.6 - f * 0.9, -1, 1.6));
  // wrestlers carry their mass up top: broad shoulders, big chest, narrower hips
  bi("shoulders", 0.4 + (a.shoulderWidth - 0.5) * 1.4 + b * 0.3 + m * 0.3);
  bi("chest", m * 0.7 + b * 0.4 + f * 0.3 - 0.2);
  bi("waist", f * 1.7 + b * 0.3 - 0.75);
  bi("belly", f > 0.3 ? (f - 0.3) * 2 : 0);
  bi("abs", def * 1.2 - 0.2);
  bi("glutes", m * 0.35 + f * 0.4 - 0.25);
  bi("biceps", m * armK * 1.4 - 0.2);
  bi("delts", m * 1.4 + b * 0.2 - 0.2);
  bi("forearms", m * armK * 1.1 - 0.1);
  bi("armFat", f * 0.9 - 0.15);
  bi("thighs", m * legK * 0.75 - 0.1);
  bi("thighFat", f * 0.8 - 0.25);
  bi("calves", m * legK * 0.7);
  bi("neck", m * 1.1 + b * 0.5 - 0.1);
  if (f > 0.4) w.neckDouble = (f - 0.4) * 1.6;
  // face: sliders first, then stable per-wrestler variety
  const fc = (x: number) => (x - 0.5) * 2;
  const hf = hashString(`${id}:features`);
  const rf = (shift: number) => (((hf >>> shift) % 1000) / 1000 - 0.5) * 2; // −1..1
  // a lean, angular, adult male face by default: defined jaw angle, strong chin, high cheekbones
  bi("jaw", fc(face.jaw) * 0.9 + b * 0.25);
  bi("jawBones", fc(face.jaw) * 0.6 + 0.55);
  bi("chin", fc(face.chin) * 1.0 + 0.3);
  bi("chinHeight", rf(1) * 0.6);
  bi("browDepth", fc(face.brow) * 0.8 + 0.55);
  bi("browAngle", rf(3) * 0.6 - 0.2);
  bi("noseSize", fc(face.nose) * 0.9);
  bi("noseHump", rf(5) * 0.8);
  bi("noseFlare", rf(7) * 0.7);
  bi("noseTip", rf(9) * 0.6);
  bi("cheekBones", fc(face.cheeks) * 0.9 + 0.3);
  bi("cheekVolume", f * 1.1 - 0.6);
  bi("headWidth", fc(face.width) * 0.55 - 0.35);
  bi("headLength", fc(face.length) * 0.7 + 0.2);
  bi("headDepth", rf(11) * 0.4);
  bi("headFat", f * 1.3 - 0.6);
  bi("eyeSize", rf(13) * 0.4 - 0.05);
  bi("eyeOpen", rf(15) * 0.4 - 0.2);
  bi("eyeBags", (age - 32) / 30);
  bi("mouthWidth", rf(17) * 0.6);
  bi("lips", rf(19) * 0.7);
  bi("ears", rf(21) * 0.5);
  bi("temples", rf(23) * 0.5);
  bi("forehead", rf(25) * 0.5);
  // one or two head shapes, leaning square for strong jaws
  const shapes = ["square", "oval", "rectangular"];
  w[`head_${shapes[hf % shapes.length]}`] = 0.45;
  w.head_square = (w.head_square ?? 0) + Math.max(0, fc(face.jaw)) * 0.6;
  return w;
}

export function sculptWrestler(base: HumanBase, a: Appearance, id: string, age = 30): Sculpted {
  const bonesW = restBonePositions(base);
  const B = (n: string) => bonesW[base.boneIndex[n]];
  const bi = base.boneIndex;
  const face = faceFor(id, a);

  const m = a.muscle;
  const def = a.definition;
  const f = a.bodyFat;
  const b = a.bulk;
  const armK = 0.8 + a.armSize * 0.4;
  const legK = 0.82 + a.legSize * 0.36;
  const cut = def * (1 - f * 0.85);

  // ── 1. Morphs on the topology ──
  const T = base.topoCount;
  const topoRest = new Float32Array(T * 3);
  for (let t = 0; t < T; t++) {
    const i = base.topoFirst[t];
    topoRest[t * 3] = base.positions[i * 3];
    topoRest[t * 3 + 1] = base.positions[i * 3 + 1];
    topoRest[t * 3 + 2] = base.positions[i * 3 + 2];
  }
  const morphDisp = new Float32Array(T * 3);
  for (const [name, weight] of Object.entries(morphWeights(a, face, id, age))) {
    const mo = base.morphs[name];
    if (!mo || Math.abs(weight) < 1e-3) continue;
    for (let k = 0; k < mo.indices.length; k++) {
      const t = mo.indices[k];
      morphDisp[t * 3] += mo.deltas[k * 3] * weight;
      morphDisp[t * 3 + 1] += mo.deltas[k * 3 + 1] * weight;
      morphDisp[t * 3 + 2] += mo.deltas[k * 3 + 2] * weight;
    }
  }

  // ── Landmarks (rest space; the shader paints in rest coordinates) ──
  const P = base.positions;
  let headTop = 0;
  for (let i = 1; i < P.length; i += 3) headTop = Math.max(headTop, P[i]);
  const eyes = base.parts.eyes;
  let ex = 0;
  let ey = 0;
  let ez = -1;
  let en = 0;
  if (eyes) {
    for (let i = 0; i < eyes.positions.length; i += 3) {
      if (eyes.positions[i] <= 0) continue;
      ex += eyes.positions[i];
      ey += eyes.positions[i + 1];
      ez = Math.max(ez, eyes.positions[i + 2]);
      en++;
    }
  }
  const eyeX = en ? ex / en : 0.032;
  const eyeY = en ? ey / en : headTop - 0.11;
  const eyeZ = en ? ez : 0.1;
  // chin: lowest front-centre point of the head
  let chinY = eyeY - 0.12;
  for (let i = 0; i < P.length; i += 3) {
    if (Math.abs(P[i]) < 0.012 && P[i + 2] > eyeZ - 0.035 && P[i + 1] < eyeY - 0.05 && P[i + 1] > eyeY - 0.2) chinY = Math.min(chinY, P[i + 1]);
  }
  const mouthY = chinY + (eyeY - chinY) * 0.39;
  const neckY = B("spine004").y;
  const pelvisY = B("spine").y;
  const chestY = B("spine003").y + (neckY - B("spine003").y) * 0.35;

  const landmarks: Landmarks = {
    headTop,
    eyeY,
    eyeX,
    eyeZ,
    mouthY,
    chinY,
    neckY,
    chestY,
    navelY: pelvisY + (chestY - pelvisY) * 0.38,
    pelvisY,
    kneeY: B("shinL").y,
    ankleY: B("footL").y,
    armA: [B("upper_armL").clone(), B("upper_armR").clone()],
    armB: [B("handL").clone(), B("handR").clone()],
  };

  // ── 2. Hypertrophy segments ──
  type Seg = { a: THREE.Vector3; b: THREE.Vector3; bones: number[]; shape: (t: number, phi: number) => { kx: number; kz: number; k: number; bump: number } };
  const bones = (...names: string[]) => names.map((n) => bi[n]).filter((x) => x != null);
  const fingers = (s: string) => ["f_index", "f_middle", "f_ring", "f_pinky"].flatMap((n) => [1, 2, 3].map((j) => `${n}0${j}${s}`)).concat([1, 2, 3].map((j) => `thumb0${j}${s}`));

  const absA = (0.002 + def * 0.006) * (1 - f * 0.9);
  const torsoBumps: Bump[] = [
    // pec shelf and sternum line on top of MakeHuman's pectorals
    { t: 0.68, phi: 0.5, st: 0.07, stBelow: 0.025, sp: 0.42, a: m * 0.012 },
    { t: 0.68, phi: -0.5, st: 0.07, stBelow: 0.025, sp: 0.42, a: m * 0.012 },
    { t: 0.68, phi: 0, st: 0.12, sp: 0.06, a: -(0.002 + m * 0.006) },
    // six-pack and linea alba
    ...[0.5, 0.41, 0.32, 0.23].flatMap((t, i) => [0.19, -0.19].map((phi) => ({ t, phi, st: 0.034, sp: 0.11, a: absA * (i === 3 ? 0.6 : 1) }))),
    { t: 0.36, phi: 0, st: 0.22, sp: 0.045, a: -def * 0.003 * (1 - f * 0.8) },
    // serratus
    ...[0.52, 0.58].flatMap((t) => [0.98, -0.98].map((phi) => ({ t, phi, st: 0.02, sp: 0.1, a: cut * m * 0.003 }))),
    // traps up to the neck
    { t: 0.95, phi: 1.2, st: 0.06, sp: 0.5, a: m * 0.018 + b * 0.005 },
    { t: 0.95, phi: -1.2, st: 0.06, sp: 0.5, a: m * 0.018 + b * 0.005 },
    { t: 0.92, phi: Math.PI, st: 0.07, sp: 0.9, a: m * 0.012 },
  ];
  // MakeHuman's morphs carry the build; this only adds a wrestler's extra upper-body mass (V-taper, not a barrel)
  const torsoKx = curve([
    [0, 1.0 + 0.02 * b],
    [0.3, 1.0 + 0.02 * b],
    [0.7, 1.01 + 0.06 * m + 0.03 * b],
    [0.92, 1.01 + 0.07 * m + 0.03 * b],
    [1, 1.0 + 0.08 * m],
  ]);
  const torsoKz = curve([
    [0, 1.0 + 0.02 * b],
    [0.3, 1.0 + 0.02 * b],
    [0.7, 1.01 + 0.04 * m + 0.02 * b],
    [1, 1.0 + 0.05 * m],
  ]);
  const armShape = (side: 1 | -1) => (t: number, phi: number) => ({
    kx: 1,
    kz: 1,
    k: curve([
      [0, 1.04 + 0.12 * m + 0.05 * b],
      [0.45, 1.03 + 0.22 * m * armK + 0.06 * b],
      [1, 1.02 + 0.1 * m * armK + 0.04 * b],
    ])(t),
    bump: bumpField(
      [
        { t: 0.52, phi: 0.1 * side, st: 0.15, sp: 0.6, a: m * 0.01 * armK },
        { t: 0.42, phi: Math.PI, st: 0.2, sp: 0.8, a: m * 0.008 * armK },
        { t: 0.1, phi: Math.PI / 2, st: 0.12, sp: 0.9, a: m * 0.01 + b * 0.003 },
      ],
      t,
      phi,
    ),
  });
  const foreShape = (t: number) => ({
    kx: 1,
    kz: 1,
    k: curve([
      [0, 1.03 + 0.16 * m * armK + 0.05 * b],
      [1, 1.02 + 0.06 * m + 0.03 * b],
    ])(t),
    bump: 0,
  });
  const handShape = () => ({ kx: 1, kz: 1, k: 1.04 + 0.06 * m + 0.06 * b, bump: 0 });
  const thighShape = (side: 1 | -1) => (t: number, phi: number) => ({
    kx: 1,
    kz: 1,
    k: curve([
      [0, 1.0 + 0.02 * b],
      [0.45, 1.01 + 0.05 * m * legK + 0.03 * b],
      [1, 1.01 + 0.03 * m + 0.02 * b],
    ])(t),
    bump: bumpField(
      [
        { t: 0.82, phi: -side * 0.5, st: 0.07, sp: 0.35, a: m * 0.008 * (0.5 + def * 0.5) * legK },
        { t: 0.5, phi: side * 0.95, st: 0.2, sp: 0.45, a: m * 0.008 * legK },
      ],
      t,
      phi,
    ),
  });
  const shinShape = (t: number, phi: number) => ({
    kx: 1,
    kz: 1,
    k: curve([
      [0, 1.02 + 0.06 * m + 0.03 * b],
      [0.35, 1.02 + 0.08 * m + 0.04 * b],
      [1, 1.0 + 0.02 * b],
    ])(t),
    bump: bumpField(
      [
        { t: 0.3, phi: Math.PI - 0.4, st: 0.1, stBelow: 0.15, sp: 0.4, a: m * 0.008 * legK },
        { t: 0.3, phi: Math.PI + 0.4, st: 0.1, stBelow: 0.15, sp: 0.4, a: m * 0.008 * legK },
      ],
      t,
      phi,
    ),
  });

  const segs: Seg[] = [
    { a: B("spine"), b: B("spine004"), bones: bones("spine", "spine001", "spine002", "spine003", "shoulderL", "shoulderR"), shape: (t, phi) => ({ kx: torsoKx(t), kz: torsoKz(t), k: 1, bump: bumpField(torsoBumps, t, phi) }) },
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

  const n = P.length / 3;
  const out = new Float32Array(P.length);
  const aRegA = new Float32Array(n * 4); // torso, head, upper arm, forearm
  const aRegB = new Float32Array(n * 4); // hand, thigh, shin, foot
  const aLimb = new Float32Array(n * 4); // t along arm (0 shoulder..1 wrist, hand >1) or −1−t on legs, cos φ, sin φ, side
  const v = new THREE.Vector3();
  const vr = new THREE.Vector3();
  const nrm = new THREE.Vector3();
  const rel = new THREE.Vector3();
  const axis = new THREE.Vector3();
  const fwd = new THREE.Vector3();
  const sideV = new THREE.Vector3();
  const disp = new THREE.Vector3();
  const Z = new THREE.Vector3(0, 0, 1);
  const segW = new Float32Array(segs.length);
  const outfit = a.outfit;
  const fullLegs = outfit === "tights" || outfit === "pants" || outfit === "bodysuit";
  // bigger heads and hands on bigger bodies so they read at camera distance
  const headScale = 0.012 + b * 0.02 + m * 0.01;
  // wrestler necks: thick, flowing into the traps
  const neckK = 1.1 + 0.32 * m + 0.16 * b + 0.08 * f;
  const headPivot = B("spine004");
  // final displacement per topology vertex (written once; UV-seam duplicates must read morphDisp, not this)
  const topoDisp = new Float32Array(T * 3);
  const done = new Uint8Array(T);

  for (let i = 0; i < n; i++) {
    const topo = base.topo[i];
    vr.fromArray(P, i * 3);
    v.set(vr.x + morphDisp[topo * 3], vr.y + morphDisp[topo * 3 + 1], vr.z + morphDisp[topo * 3 + 2]);
    nrm.fromArray(base.normals, i * 3);
    segW.fill(0);
    let headW = 0;
    disp.set(0, 0, 0);
    for (let k = 0; k < 4; k++) {
      const bn = base.skinIndex[i * 4 + k];
      const w = base.skinWeight[i * 4 + k];
      if (w <= 0) continue;
      const s = segOf.get(bn);
      if (s != null) segW[s] += w;
      if (headBones.has(bn)) headW += w;
    }
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
      // shape from rest coordinates (stable), applied to the morphed position
      rel.subVectors(vr, seg.a);
      const along = rel.dot(axis);
      const t = along / L;
      rel.addScaledVector(axis, -along);
      fwd.copy(Z).addScaledVector(axis, -axis.dot(Z));
      if (fwd.lengthSq() < 1e-4) fwd.set(0, 1, 0);
      fwd.normalize();
      sideV.crossVectors(fwd, axis).normalize();
      const phi = Math.atan2(rel.dot(sideV), rel.dot(fwd));
      const sh = seg.shape(clamp(t, 0, 1), phi);
      // radial direction of the morphed vertex
      rel.subVectors(v, seg.a);
      rel.addScaledVector(axis, -rel.dot(axis));
      if (s === 0) {
        disp.x += w * (sh.kx - 1) * rel.x;
        disp.z += w * (sh.kz - 1) * rel.z;
      } else disp.addScaledVector(rel, w * (sh.k - 1));
      disp.addScaledVector(nrm, w * sh.bump);
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
        limbT = s >= 9 ? 0.5 + t * 0.5 : t * 0.5;
        limbPhi = phi;
        limbSide = s % 2 === 1 ? 1 : -1;
        limbIsLeg = 1;
      }
    }
    if (headW > 0.002) {
      const below = 1 - smooth(chinY - 0.035, chinY + 0.0, vr.y);
      disp.x += headW * below * (neckK - 1) * (v.x - headPivot.x);
      disp.z += headW * below * (neckK - 1) * 0.9 * (v.z - headPivot.z - 0.01);
      const above = smooth(chinY - 0.03, chinY + 0.02, vr.y);
      disp.x += headW * above * headScale * (v.x - headPivot.x);
      disp.y += headW * above * headScale * (v.y - chinY);
      disp.z += headW * above * headScale * (v.z - headPivot.z);
    }

    // ── 3. Gear volume ──
    const thighW = segW[7] + segW[8];
    const shinW = segW[9] + segW[10];
    if (outfit === "pants") {
      const legMask = (thighW + shinW) * smooth(0.06, 0.14, vr.y);
      disp.addScaledVector(nrm, legMask * (0.008 + 0.004 * Math.sin(vr.y * 40 + vr.x * 30)));
    }
    if (fullLegs && outfit !== "pants") disp.addScaledVector(nrm, (thighW + shinW) * 0.0015);
    const ankle = landmarks.ankleY;
    const bootTop = ankle + (landmarks.kneeY - ankle) * 0.55;
    if (vr.y < bootTop) disp.addScaledVector(nrm, 0.006 * smooth(bootTop, bootTop - 0.02, vr.y));
    if (a.kneepads) disp.addScaledVector(nrm, (thighW + shinW) * 0.013 * gauss(vr.y - landmarks.kneeY, 0.03) * smooth(-0.3, 0.6, Math.cos(limbPhi)));
    if (a.elbowPads && limbIsLeg === 0 && limbSide !== 0) disp.addScaledVector(nrm, 0.008 * gauss(limbT - 0.5, 0.05) * smooth(-0.2, 0.6, -Math.cos(limbPhi)));
    if (a.gloves && limbT > 0.97 && limbIsLeg === 0) disp.addScaledVector(nrm, 0.003);

    out[i * 3] = v.x + disp.x;
    out[i * 3 + 1] = v.y + disp.y;
    out[i * 3 + 2] = v.z + disp.z;
    if (!done[topo]) {
      done[topo] = 1;
      topoDisp[topo * 3] = out[i * 3] - vr.x;
      topoDisp[topo * 3 + 1] = out[i * 3 + 1] - vr.y;
      topoDisp[topo * 3 + 2] = out[i * 3 + 2] - vr.z;
    }
    aRegA.set([segW[0], headW, segW[1] + segW[2], segW[3] + segW[4]], i * 4);
    aRegB.set([segW[5] + segW[6], thighW, shinW, Math.max(0, 1 - segW.reduce((s2, x) => s2 + x, 0) - headW)], i * 4);
    aLimb.set([limbIsLeg ? -1 - limbT : limbT, Math.cos(limbPhi), Math.sin(limbPhi), limbSide], i * 4);
  }

  // ── Boots: smooth the toes and arch into a boot shape (unless barefoot) ──
  if ((a.bootStyle ?? "boots") !== "barefoot") {
    const ankle = landmarks.ankleY;
    const foot: number[] = [];
    const wgt = new Float32Array(T);
    for (let t = 0; t < T; t++) {
      const y = topoRest[t * 3 + 1];
      if (y < ankle + 0.07 && Math.abs(topoRest[t * 3]) > 0.04) {
        foot.push(t);
        wgt[t] = smooth(ankle + 0.07, ankle + 0.01, y);
      }
    }
    const pos = (t: number, c: number) => topoRest[t * 3 + c] + topoDisp[t * 3 + c];
    const next = new Float32Array(T * 3);
    for (let it = 0; it < 30; it++) {
      for (const t of foot) {
        let sx = 0;
        let sy = 0;
        let sz = 0;
        let cnt = 0;
        for (let k = base.adjStart[t]; k < base.adjStart[t + 1]; k++) {
          const nb = base.adj[k];
          sx += pos(nb, 0);
          sy += pos(nb, 1);
          sz += pos(nb, 2);
          cnt++;
        }
        const k = wgt[t] * 0.75;
        next[t * 3] = pos(t, 0) + (sx / cnt - pos(t, 0)) * k;
        next[t * 3 + 1] = pos(t, 1) + (sy / cnt - pos(t, 1)) * k;
        next[t * 3 + 2] = pos(t, 2) + (sz / cnt - pos(t, 2)) * k;
      }
      for (const t of foot) {
        topoDisp[t * 3] = next[t * 3] - topoRest[t * 3];
        // keep the sole on the floor
        topoDisp[t * 3 + 1] = Math.max(next[t * 3 + 1], topoRest[t * 3 + 1] < 0.015 ? topoRest[t * 3 + 1] : 0.004) - topoRest[t * 3 + 1];
        topoDisp[t * 3 + 2] = next[t * 3 + 2] - topoRest[t * 3 + 2];
      }
    }
    // smoothing shrinks; give the boot back its volume
    for (const t of foot) {
      const i = base.topoFirst[t];
      const w2 = wgt[t] * 0.005;
      topoDisp[t * 3] += base.normals[i * 3] * w2;
      topoDisp[t * 3 + 2] += base.normals[i * 3 + 2] * w2;
    }
    for (let i = 0; i < n; i++) {
      const t = base.topo[i];
      if (wgt[t] <= 0) continue;
      out[i * 3] = topoRest[t * 3] + topoDisp[t * 3];
      out[i * 3 + 1] = topoRest[t * 3 + 1] + topoDisp[t * 3 + 1];
      out[i * 3 + 2] = topoRest[t * 3 + 2] + topoDisp[t * 3 + 2];
    }
  }

  // ── Joints follow the skin: each bone moves with the skin around its head ──
  const absShift = bonesW.map((head, bIdx) => {
    const name = base.bones[bIdx].name;
    if (/^(f_|thumb)/.test(name)) return null; // fingers ride on the hand
    const s = new THREE.Vector3();
    let wsum = 0;
    const r = name.startsWith("spine") ? 0.09 : 0.06;
    for (let t = 0; t < T; t++) {
      const dx = topoRest[t * 3] - head.x;
      const dy = topoRest[t * 3 + 1] - head.y;
      const dz = topoRest[t * 3 + 2] - head.z;
      const d2 = dx * dx + dy * dy + dz * dz;
      if (d2 > r * r) continue;
      const w = 1 - Math.sqrt(d2) / r;
      s.x += topoDisp[t * 3] * w;
      s.y += topoDisp[t * 3 + 1] * w;
      s.z += topoDisp[t * 3 + 2] * w;
      wsum += w;
    }
    return wsum > 0 ? s.divideScalar(wsum) : new THREE.Vector3();
  });
  const resolved = absShift.map((s, i) => {
    let k = i;
    while (!s && base.bones[k].parent >= 0) {
      k = base.bones[k].parent;
      s = absShift[k];
    }
    return s ?? new THREE.Vector3();
  });
  const boneShift = new Map<number, THREE.Vector3>();
  base.bones.forEach((bn, i) => {
    const rel2 = bn.parent >= 0 ? resolved[i].clone().sub(resolved[bn.parent]) : resolved[i].clone();
    if (rel2.lengthSq() > 1e-8) boneShift.set(i, rel2);
  });

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
  // baked occlusion and surface curvature (muscle separations read as shadow, ridges catch light)
  const nrmA = geometry.getAttribute("normal") as THREE.BufferAttribute;
  const cavT = new Float32Array(T);
  for (let t = 0; t < T; t++) {
    const i = base.topoFirst[t];
    let sx = 0;
    let sy = 0;
    let sz = 0;
    let el = 0;
    const cnt = base.adjStart[t + 1] - base.adjStart[t];
    if (!cnt) continue;
    for (let k = base.adjStart[t]; k < base.adjStart[t + 1]; k++) {
      const j = base.topoFirst[base.adj[k]];
      sx += out[j * 3] - out[i * 3];
      sy += out[j * 3 + 1] - out[i * 3 + 1];
      sz += out[j * 3 + 2] - out[i * 3 + 2];
      el += Math.hypot(out[j * 3] - out[i * 3], out[j * 3 + 1] - out[i * 3 + 1], out[j * 3 + 2] - out[i * 3 + 2]);
    }
    // positive = concave (a crease), negative = convex (a bulge)
    cavT[t] = ((sx * nrmA.getX(i) + sy * nrmA.getY(i) + sz * nrmA.getZ(i)) / cnt) / Math.max(1e-4, el / cnt);
  }
  // one smoothing pass so the shading follows muscle groups, not single triangles
  const cavS = new Float32Array(T);
  for (let t = 0; t < T; t++) {
    let s2 = cavT[t] * 2;
    let c2 = 2;
    for (let k = base.adjStart[t]; k < base.adjStart[t + 1]; k++) {
      s2 += cavT[base.adj[k]];
      c2++;
    }
    cavS[t] = s2 / c2;
  }
  const aShade = new Float32Array(n * 2);
  for (let i = 0; i < n; i++) {
    const t = base.topo[i];
    aShade[i * 2] = base.ao ? base.ao[t] : 1;
    aShade[i * 2 + 1] = cavS[t];
  }
  geometry.setAttribute("aShade", new THREE.BufferAttribute(aShade, 2));
  geometry.computeBoundingSphere();
  geometry.boundingSphere!.radius *= 1.6;
  return { geometry, boneShift, landmarks, face, topoDisp };
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
