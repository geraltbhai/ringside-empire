/**
 * The shared human base: a CC0 rigged male mesh (Godot Male Base Mesh,
 * github.com/BoQsc/Godot-Male-Base-Mesh) with a full Rigify-style skeleton
 * including three-joint fingers. It is loaded once, turned to face +Z, scaled
 * so a 74 in (1.88 m) wrestler stands on y = 0, and smoothed with two levels of
 * Loop subdivision that carries skin weights and UVs along.
 */
import * as THREE from "three";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";

export interface BoneRest {
  name: string;
  parent: number;
  /** Rest local transform in armature space units (game metres after scaling). */
  position: THREE.Vector3;
  quaternion: THREE.Quaternion;
}

export interface HumanBase {
  /** Smoothed bind-pose geometry, game space (+Z forward, +X = model's left, feet at y = 0, 1.88 m tall). */
  positions: Float32Array;
  normals: Float32Array;
  uvs: Float32Array;
  skinIndex: Uint16Array;
  skinWeight: Float32Array;
  index: Uint32Array;
  /** For each vertex, the welded topology id (UV-seam duplicates share one). */
  topo: Uint32Array;
  topoCount: number;
  bones: BoneRest[];
  boneIndex: Record<string, number>;
}

export const BASE_URL = "/models/base-male.glb";
export const BASE_HEIGHT = 1.88;

let pending: Promise<HumanBase> | null = null;
export function loadHumanBase(): Promise<HumanBase> {
  pending ??= new Promise<HumanBase>((resolve, reject) => {
    new GLTFLoader().load(BASE_URL, (gltf) => resolve(prepare(gltf.scene)), undefined, reject);
  });
  return pending;
}

export function prepare(scene: THREE.Object3D): HumanBase {
  scene.updateMatrixWorld(true);
  let skinned: THREE.SkinnedMesh | null = null;
  scene.traverse((o) => {
    if ((o as THREE.SkinnedMesh).isSkinnedMesh && !skinned) skinned = o as THREE.SkinnedMesh;
  });
  if (!skinned) throw new Error("base mesh has no skinned mesh");
  const mesh = skinned as THREE.SkinnedMesh;
  const geo = mesh.geometry;
  const skel = mesh.skeleton;

  // glb faces +X; turn it to face +Z (−90° about Y) and put the feet on the floor.
  const turn = new THREE.Matrix4().makeRotationY(-Math.PI / 2);
  const pos = geo.getAttribute("position") as THREE.BufferAttribute;
  // Rendered rest positions (bind space → world), exactly as three.js would skin them.
  const world: THREE.Vector3[] = [];
  for (let i = 0; i < pos.count; i++) world.push(mesh.applyBoneTransform(i, new THREE.Vector3().fromBufferAttribute(pos, i)).applyMatrix4(mesh.matrixWorld));
  const box = new THREE.Box3().setFromPoints(world);
  const scale = BASE_HEIGHT / (box.max.y - box.min.y);
  const toGame = new THREE.Matrix4().makeScale(scale, scale, scale).multiply(turn).multiply(new THREE.Matrix4().makeTranslation(0, -box.min.y, 0));

  // Bones: rigid rest world transforms in game space (same space as the vertices), then parent-relative locals.
  const turnQ = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), -Math.PI / 2);
  const boneWorld = skel.bones.map((b) => {
    const p = new THREE.Vector3();
    const q = new THREE.Quaternion();
    b.matrixWorld.decompose(p, q, new THREE.Vector3());
    return new THREE.Matrix4().compose(p.applyMatrix4(toGame), turnQ.clone().multiply(q), new THREE.Vector3(1, 1, 1));
  });
  const boneIndex: Record<string, number> = {};
  skel.bones.forEach((b, i) => (boneIndex[b.name.replace(/\./g, "")] = i));
  const bones: BoneRest[] = skel.bones.map((b, i) => {
    const parent = skel.bones.indexOf(b.parent as THREE.Bone);
    const local = parent >= 0 ? new THREE.Matrix4().copy(boneWorld[parent]).invert().multiply(boneWorld[i]) : boneWorld[i].clone();
    const p = new THREE.Vector3();
    const q = new THREE.Quaternion();
    local.decompose(p, q, new THREE.Vector3());
    return { name: b.name.replace(/\./g, ""), parent, position: p, quaternion: q };
  });

  // Vertex data into game space.
  const n = pos.count;
  const P = new Float32Array(n * 3);
  const v = new THREE.Vector3();
  for (let i = 0; i < n; i++) {
    v.copy(world[i]).applyMatrix4(toGame);
    P.set([v.x, v.y, v.z], i * 3);
  }
  const uvAttr = geo.getAttribute("uv") as THREE.BufferAttribute | undefined;
  const UV = new Float32Array(n * 2);
  if (uvAttr) for (let i = 0; i < n; i++) UV.set([uvAttr.getX(i), uvAttr.getY(i)], i * 2);
  const si = geo.getAttribute("skinIndex") as THREE.BufferAttribute;
  const sw = geo.getAttribute("skinWeight") as THREE.BufferAttribute;
  const SI = new Uint16Array(n * 4);
  const SW = new Float32Array(n * 4);
  for (let i = 0; i < n; i++) for (let k = 0; k < 4; k++) {
    SI[i * 4 + k] = si.getComponent(i, k);
    SW[i * 4 + k] = sw.getComponent(i, k);
  }
  const idx = geo.index ? Array.from(geo.index.array) : Array.from({ length: n }, (_, i) => i);

  let mesh0: TopoMesh = weld(P, UV, SI, SW, idx);
  for (let level = 0; level < 2; level++) mesh0 = loopSubdivide(mesh0);
  return { ...finalize(mesh0), bones, boneIndex };
}

