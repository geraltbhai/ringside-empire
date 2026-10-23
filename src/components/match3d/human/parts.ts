/**
 * Secondary parts built on top of a sculpted body: MakeHuman parts (eyes,
 * brows, lashes, hair cards) and procedural hair and beard shells, all skinned
 * to the same skeleton.
 */
import * as THREE from "three";
import type { Appearance } from "@/engine/types";
import type { HumanBase, Part } from "./base";
import type { Landmarks } from "./sculpt";

const smooth = (e0: number, e1: number, x: number) => {
  const k = Math.min(1, Math.max(0, (x - e0) / (e1 - e0)));
  return k * k * (3 - 2 * k);
};

/** 0..1 coverage of scalp hair at a rest position. */
export function hairMask(style: Appearance["hairStyle"], r: THREE.Vector3, lm: Landmarks) {
  if (style === "bald" || style === "buzz") return 0;
  const back = smooth(0.0, -0.06, r.z); // 0 front .. 1 back
  const side = smooth(0.035, 0.07, Math.abs(r.x));
  if (style === "mohawk") return smooth(lm.eyeY + 0.03, lm.eyeY + 0.05, r.y) * (1 - smooth(0.014, 0.026, Math.abs(r.x)));
  const frontLine = lm.eyeY + 0.058;
  const sideLine = lm.eyeY + 0.012;
  const backLine = style === "long" ? lm.chinY - 0.02 : style === "ponytail" ? lm.eyeY - 0.03 : lm.eyeY - 0.045;
  let line = frontLine + (sideLine - frontLine) * side * (1 - back);
  line = line + (backLine - line) * back;
  // keep the face and ears clear
  const face = r.z > 0.02 && r.y < frontLine ? 0 : 1;
  return smooth(line - 0.004, line + 0.012, r.y) * face;
}

export function beardMask(kind: Appearance["facialHair"], r: THREE.Vector3, lm: Landmarks) {
  if (kind !== "beard" && kind !== "goatee") return 0;
  const ax = Math.abs(r.x);
  const front = smooth(-0.03, 0.0, r.z);
  if (kind === "goatee") {
    const chin = 1 - smooth(0.012, 0.026, Math.hypot(r.x, (r.y - (lm.chinY + 0.01)) * 0.8));
    return chin * smooth(0.0, 0.03, r.z);
  }
  // upper edge: just under the nose at the centre, rising to the cheekbones at the sides
  const top = lm.mouthY + 0.016 + (lm.eyeY - 0.038 - (lm.mouthY + 0.016)) * smooth(0.018, 0.05, ax);
  const lower = 1 - smooth(top - 0.006, top + 0.004, r.y);
  // stops just under the jaw, a little lower at the front of the chin
  const under = smooth(lm.chinY - 0.012 - Math.max(0, r.z) * 0.15, lm.chinY + 0.004, r.y);
  const lips = 1 - (1 - smooth(0.004, 0.009, Math.abs(r.y - lm.mouthY))) * (1 - smooth(0.02, 0.026, ax));
  return lower * under * front * lips * (1 - smooth(0.066, 0.075, ax + Math.max(0, -r.z) * 2));
}

/**
 * A shell over part of the body: triangles where the mask is on, pushed out along
 * the normal by mask × thickness. Skinned with the body's own weights.
 */
