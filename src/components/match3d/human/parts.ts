/**
 * Secondary parts built on top of a sculpted body: hair and beard shells (skinned
 * to the same skeleton), hanging hair, eyes with lids. All hair is shaded with a
 * strand-noise material so it reads as hair rather than a plastic cap.
 */
import * as THREE from "three";
import type { Appearance } from "@/engine/types";
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

/** A hanging hair sheet behind the head and down to the shoulders (long hair). */
export function longHairGeometry(lm: Landmarks, length: number) {
  const g = new THREE.CylinderGeometry(0.095, 0.13, length, 28, 12, true, Math.PI * 0.62, Math.PI * 1.76);
  const pos = g.getAttribute("position") as THREE.BufferAttribute;
  for (let i = 0; i < pos.count; i++) {
    const y = pos.getY(i);
    const k = (length / 2 - y) / length; // 0 top .. 1 bottom
    // flatten against the back, wave the ends
    pos.setZ(i, pos.getZ(i) * (0.75 - k * 0.15) - k * 0.03);
    pos.setX(i, pos.getX(i) * (1 + Math.sin(i * 1.7) * 0.03 * k));
  }
  g.translate(0, lm.eyeY + 0.02 - length / 2, -0.03);
  g.computeVertexNormals();
  const rest = new Float32Array(pos.array as Float32Array);
  g.setAttribute("aRest", new THREE.BufferAttribute(rest, 3));
  return g;
}

export function ponytailGeometry(lm: Landmarks) {
  const g = new THREE.CapsuleGeometry(0.026, 0.22, 4, 12);
  g.rotateX(0.35);
  g.translate(0, lm.eyeY - 0.08, -0.13);
  g.setAttribute("aRest", new THREE.BufferAttribute(new Float32Array((g.getAttribute("position") as THREE.BufferAttribute).array as Float32Array), 3));
  return g;
}

/** Eyeball with a painted iris and pupil, looking down +Z. */
export function createEyeMaterial(iris: string) {
  const mat = new THREE.MeshPhysicalMaterial({ color: "#ffffff", roughness: 0.08, clearcoat: 1, clearcoatRoughness: 0.02 });
  const irisC = new THREE.Color(iris);
  mat.onBeforeCompile = (shader) => {
    shader.uniforms.uIris = { value: irisC };
    shader.vertexShader = shader.vertexShader
      .replace("#include <common>", "#include <common>\nvarying vec3 vLocal;")
      .replace("#include <begin_vertex>", "#include <begin_vertex>\nvLocal = position;");
    shader.fragmentShader = shader.fragmentShader
      .replace("#include <common>", "#include <common>\nvarying vec3 vLocal; uniform vec3 uIris;")
      .replace(
        "#include <color_fragment>",
        `#include <color_fragment>
vec3 d = normalize(vLocal);
float ang = acos(clamp(d.z, -1.0, 1.0));
vec3 c = vec3(0.93, 0.9, 0.86) - vec3(0.0, 0.05, 0.05) * smoothstep(0.6, 1.4, ang);
float ring = smoothstep(0.52, 0.48, ang);
c = mix(c, uIris * (0.7 + 0.3 * sin(atan(d.y, d.x) * 30.0)), ring);
c = mix(c, uIris * 0.4, smoothstep(0.42, 0.5, ang) * ring);
c = mix(c, vec3(0.01), smoothstep(0.22, 0.18, ang));
diffuseColor.rgb = c;`,
      );
  };
  mat.customProgramCacheKey = () => "wrestler-eye-v1";
  return mat;
}