/** Welded mesh: per-topology-vertex positions/weights, per-corner UVs. */
interface TopoMesh {
  pos: number[];
  weights: Map<number, number>[];
  tris: number[]; // topo ids, 3 per face
  cornerUV: number[]; // 6 per face
}

function weld(P: Float32Array, UV: Float32Array, SI: Uint16Array, SW: Float32Array, idx: number[]): TopoMesh {
  const key = (i: number) => `${Math.round(P[i * 3] * 1e5)},${Math.round(P[i * 3 + 1] * 1e5)},${Math.round(P[i * 3 + 2] * 1e5)}`;
  const map = new Map<string, number>();
  const remap: number[] = [];
  const pos: number[] = [];
  const weights: Map<number, number>[] = [];
  for (let i = 0; i < P.length / 3; i++) {
    const k = key(i);
    let t = map.get(k);
    if (t === undefined) {
      t = pos.length / 3;
      map.set(k, t);
      pos.push(P[i * 3], P[i * 3 + 1], P[i * 3 + 2]);
      const w = new Map<number, number>();
      for (let c = 0; c < 4; c++) if (SW[i * 4 + c] > 0) w.set(SI[i * 4 + c], (w.get(SI[i * 4 + c]) ?? 0) + SW[i * 4 + c]);
      weights.push(w);
    }
    remap.push(t);
  }
  const tris: number[] = [];
  const cornerUV: number[] = [];
  for (let f = 0; f < idx.length; f += 3) {
    for (let c = 0; c < 3; c++) {
      tris.push(remap[idx[f + c]]);
      cornerUV.push(UV[idx[f + c] * 2], UV[idx[f + c] * 2 + 1]);
    }
  }
  return { pos, weights, tris, cornerUV };
}

function mixWeights(a: Map<number, number>, b: Map<number, number>, ka: number, kb: number) {
  const out = new Map<number, number>();
  for (const [j, w] of a) out.set(j, (out.get(j) ?? 0) + w * ka);
  for (const [j, w] of b) out.set(j, (out.get(j) ?? 0) + w * kb);
  return out;
}