export function buildShell(body: THREE.BufferGeometry, mask: (r: THREE.Vector3) => number, thickness: number, minHead = 0.5) {
  const pos = body.getAttribute("position") as THREE.BufferAttribute;
  const nrm = body.getAttribute("normal") as THREE.BufferAttribute;
  const rest = body.getAttribute("aRest") as THREE.BufferAttribute;
  const regA = body.getAttribute("aRegA") as THREE.BufferAttribute;
  const si = body.getAttribute("skinIndex") as THREE.BufferAttribute;
  const sw = body.getAttribute("skinWeight") as THREE.BufferAttribute;
  const idx = body.index!.array;
  const r = new THREE.Vector3();
  const maskOf = new Float32Array(pos.count).fill(-1);
  const m = (i: number) => {
    if (maskOf[i] < 0) maskOf[i] = regA.getY(i) >= minHead ? mask(r.fromBufferAttribute(rest, i)) : 0;
    return maskOf[i];
  };
  const map = new Map<number, number>();
  const P: number[] = [];
  const N: number[] = [];
  const R: number[] = [];
  const SI: number[] = [];
  const SW: number[] = [];
  const I: number[] = [];
  const add = (i: number) => {
    let j = map.get(i);
    if (j !== undefined) return j;
    j = P.length / 3;
    map.set(i, j);
    const k = m(i);
    const off = k * thickness - (1 - k) * 0.002;
    P.push(pos.getX(i) + nrm.getX(i) * off, pos.getY(i) + nrm.getY(i) * off, pos.getZ(i) + nrm.getZ(i) * off);
    N.push(nrm.getX(i), nrm.getY(i), nrm.getZ(i));
    R.push(rest.getX(i), rest.getY(i), rest.getZ(i));
    for (let c = 0; c < 4; c++) {
      SI.push(si.getComponent(i, c));
      SW.push(sw.getComponent(i, c));
    }
    return j;
  };
  for (let f = 0; f < idx.length; f += 3) {
    const a = idx[f];
    const b = idx[f + 1];
    const c = idx[f + 2];
    if (Math.max(m(a), m(b), m(c)) < 0.05) continue;
    I.push(add(a), add(b), add(c));
  }
  if (!I.length) return null;
  const g = new THREE.BufferGeometry();
  g.setAttribute("position", new THREE.Float32BufferAttribute(P, 3));
  g.setAttribute("normal", new THREE.Float32BufferAttribute(N, 3));
  g.setAttribute("aRest", new THREE.Float32BufferAttribute(R, 3));
  g.setAttribute("skinIndex", new THREE.Uint16BufferAttribute(SI, 4));
  g.setAttribute("skinWeight", new THREE.Float32BufferAttribute(SW, 4));
  g.setIndex(I);
  g.computeBoundingSphere();
  return g;
}

/** Hair shaded with fine strands that run down the head. */
export function createHairMaterial(color: string, sheen = 0.6) {
  const mat = new THREE.MeshPhysicalMaterial({ color, roughness: 0.62, sheen, sheenRoughness: 0.35, sheenColor: new THREE.Color(color).lerp(new THREE.Color("#ffffff"), 0.35) });
  mat.onBeforeCompile = (shader) => {
    shader.vertexShader = shader.vertexShader
      .replace("#include <common>", "#include <common>\nattribute vec3 aRest; varying vec3 vRest;")
      .replace("#include <begin_vertex>", "#include <begin_vertex>\nvRest = aRest;");
    shader.fragmentShader = shader.fragmentShader
      .replace(
        "#include <common>",
        `#include <common>
varying vec3 vRest;
float hh(vec2 p){ return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
float strand(vec3 p){
  float a = atan(p.x, p.z) * 120.0;
  float s = hh(vec2(floor(a), 1.0)) * 0.6 + hh(vec2(floor(a * 2.7), 7.0)) * 0.4;
  return s;
}`,
      )
      .replace(
        "#include <color_fragment>",
        `#include <color_fragment>
diffuseColor.rgb *= 0.62 + 0.55 * strand(vRest) * (0.8 + 0.2 * sin(vRest.y * 300.0 + strand(vRest) * 6.0));`,
      );
  };
  mat.customProgramCacheKey = () => "wrestler-hair-v1";
  return mat;
}

/**
 * A fitted MakeHuman part (eyes, brows, lashes, hair). Every vertex rides on its
 * nearest body vertex: it moves with the morphs and sculpt and copies that
 * vertex's skin weights, so it stays glued on through any pose.
 */
