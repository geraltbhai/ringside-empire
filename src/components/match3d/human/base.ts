/**
 * The shared human base, baked from MakeHuman (CC0) by scripts/blender/bake_human.py:
 * a 13k-vertex male body on the "game_engine" skeleton (fingers included), 100
 * sparse anatomical morphs (macro build, race structure, face and body details),
 * and fitted parts (eyes, brows, lashes, hair). Loaded once from
 * /models/human.bin, scaled so a 74 in (1.88 m) wrestler stands on y = 0.
 */
import * as THREE from "three";

export interface BoneRest {
  name: string;
  parent: number;
  /** Rest local transform relative to the parent bone (game metres). */
  position: THREE.Vector3;
  quaternion: THREE.Quaternion;
}

export interface Morph {
  name: string;
  /** Topology vertex ids and their deltas (metres). */
  indices: Uint16Array;
  deltas: Float32Array;
}

export interface Part {
  name: string;
  kind: string;
  positions: Float32Array;
  uvs: Float32Array;
  index: Uint32Array;
  /** Nearest body topology vertex for each part vertex (follows morphs, sculpt and skinning). */
  bind: Uint32Array;
  topo: Uint32Array;
  topoCount: number;
}

export interface HumanBase {
  /** Bind-pose geometry, game space (+Z forward, +X = model's left, feet at y = 0, 1.88 m tall). */
  positions: Float32Array;
  normals: Float32Array;
  uvs: Float32Array;
  skinIndex: Uint16Array;
  skinWeight: Float32Array;
  index: Uint32Array;
  /** For each vertex, the welded topology id (UV-seam duplicates share one). */
  topo: Uint32Array;
  topoCount: number;
  /** One render vertex per topology vertex (for looking up per-topology data). */
  topoFirst: Uint32Array;
  /** Topology adjacency in CSR form: neighbours of t are adj[adjStart[t] .. adjStart[t + 1]). */
  adjStart: Uint32Array;
  adj: Uint32Array;
  /** Baked ambient occlusion per topology vertex (1 = open), filled in by the asset loader. */
  ao: Float32Array | null;
  bones: BoneRest[];
  boneIndex: Record<string, number>;
  morphs: Record<string, Morph>;
  parts: Record<string, Part>;
  textures: Record<string, string>;
}

export const BASE_URL = "/models/human.bin";
export const BASE_HEIGHT = 1.88;

let pending: Promise<HumanBase> | null = null;
export function loadHumanBase(): Promise<HumanBase> {
  pending ??= fetch(BASE_URL)
    .then((r) => {
      if (!r.ok) throw new Error(`human base: HTTP ${r.status}`);
      return r.arrayBuffer();
    })
    .then(parseHumanBase);
  return pending;
}

interface Accessor {
  offset: number;
  count: number;
  type: string;
}