function loopSubdivide(m: TopoMesh): TopoMesh {
  const nv = m.pos.length / 3;
  const ekey = (a: number, b: number) => (a < b ? a * 1_000_003 + b : b * 1_000_003 + a);
  const edges = new Map<number, { a: number; b: number; opp: number[]; id: number }>();
  const nbrs: Set<number>[] = Array.from({ length: nv }, () => new Set());
  for (let f = 0; f < m.tris.length; f += 3) {
    for (let c = 0; c < 3; c++) {
      const a = m.tris[f + c];
      const b = m.tris[f + ((c + 1) % 3)];
      const o = m.tris[f + ((c + 2) % 3)];
      const k = ekey(a, b);
      let e = edges.get(k);
      if (!e) {
        e = { a, b, opp: [], id: -1 };
        edges.set(k, e);
      }
      e.opp.push(o);
      nbrs[a].add(b);
      nbrs[b].add(a);
    }
  }
  const boundaryNbrs: number[][] = Array.from({ length: nv }, () => []);
  for (const e of edges.values()) if (e.opp.length === 1) {
    boundaryNbrs[e.a].push(e.b);
    boundaryNbrs[e.b].push(e.a);
  }
  const pos: number[] = [];
  const weights: Map<number, number>[] = [];
  const P = (i: number, c: number) => m.pos[i * 3 + c];
  // updated old vertices
  for (let i = 0; i < nv; i++) {
    const out = [0, 0, 0];
    if (boundaryNbrs[i].length >= 2) {
      const [x, y] = boundaryNbrs[i];
      for (let c = 0; c < 3; c++) out[c] = 0.75 * P(i, c) + 0.125 * (P(x, c) + P(y, c));
    } else {
      const ns = [...nbrs[i]];
      const k = ns.length;
      const beta = k === 3 ? 3 / 16 : 3 / (8 * k);
      for (let c = 0; c < 3; c++) out[c] = (1 - k * beta) * P(i, c) + beta * ns.reduce((s, j) => s + P(j, c), 0);
    }
    pos.push(...out);
    weights.push(m.weights[i]);
  }
  // edge vertices
  for (const e of edges.values()) {
    e.id = pos.length / 3;
    for (let c = 0; c < 3; c++) {
      if (e.opp.length === 2) pos.push(0.375 * (P(e.a, c) + P(e.b, c)) + 0.125 * (P(e.opp[0], c) + P(e.opp[1], c)));
      else pos.push(0.5 * (P(e.a, c) + P(e.b, c)));
    }
    weights.push(mixWeights(m.weights[e.a], m.weights[e.b], 0.5, 0.5));
  }
  const tris: number[] = [];
  const cornerUV: number[] = [];
  for (let f = 0; f < m.tris.length; f += 3) {
    const [a, b, c] = [m.tris[f], m.tris[f + 1], m.tris[f + 2]];
    const uv = (k: number) => [m.cornerUV[(f + k) * 2], m.cornerUV[(f + k) * 2 + 1]];
    const mid = (k1: number, k2: number) => {
      const [u1, v1] = uv(k1);
      const [u2, v2] = uv(k2);
      return [(u1 + u2) / 2, (v1 + v2) / 2];
    };
    const ab = edges.get(ekey(a, b))!.id;
    const bc = edges.get(ekey(b, c))!.id;
    const ca = edges.get(ekey(c, a))!.id;
    const [uA, uB, uC, uAB, uBC, uCA] = [uv(0), uv(1), uv(2), mid(0, 1), mid(1, 2), mid(2, 0)];
    tris.push(a, ab, ca, ab, b, bc, ca, bc, c, ab, bc, ca);
    cornerUV.push(...uA, ...uAB, ...uCA, ...uAB, ...uB, ...uBC, ...uCA, ...uBC, ...uC, ...uAB, ...uBC, ...uCA);
  }
  return { pos, weights, tris, cornerUV };
}

function finalize(m: TopoMesh) {
  const ntopo = m.pos.length / 3;
  // smooth normals on the welded topology
  const tn = new Float32Array(ntopo * 3);
  const a = new THREE.Vector3();
  const b = new THREE.Vector3();
  const c = new THREE.Vector3();
  for (let f = 0; f < m.tris.length; f += 3) {
    const [i, j, k] = [m.tris[f], m.tris[f + 1], m.tris[f + 2]];
    a.fromArray(m.pos, i * 3);
    b.fromArray(m.pos, j * 3).sub(a);
    c.fromArray(m.pos, k * 3).sub(a);
    b.cross(c);
    for (const t of [i, j, k]) {
      tn[t * 3] += b.x;
      tn[t * 3 + 1] += b.y;
      tn[t * 3 + 2] += b.z;
    }
  }
  const map = new Map<string, number>();
  const positions: number[] = [];
  const normals: number[] = [];
  const uvs: number[] = [];
  const skinIndex: number[] = [];
  const skinWeight: number[] = [];
  const topo: number[] = [];
  const index: number[] = [];
  for (let f = 0; f < m.tris.length; f++) {
    const t = m.tris[f];
    const u = m.cornerUV[f * 2];
    const v = m.cornerUV[f * 2 + 1];
    const k = `${t}|${Math.round(u * 1e5)}|${Math.round(v * 1e5)}`;
    let id = map.get(k);
    if (id === undefined) {
      id = positions.length / 3;
      map.set(k, id);
      positions.push(m.pos[t * 3], m.pos[t * 3 + 1], m.pos[t * 3 + 2]);
      a.set(tn[t * 3], tn[t * 3 + 1], tn[t * 3 + 2]).normalize();
      normals.push(a.x, a.y, a.z);
      uvs.push(u, v);
      const top = [...m.weights[t].entries()].sort((x, y) => y[1] - x[1]).slice(0, 4);
      const sum = top.reduce((s, [, w]) => s + w, 0) || 1;
      for (let q = 0; q < 4; q++) {
        skinIndex.push(top[q]?.[0] ?? 0);
        skinWeight.push((top[q]?.[1] ?? 0) / sum);
      }
      topo.push(t);
    }
    index.push(id);
  }
  return {
    positions: new Float32Array(positions),
    normals: new Float32Array(normals),
    uvs: new Float32Array(uvs),
    skinIndex: new Uint16Array(skinIndex),
    skinWeight: new Float32Array(skinWeight),
    index: new Uint32Array(index),
    topo: new Uint32Array(topo),
    topoCount: ntopo,
  };
}
