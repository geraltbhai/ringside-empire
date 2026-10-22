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