export function parseHumanBase(buf: ArrayBuffer): HumanBase {
  const dv = new DataView(buf);
  if (String.fromCharCode(dv.getUint8(0), dv.getUint8(1), dv.getUint8(2), dv.getUint8(3)) !== "RSHM") throw new Error("not a human.bin file");
  const jsonLen = dv.getUint32(4, true);
  const header = JSON.parse(new TextDecoder().decode(new Uint8Array(buf, 8, jsonLen)));
  const binStart = 8 + jsonLen;
  const read = (a: Accessor) => {
    const at = binStart + a.offset;
    switch (a.type) {
      case "float32":
        return new Float32Array(buf.slice(at, at + a.count * 4));
      case "uint16":
        return new Uint16Array(buf.slice(at, at + a.count * 2));
      case "int16":
        return new Int16Array(buf.slice(at, at + a.count * 2));
      case "uint32":
        return new Uint32Array(buf.slice(at, at + a.count * 4));
      case "uint8":
        return new Uint8Array(buf.slice(at, at + a.count));
      default:
        throw new Error(`unknown accessor type ${a.type}`);
    }
  };

  // ── scale to a 1.88 m wrestler standing on y = 0 ──
  const rawPos = read(header.body.positions) as Float32Array;
  let minY = Infinity;
  let maxY = -Infinity;
  for (let i = 1; i < rawPos.length; i += 3) {
    minY = Math.min(minY, rawPos[i]);
    maxY = Math.max(maxY, rawPos[i]);
  }
  const scale = BASE_HEIGHT / (maxY - minY);
  const fit = (x: number, y: number, z: number, out: number[] | Float32Array, at: number) => {
    out[at] = x * scale;
    out[at + 1] = (y - minY) * scale;
    out[at + 2] = z * scale;
  };
  const pos: number[] = new Array(rawPos.length);
  for (let i = 0; i < rawPos.length; i += 3) fit(rawPos[i], rawPos[i + 1], rawPos[i + 2], pos, i);

  // ── skeleton: world rest matrices → parent-relative locals ──
  const bonesIn = header.bones as { name: string; parent: string | null; matrix: number[] }[];
  const boneIndex: Record<string, number> = {};
  bonesIn.forEach((b, i) => (boneIndex[b.name] = i));
  const world = bonesIn.map((b) => {
    const m = new THREE.Matrix4().fromArray(b.matrix);
    const p = new THREE.Vector3();
    const q = new THREE.Quaternion();
    m.decompose(p, q, new THREE.Vector3());
    p.set(p.x * scale, (p.y - minY) * scale, p.z * scale);
    return new THREE.Matrix4().compose(p, q, new THREE.Vector3(1, 1, 1));
  });
  const bones: BoneRest[] = bonesIn.map((b, i) => {
    const parent = b.parent ? boneIndex[b.parent] : -1;
    const local = parent >= 0 ? new THREE.Matrix4().copy(world[parent]).invert().multiply(world[i]) : world[i].clone();
    const p = new THREE.Vector3();
    const q = new THREE.Quaternion();
    local.decompose(p, q, new THREE.Vector3());
    return { name: b.name, parent, position: p, quaternion: q };
  });

  // ── body topology ──
  const tris = Array.from(read(header.body.tris) as Uint16Array);
  const uvq = read(header.body.uvs) as Uint16Array;
  const cornerUV = Array.from(uvq, (v) => v / 65535);
  const si = read(header.body.skinIndex) as Uint8Array;
  const sw = read(header.body.skinWeight) as Uint8Array;
  const weights: Map<number, number>[] = [];
  for (let v = 0; v < pos.length / 3; v++) {
    const w = new Map<number, number>();
    for (let k = 0; k < 4; k++) if (sw[v * 4 + k] > 0) w.set(si[v * 4 + k], (w.get(si[v * 4 + k]) ?? 0) + sw[v * 4 + k] / 255);
    weights.push(w);
  }
  const body = finalize({ pos, weights, tris, cornerUV });
  const topoFirst = new Uint32Array(body.topoCount);
  for (let i = body.topo.length - 1; i >= 0; i--) topoFirst[body.topo[i]] = i;

  // ── morphs ──
  const ntopo = pos.length / 3;
  const nbrs: number[][] = Array.from({ length: ntopo }, () => []);
  for (let f = 0; f < tris.length; f += 3)
    for (let c = 0; c < 3; c++) {
      const x = tris[f + c];
      const y = tris[f + ((c + 1) % 3)];
      nbrs[x].push(y);
      nbrs[y].push(x);
    }
  const morphs: Record<string, Morph> = {};
  for (const m of header.morphs as { name: string; indices: Accessor; deltas: Accessor; quant: number }[]) {
    const q = read(m.deltas) as Int16Array;
    const indices = read(m.indices) as Uint16Array;
    const d = new Float32Array(q.length);
    for (let i = 0; i < q.length; i++) d[i] = q[i] * m.quant * scale;
    despike(indices, d, nbrs, ntopo);
    morphs[m.name] = { name: m.name, indices, deltas: d };
  }

  // ── parts ──
  const parts: Record<string, Part> = {};
  for (const p of header.parts as { name: string; kind: string; positions: Accessor; tris: Accessor; uvs: Accessor; bind: Accessor }[]) {
    const raw = read(p.positions) as Float32Array;
    const ppos: number[] = new Array(raw.length);
    for (let i = 0; i < raw.length; i += 3) fit(raw[i], raw[i + 1], raw[i + 2], ppos, i);
    const bind = read(p.bind) as Uint16Array;
    const pTris = Array.from(read(p.tris) as Uint32Array);
    const pUV = Array.from(read(p.uvs) as Uint16Array, (v) => v / 65535);
    const pw: Map<number, number>[] = Array.from(bind, (b) => weights[b]);
    const f = finalize({ pos: ppos, weights: pw, tris: pTris, cornerUV: pUV });
    parts[p.name] = { name: p.name, kind: p.kind, positions: f.positions, uvs: f.uvs, index: f.index, topo: f.topo, topoCount: f.topoCount, bind: Uint32Array.from(f.topo, (t) => bind[t]) };
  }

  // unique neighbours, packed
  const adjStart = new Uint32Array(ntopo + 1);
  const adjList: number[] = [];
  for (let t = 0; t < ntopo; t++) {
    adjStart[t] = adjList.length;
    for (const nb of new Set(nbrs[t])) adjList.push(nb);
  }
  adjStart[ntopo] = adjList.length;
  return { ...body, topoFirst, adjStart, adj: new Uint32Array(adjList), ao: null, bones, boneIndex, morphs, parts, textures: header.textures };
}

/**
 * Some MakeHuman targets move a lone vertex much further than its neighbours
 * (a spike on the crown, a point inside the mouth). Replace such outliers with
 * the average of their neighbours so only the intended shape remains.
 */
function despike(indices: Uint16Array, d: Float32Array, nbrs: number[][], ntopo: number) {
  const slot = new Int32Array(ntopo).fill(-1);
  indices.forEach((t, k) => (slot[t] = k));
  for (let k = 0; k < indices.length; k++) {
    const ns = nbrs[indices[k]];
    if (!ns.length) continue;
    let ax = 0;
    let ay = 0;
    let az = 0;
    for (const nb of ns) {
      const j = slot[nb];
      if (j < 0) continue;
      ax += d[j * 3];
      ay += d[j * 3 + 1];
      az += d[j * 3 + 2];
    }
    ax /= ns.length;
    ay /= ns.length;
    az /= ns.length;
    const dev = Math.hypot(d[k * 3] - ax, d[k * 3 + 1] - ay, d[k * 3 + 2] - az);
    if (dev > Math.max(0.006, 2.5 * Math.hypot(ax, ay, az))) {
      d[k * 3] = ax;
      d[k * 3 + 1] = ay;
      d[k * 3 + 2] = az;
    }
  }
}

/** Welded mesh: per-topology-vertex positions/weights, per-corner UVs. */
interface TopoMesh {
  pos: number[];
  weights: Map<number, number>[];
  tris: number[];
  cornerUV: number[];
}

/** Split welded topology into render vertices (one per distinct UV) with smooth topology normals. */
function finalize(m: TopoMesh) {
  const ntopo = m.pos.length / 3;
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
    const k = `${t}|${Math.round(u * 1e4)}|${Math.round(v * 1e4)}`;
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
