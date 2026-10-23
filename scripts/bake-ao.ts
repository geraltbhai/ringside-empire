/**
 * Bakes per-vertex ambient occlusion for the human base (rest pose) into
 * public/models/human_ao.bin: one byte per topology vertex (255 = fully open).
 * Gives the eye sockets, nostrils, lips, ears, armpits and muscle creases their
 * natural shadow at zero runtime cost.
 *   npx tsx scripts/bake-ao.ts
 */
import { readFileSync, writeFileSync } from "node:fs";
import * as THREE from "three";
import { acceleratedRaycast, computeBoundsTree } from "three-mesh-bvh";
import { parseHumanBase } from "../src/components/match3d/human/base";

THREE.BufferGeometry.prototype.computeBoundsTree = computeBoundsTree;
THREE.Mesh.prototype.raycast = acceleratedRaycast;

const buf = readFileSync("public/models/human.bin");
const base = parseHumanBase(buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength) as ArrayBuffer);

// body plus the eyeballs (they shade the lids around them)
const geos: THREE.BufferGeometry[] = [];
const body = new THREE.BufferGeometry();
body.setAttribute("position", new THREE.BufferAttribute(base.positions, 3));
body.setIndex(new THREE.BufferAttribute(base.index, 1));
geos.push(body);
if (base.parts.eyes) {
  const eyes = new THREE.BufferGeometry();
  eyes.setAttribute("position", new THREE.BufferAttribute(base.parts.eyes.positions, 3));
  eyes.setIndex(new THREE.BufferAttribute(base.parts.eyes.index, 1));
  geos.push(eyes);
}
const merged = new THREE.BufferGeometry();
{
  const pos: number[] = [];
  const idx: number[] = [];
  for (const g of geos) {
    const off = pos.length / 3;
    pos.push(...(g.getAttribute("position").array as Float32Array));
    for (const i of g.index!.array) idx.push(i + off);
  }
  merged.setAttribute("position", new THREE.Float32BufferAttribute(pos, 3));
  merged.setIndex(idx);
}
merged.computeBoundsTree();
const mesh = new THREE.Mesh(merged, new THREE.MeshBasicMaterial({ side: THREE.DoubleSide }));

const RAYS = 64;
const MAX = 0.22;
const ray = new THREE.Raycaster();
ray.firstHitOnly = true;
ray.far = MAX;
const n = new THREE.Vector3();
const p = new THREE.Vector3();
const t1 = new THREE.Vector3();
const t2 = new THREE.Vector3();
const d = new THREE.Vector3();
const out = new Uint8Array(base.topoCount);
let seed = 12345;
const rnd = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
const t0 = performance.now();
for (let t = 0; t < base.topoCount; t++) {
  const v = base.topoFirst[t];
  n.fromArray(base.normals, v * 3).normalize();
  p.fromArray(base.positions, v * 3).addScaledVector(n, 0.0015);
  t1.set(Math.abs(n.x) < 0.9 ? 1 : 0, Math.abs(n.x) < 0.9 ? 0 : 1, 0).cross(n).normalize();
  t2.crossVectors(n, t1);
  let occ = 0;
  for (let k = 0; k < RAYS; k++) {
    // cosine-weighted hemisphere
    const u = rnd();
    const a = rnd() * Math.PI * 2;
    const r = Math.sqrt(u);
    d.copy(t1).multiplyScalar(r * Math.cos(a)).addScaledVector(t2, r * Math.sin(a)).addScaledVector(n, Math.sqrt(1 - u)).normalize();
    ray.set(p, d);
    const hit = ray.intersectObject(mesh, false)[0];
    if (hit) occ += 1 - (hit.distance / MAX) ** 0.5;
  }
  out[t] = Math.round(255 * Math.max(0, 1 - occ / RAYS));
}
writeFileSync("public/models/human_ao.bin", out);
console.log(`baked AO for ${base.topoCount} vertices in ${((performance.now() - t0) / 1000).toFixed(1)} s`);