export function buildPartGeometry(part: Part, base: HumanBase, topoDisp: Float32Array) {
  const n = part.positions.length / 3;
  const pos = new Float32Array(n * 3);
  const si = new Uint16Array(n * 4);
  const sw = new Float32Array(n * 4);
  for (let i = 0; i < n; i++) {
    const t = part.bind[i];
    pos[i * 3] = part.positions[i * 3] + topoDisp[t * 3];
    pos[i * 3 + 1] = part.positions[i * 3 + 1] + topoDisp[t * 3 + 1];
    pos[i * 3 + 2] = part.positions[i * 3 + 2] + topoDisp[t * 3 + 2];
    const v = base.topoFirst[t];
    for (let k = 0; k < 4; k++) {
      si[i * 4 + k] = base.skinIndex[v * 4 + k];
      sw[i * 4 + k] = base.skinWeight[v * 4 + k];
    }
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute("position", new THREE.BufferAttribute(pos, 3));
  g.setAttribute("aRest", new THREE.BufferAttribute(part.positions, 3));
  g.setAttribute("uv", new THREE.BufferAttribute(part.uvs, 2));
  g.setAttribute("skinIndex", new THREE.BufferAttribute(si, 4));
  g.setAttribute("skinWeight", new THREE.BufferAttribute(sw, 4));
  g.setIndex(new THREE.BufferAttribute(part.index, 1));
  g.computeVertexNormals();
  g.computeBoundingSphere();
  return g;
}

/**
 * Alpha-card material for brows, lashes and hair: the texture's shape and
 * shading, recoloured to the wrestler's hair colour.
 */
export function createCardMaterial(map: THREE.Texture, color: string, mean: THREE.Vector3, opts: { roughness?: number; sheen?: number } = {}) {
  const tint = new THREE.Color(color);
  const mat = new THREE.MeshPhysicalMaterial({
    map,
    color: "#ffffff",
    roughness: opts.roughness ?? 0.6,
    sheen: opts.sheen ?? 0.5,
    sheenRoughness: 0.35,
    // sheen follows the hair colour so dark hair stays dark instead of turning grey
    sheenColor: tint.clone().multiplyScalar(1.6).lerp(new THREE.Color("#ffffff"), 0.08),
    alphaTest: 0.35,
    alphaToCoverage: true,
    side: THREE.DoubleSide,
  });
  const lum = mean.x * 0.2126 + mean.y * 0.7152 + mean.z * 0.0722;
  mat.onBeforeCompile = (shader) => {
    shader.uniforms.uTint = { value: new THREE.Vector3(tint.r, tint.g, tint.b) };
    shader.uniforms.uLum = { value: Math.max(0.02, lum) };
    shader.fragmentShader = shader.fragmentShader
      .replace("#include <common>", "#include <common>\nuniform vec3 uTint; uniform float uLum;")
      .replace(
        "#include <map_fragment>",
        `#include <map_fragment>
float l = dot(diffuseColor.rgb, vec3(0.2126, 0.7152, 0.0722));
diffuseColor.rgb = uTint * clamp(l / uLum, 0.0, 2.5);`,
      );
  };
  mat.customProgramCacheKey = () => "wrestler-card-v1";
  return mat;
}

/** Glossy eyeball with the iris texture, tinted per wrestler. */
export function createEyeMaterial(map: THREE.Texture, tint: string) {
  return new THREE.MeshPhysicalMaterial({ map, color: tint, roughness: 0.12, clearcoat: 1, clearcoatRoughness: 0.03 });
}

/**
 * Fur shells: the masked region of the body duplicated in `layers` thin layers.
 * The material pushes each layer out along the normal (and combs it in a
 * direction), and keeps only the pixels where a strand passes through, so the
 * stack reads as individual hairs: beards, brows, buzz cuts, short hair.
 */
export function buildFurGeometry(body: THREE.BufferGeometry, mask: (r: THREE.Vector3) => number, layers: number, minHead = 0.3) {
  const pos = body.getAttribute("position") as THREE.BufferAttribute;
  const nrm = body.getAttribute("normal") as THREE.BufferAttribute;
  const rest = body.getAttribute("aRest") as THREE.BufferAttribute;
  const regA = body.getAttribute("aRegA") as THREE.BufferAttribute;
  const si = body.getAttribute("skinIndex") as THREE.BufferAttribute;
  const sw = body.getAttribute("skinWeight") as THREE.BufferAttribute;
  const idx = body.index!.array;
  const r = new THREE.Vector3();
  const m = new Float32Array(pos.count).fill(-1);
  const maskOf = (i: number) => {
    if (m[i] < 0) m[i] = regA.getY(i) >= minHead ? Math.max(0, Math.min(1, mask(r.fromBufferAttribute(rest, i)))) : 0;
    return m[i];
  };
  // region triangles and their vertices
  const tris: number[] = [];
  for (let f = 0; f < idx.length; f += 3) if (Math.max(maskOf(idx[f]), maskOf(idx[f + 1]), maskOf(idx[f + 2])) > 0.02) tris.push(idx[f], idx[f + 1], idx[f + 2]);
  if (!tris.length) return null;
  const local = new Map<number, number>();
  const verts: number[] = [];
  for (const v of tris) if (!local.has(v)) local.set(v, verts.push(v) - 1);
  const nv = verts.length;
  const P = new Float32Array(nv * layers * 3);
  const N = new Float32Array(nv * layers * 3);
  const R = new Float32Array(nv * layers * 3);
  const M = new Float32Array(nv * layers);
  const L = new Float32Array(nv * layers);
  const SI = new Uint16Array(nv * layers * 4);
  const SW = new Float32Array(nv * layers * 4);
  for (let l = 0; l < layers; l++) {
    const h = layers === 1 ? 0 : l / (layers - 1);
    verts.forEach((v, k) => {
      const o = l * nv + k;
      P.set([pos.getX(v), pos.getY(v), pos.getZ(v)], o * 3);
      N.set([nrm.getX(v), nrm.getY(v), nrm.getZ(v)], o * 3);
      R.set([rest.getX(v), rest.getY(v), rest.getZ(v)], o * 3);
      M[o] = maskOf(v);
      L[o] = h;
      for (let c = 0; c < 4; c++) {
        SI[o * 4 + c] = si.getComponent(v, c);
        SW[o * 4 + c] = sw.getComponent(v, c);
      }
    });
  }
  const I: number[] = [];
  for (let l = 0; l < layers; l++) for (const v of tris) I.push(l * nv + local.get(v)!);
  const g = new THREE.BufferGeometry();
  g.setAttribute("position", new THREE.BufferAttribute(P, 3));
  g.setAttribute("normal", new THREE.BufferAttribute(N, 3));
  g.setAttribute("aRest", new THREE.BufferAttribute(R, 3));
  g.setAttribute("aMask", new THREE.BufferAttribute(M, 1));
  g.setAttribute("aLayer", new THREE.BufferAttribute(L, 1));
  g.setAttribute("skinIndex", new THREE.BufferAttribute(SI, 4));
  g.setAttribute("skinWeight", new THREE.BufferAttribute(SW, 4));
  g.setIndex(I);
  g.computeBoundingSphere();
  return g;
}

export interface FurStyle {
  /** Strand length in metres. */
  length: number;
  /** Strand cells per metre (higher = finer, denser hair). */
  density: number;
  /** Fraction of cells that grow a strand. */
  cover: number;
  /** Strand thickness as a fraction of the cell (0..0.5). */
  thickness: number;
  /** Comb direction in rest space; x is mirrored per side (+x points away from the centre line). */
  comb: [number, number, number];
  /** Draw the bottom layer solid (dense beards / brows) instead of only strands. */
  solidBase: boolean;
}

export function createFurMaterial(color: string, style: FurStyle) {
  // keep very dark hair just above black so individual strands still catch light
  const c = new THREE.Color(color).lerp(new THREE.Color("#3a3028"), 0.22);
  const mat = new THREE.MeshPhysicalMaterial({
    color: "#ffffff",
    roughness: 0.78,
    sheen: 0.35,
    sheenRoughness: 0.5,
    sheenColor: c.clone().multiplyScalar(1.6).lerp(new THREE.Color("#ffffff"), 0.1),
    side: THREE.DoubleSide,
  });
  mat.onBeforeCompile = (shader) => {
    shader.uniforms.uHair = { value: new THREE.Vector3(c.r, c.g, c.b) };
    shader.uniforms.uFur = { value: new THREE.Vector4(style.length, style.density, style.cover, style.thickness) };
    shader.uniforms.uComb = { value: new THREE.Vector4(...style.comb, style.solidBase ? 1 : 0) };
    shader.vertexShader = shader.vertexShader
      .replace(
        "#include <common>",
        `#include <common>
attribute vec3 aRest; attribute float aMask; attribute float aLayer;
uniform vec4 uFur; uniform vec4 uComb;
varying vec3 vRest; varying float vMask; varying float vLayer;`,
      )
      .replace(
        "#include <begin_vertex>",
        `#include <begin_vertex>
vRest = aRest; vMask = aMask; vLayer = aLayer;
float len = uFur.x * aMask;
vec3 comb = normalize(vec3(uComb.x * sign(aRest.x + 1e-5), uComb.y, uComb.z));
transformed += objectNormal * aLayer * len + comb * aLayer * aLayer * len * 0.9;`,
      );
    shader.fragmentShader = shader.fragmentShader
      .replace(
        "#include <common>",
        `#include <common>
uniform vec3 uHair; uniform vec4 uFur; uniform vec4 uComb;
varying vec3 vRest; varying float vMask; varying float vLayer;
vec3 fh3(vec3 p){ p = fract(p * vec3(0.1031, 0.1030, 0.0973)); p += dot(p, p.yxz + 33.33); return fract((p.xxy + p.yxx) * p.zyx); }`,
      )
      .replace(
        "#include <color_fragment>",
        `#include <color_fragment>
{
  vec3 p = vRest * uFur.y;
  vec3 ci = floor(p);
  vec3 rnd = fh3(ci);
  vec3 c = 0.5 + (rnd - 0.5) * 0.6;
  float d = length(fract(p) - c);
  float strandLen = (0.45 + 0.55 * rnd.y) * (0.35 + 0.65 * vMask);
  // when a strand cell shrinks below a pixel, strands widen and merge so distant hair reads as a soft mass, not noise
  float px = length(fwidth(p));
  float far = smoothstep(0.35, 1.2, px) * 0.7;
  float radius = mix(uFur.w * (1.0 - vLayer * 0.75), 0.6 * (1.0 - vLayer * 0.6), far);
  // a solid base only in the dense core; the edges thin out strand by strand
  bool base = uComb.w > 0.5 && vLayer < 0.001 && vMask > 0.6;
  float cover = mix(uFur.z, 1.0, far) * smoothstep(0.05, 0.35, vMask);
  if (!base && (rnd.x > cover || d > radius || vLayer > strandLen || vMask < 0.08)) discard;
  // darker at the roots, lighter at the tips, a little variation per strand
  diffuseColor.rgb = uHair * (0.5 + 0.8 * vLayer) * (0.7 + 0.6 * rnd.z);
}`,
      );
  };
  mat.customProgramCacheKey = () => "wrestler-fur-v1";
  return mat;
}

/** Eyebrow coverage: an arched band above each eye, fuller towards the middle. */
export function browMask(r: THREE.Vector3, lm: Landmarks, thick = 1) {
  const ax = Math.abs(r.x);
  if (r.z < lm.eyeZ - 0.04) return 0;
  const t = (ax - 0.012) / 0.05; // 0 inner end .. 1 outer end
  if (t < 0 || t > 1) return 0;
  const centre = lm.eyeY + 0.021 + 0.004 * Math.sin(t * Math.PI) - t * t * 0.006;
  const half = (0.0042 - t * 0.0022) * thick;
  return smooth(half + 0.0015, half - 0.0005, Math.abs(r.y - centre)) * smooth(1, 0.85, t) * smooth(0, 0.08, t);
}

/** Facial hair coverage for each style (0..1 sets strand length). */
export function facialHairMask(kind: Appearance["facialHair"], r: THREE.Vector3, lm: Landmarks) {
  const ax = Math.abs(r.x);
  const front = smooth(-0.035, -0.005, r.z);
  const lip = 1 - (1 - smooth(0.005, 0.009, Math.abs(r.y - lm.mouthY))) * (1 - smooth(0.022, 0.028, ax));
  const mustache = (1 - smooth(0.005, 0.009, Math.abs(r.y - (lm.mouthY + 0.011)))) * (1 - smooth(0.026, 0.032, ax)) * front;
  const chin = (1 - smooth(0.012, 0.026, Math.hypot(r.x, (r.y - (lm.chinY + 0.012)) * 0.8))) * front;
  if (kind === "goatee") return Math.max(mustache * 0.8, chin) * lip;
  // the beard area: under the nose at the centre, up to the cheekbones at the sides, down to a neckline that follows the jaw
  const top = lm.mouthY + 0.014 + (lm.eyeY - 0.035 - (lm.mouthY + 0.014)) * smooth(0.016, 0.045, ax);
  const lower = 1 - smooth(top - 0.004, top + 0.006, r.y);
  // the neckline follows the jaw: under the chin at the front, rising to the jaw angle below the ear
  const neckline = lm.chinY - 0.022 + smooth(0.015, 0.062, ax) * (lm.mouthY - lm.chinY + 0.014);
  const jaw = smooth(neckline - 0.004, neckline + 0.006, r.y) * smooth(-0.012, 0.008, r.z);
  const area = lower * jaw * (1 - smooth(0.066, 0.078, ax + Math.max(0, -r.z) * 2));
  if (kind === "stubble") return area * lip;
  if (kind === "beard") {
    // fuller at the chin, shorter on the cheeks and towards the ears
    const full = 0.55 + 0.45 * (1 - smooth(0.01, 0.06, ax));
    return Math.max(area * full, mustache) * lip;
  }
  return 0;
}
