/**
 * Skin + ring gear material. A MeshPhysicalMaterial whose colour, roughness and
 * sheen are painted per pixel from rest-pose coordinates and body-region
 * weights (see sculpt.ts): skin with pores and mottling, brows, lips and facial
 * hair, masks and face paint, trunks / tights / pants / singlet / bodysuit,
 * boots with laces, knee and elbow pads, wrist tape, MMA gloves and tattoos
 * (free-hand sleeves and Polynesian tribal bands). No texture files needed.
 */
import * as THREE from "three";
import type { Appearance, TattooSpot } from "@/engine/types";
import type { Landmarks } from "./sculpt";

const OUTFIT = { trunks: 0, tights: 1, singlet: 2, pants: 3, bodysuit: 4 } as const;
const FACIAL = { none: 0, stubble: 1, goatee: 2, beard: 3 } as const;
const HAIR = { bald: 0, buzz: 1, short: 2, long: 3, mohawk: 4, ponytail: 5 } as const;
const PAINT = { none: 0, warrior: 1, crow: 2, skull: 3, demon: 4 } as const;
const TATTOO_BITS: Record<TattooSpot, number> = { sleeveL: 1, sleeveR: 2, upperL: 4, upperR: 8, tribalL: 16, tribalR: 32, chest: 64, back: 128, neck: 256, torso: 512, legs: 1024, hands: 2048 };

const NOISE = /* glsl */ `
// 3D simplex noise (Ashima Arts / Stefan Gustavson, MIT licence)
vec4 permute(vec4 x){ return mod(((x * 34.0) + 1.0) * x, 289.0); }
vec4 taylorInvSqrt(vec4 r){ return 1.79284291400159 - 0.85373472095314 * r; }
float snoise(vec3 v){
  const vec2 C = vec2(1.0 / 6.0, 1.0 / 3.0);
  const vec4 D = vec4(0.0, 0.5, 1.0, 2.0);
  vec3 i = floor(v + dot(v, C.yyy));
  vec3 x0 = v - i + dot(i, C.xxx);
  vec3 g = step(x0.yzx, x0.xyz);
  vec3 l = 1.0 - g;
  vec3 i1 = min(g.xyz, l.zxy);
  vec3 i2 = max(g.xyz, l.zxy);
  vec3 x1 = x0 - i1 + C.xxx;
  vec3 x2 = x0 - i2 + 2.0 * C.xxx;
  vec3 x3 = x0 - 1.0 + 3.0 * C.xxx;
  i = mod(i, 289.0);
  vec4 p = permute(permute(permute(i.z + vec4(0.0, i1.z, i2.z, 1.0)) + i.y + vec4(0.0, i1.y, i2.y, 1.0)) + i.x + vec4(0.0, i1.x, i2.x, 1.0));
  float n_ = 1.0 / 7.0;
  vec3 ns = n_ * D.wyz - D.xzx;
  vec4 j = p - 49.0 * floor(p * ns.z * ns.z);
  vec4 x_ = floor(j * ns.z);
  vec4 y_ = floor(j - 7.0 * x_);
  vec4 x = x_ * ns.x + ns.yyyy;
  vec4 y = y_ * ns.x + ns.yyyy;
  vec4 h = 1.0 - abs(x) - abs(y);
  vec4 b0 = vec4(x.xy, y.xy);
  vec4 b1 = vec4(x.zw, y.zw);
  vec4 s0 = floor(b0) * 2.0 + 1.0;
  vec4 s1 = floor(b1) * 2.0 + 1.0;
  vec4 sh = -step(h, vec4(0.0));
  vec4 a0 = b0.xzyw + s0.xzyw * sh.xxyy;
  vec4 a1 = b1.xzyw + s1.xzyw * sh.zzww;
  vec3 p0 = vec3(a0.xy, h.x);
  vec3 p1 = vec3(a0.zw, h.y);
  vec3 p2 = vec3(a1.xy, h.z);
  vec3 p3 = vec3(a1.zw, h.w);
  vec4 norm = taylorInvSqrt(vec4(dot(p0, p0), dot(p1, p1), dot(p2, p2), dot(p3, p3)));
  p0 *= norm.x; p1 *= norm.y; p2 *= norm.z; p3 *= norm.w;
  vec4 m = max(0.6 - vec4(dot(x0, x0), dot(x1, x1), dot(x2, x2), dot(x3, x3)), 0.0);
  m = m * m;
  return 42.0 * dot(m * m, vec4(dot(p0, x0), dot(p1, x1), dot(p2, x2), dot(p3, x3)));
}
float vnoise(vec3 x){ return snoise(x) * 0.5 + 0.5; }
float fbm(vec3 p){ float s = 0.0, a = 0.5; for (int i = 0; i < 4; i++) { s += a * vnoise(p); p = p * 2.03 + 17.1; a *= 0.5; } return s / 0.9375; }
`;

export interface SkinUniforms {
  [k: string]: THREE.IUniform;
}

export function hexToVec3(hex: string) {
  const c = new THREE.Color(hex);
  return new THREE.Vector3(c.r, c.g, c.b);
}

/**
 * `skinMap` is a MakeHuman skin texture (pores, lips, nipples, knuckles); it is
 * used as detail and tinted to the wrestler's tone. `skinMean` is its average
 * linear colour, so the tint keeps the wrestler's exact skin tone.
 */
export function createSkinMaterial(a: Appearance, lm: Landmarks, seed: number, skinMap: THREE.Texture | null, skinMean: THREE.Vector3, headMean: THREE.Vector3 = skinMean) {
  const bits = (a.tattoos ?? []).reduce((s, t) => s | TATTOO_BITS[t], 0);
  const uniforms: SkinUniforms = {
    uSkin: { value: hexToVec3(a.skinTone) },
    uHair: { value: hexToVec3(a.hairColor) },
    uPrim: { value: hexToVec3(a.primaryColor) },
    uSec: { value: hexToVec3(a.secondaryColor) },
    uBoot: { value: hexToVec3(a.bootColor) },
    uStyle: { value: new THREE.Vector4(OUTFIT[a.outfit], FACIAL[a.facialHair], HAIR[a.hairStyle], PAINT[a.facePaint ?? "none"]) },
    uFlags: { value: new THREE.Vector4(a.kneepads ? 1 : 0, a.wristTape ? 1 : 0, a.gloves ? 1 : 0, a.elbowPads ? 1 : 0) },
    uMask: { value: a.mask ? 1 : 0 },
    uTattoo: { value: bits },
    uSeed: { value: (seed % 1000) / 37 },
    uSweat: { value: 0 },
    uL1: { value: new THREE.Vector4(lm.headTop, lm.eyeY, lm.mouthY, lm.chinY) },
    uL2: { value: new THREE.Vector4(lm.pelvisY, lm.navelY, lm.kneeY, lm.ankleY) },
    uL3: { value: new THREE.Vector4(lm.eyeX, lm.eyeZ, lm.chestY, lm.neckY) },
    uSkinMap: { value: skinMap },
    uSkinMean: { value: skinMean },
    uHeadMean: { value: headMean },
    uHasMap: { value: skinMap ? 1 : 0 },
  };
  const mat = new THREE.MeshPhysicalMaterial({
    color: "#ffffff",
    roughness: 0.55,
    sheen: 0.4,
    sheenRoughness: 0.5,
    sheenColor: new THREE.Color("#ff9070"),
    clearcoat: 0.1,
    clearcoatRoughness: 0.35,
  });
  mat.onBeforeCompile = (shader) => {
    Object.assign(shader.uniforms, uniforms);
    shader.vertexShader = shader.vertexShader
      .replace(
        "#include <common>",
        `#include <common>
attribute vec3 aRest; attribute vec4 aRegA; attribute vec4 aRegB; attribute vec4 aLimb;
varying vec3 vRest; varying vec4 vRegA; varying vec4 vRegB; varying vec4 vLimb; varying vec2 vSkinUv;`,
      )
      .replace(
        "#include <begin_vertex>",
        `#include <begin_vertex>
vRest = aRest; vRegA = aRegA; vRegB = aRegB; vLimb = aLimb; vSkinUv = uv;`,
      );
    shader.fragmentShader = shader.fragmentShader
      .replace(
        "#include <common>",
        `#include <common>
varying vec3 vRest; varying vec4 vRegA; varying vec4 vRegB; varying vec4 vLimb; varying vec2 vSkinUv;
uniform sampler2D uSkinMap; uniform vec3 uSkinMean; uniform vec3 uHeadMean; uniform float uHasMap;
uniform vec3 uSkin, uHair, uPrim, uSec, uBoot;
uniform vec4 uStyle, uFlags, uL1, uL2, uL3;
uniform float uMask, uSeed, uSweat;
uniform int uTattoo;
${NOISE}
float gearMask = 0.0; float gearRough = 0.6; float gearSheen = 0.0;
bool has(int bit){ return (uTattoo & bit) != 0; }
float sleeveInk(vec3 p){
  // big motifs with crisp black outlines, solid blacks, grey-wash shading and fine linework
  float n = clamp(0.5 + (fbm(p * 13.0 + uSeed) - 0.5) * 2.6, 0.0, 1.0);
  float n2 = clamp(0.5 + (fbm(p * 40.0 + uSeed * 1.7) - 0.5) * 2.6, 0.0, 1.0);
  float outline = 1.0 - smoothstep(0.012, 0.03, abs(n - 0.42));
  float inner = 1.0 - smoothstep(0.01, 0.025, abs(n - 0.6));
  float solid = smoothstep(0.7, 0.73, n);
  float shade = smoothstep(0.42, 0.6, n) * (1.0 - smoothstep(0.66, 0.7, n)) * (0.15 + 0.45 * n2);
  float lines = (1.0 - smoothstep(0.01, 0.03, abs(n2 - 0.5))) * smoothstep(0.42, 0.46, n);
  return clamp(max(max(outline, inner * 0.85), max(solid, max(shade, lines * 0.75))), 0.0, 1.0);
}
float tribalInk(float u, float v){
  // Polynesian-style bands: solid rings, sawtooth teeth and chevrons
  float b = fract(u);
  float band = floor(u);
  float teeth = abs(fract(v * 9.0) - 0.5) * 2.0;
  float ink = 0.0;
  if (b < 0.18) ink = 1.0;
  else if (b < 0.55) ink = step(teeth, (b - 0.18) / 0.37) * step(0.5, fract(band * 0.5));
  else if (b < 0.62) ink = 0.0;
  else if (b < 0.8) ink = step(abs(fract(v * 14.0 + b * 3.0) - 0.5), 0.18);
  return ink;
}`,
      )
      .replace(
        "#include <color_fragment>",
        `#include <color_fragment>
{
  vec3 r = vRest;
  float torsoW = vRegA.x, headW = vRegA.y, uArmW = vRegA.z, fArmW = vRegA.w;
  float handW = vRegB.x, thighW = vRegB.y, shinW = vRegB.z, footW = vRegB.w;
  float limbT = vLimb.x; float cphi = vLimb.y; float sphi = vLimb.z; float side = vLimb.w;
  float armW = uArmW + fArmW + handW;
  float legW = thighW + shinW;
  float headTop = uL1.x, eyeY = uL1.y, mouthY = uL1.z, chinY = uL1.w;
  float pelvisY = uL2.x, navelY = uL2.y, kneeY = uL2.z, ankleY = uL2.w;
  float eyeX = uL3.x, eyeZ = uL3.y, chestY = uL3.z, neckY = uL3.w;
  int outfit = int(uStyle.x + 0.5); int facial = int(uStyle.y + 0.5); int hairStyle = int(uStyle.z + 0.5); int paint = int(uStyle.w + 0.5);

  // ── skin: photographic detail from the skin map, tinted to this wrestler's tone ──
  vec3 col = uSkin;
  if (uHasMap > 0.5) {
    vec3 tex = texture2D(uSkinMap, vSkinUv).rgb;
    // the head has its own UV island (u > 0.62) with a different base brightness
    vec3 mean = vSkinUv.x > 0.62 && vSkinUv.y > 0.15 ? uHeadMean : uSkinMean;
    col = uSkin * clamp(tex / mean, 0.0, 2.2);
  }
  col *= 0.96 + 0.08 * fbm(r * 55.0 + uSeed);
  vec3 hairCol = uHair;
  float hairTone = 0.8 + 0.25 * vnoise(r * vec3(500.0, 60.0, 500.0));

  // ── face ──
  float front = smoothstep(-0.02, 0.04, r.z);
  if (headW > 0.4) {
    float faceY = r.y;
    float ax = abs(r.x);
    // lips and mouth come from the skin map; these masks keep beards and paint off them
    float lip = (1.0 - smoothstep(0.006, 0.01, abs(faceY - mouthY))) * (1.0 - smoothstep(0.022, 0.028, ax)) * front;
    float mouthLine = (1.0 - smoothstep(0.0005, 0.0015, abs(faceY - mouthY))) * (1.0 - smoothstep(0.016, 0.022, ax)) * front;
    // facial hair
    // beard line: under the nose at the centre, rising to the cheekbones at the sides, down under the jaw
    float top = mix(mouthY + 0.014, eyeY - 0.035, smoothstep(0.016, 0.045, ax));
    float lower = 1.0 - smoothstep(top - 0.004, top + 0.004, faceY);
    float jawline = smoothstep(chinY - 0.028 - max(0.0, r.z) * 0.1, chinY - 0.006, faceY) * smoothstep(-0.035, -0.005, r.z);
    float beardZone = lower * jawline * (1.0 - smoothstep(0.066, 0.076, ax + max(0.0, -r.z) * 2.0));
    float mustache = (1.0 - smoothstep(0.005, 0.009, abs(faceY - (mouthY + 0.011)))) * (1.0 - smoothstep(0.026, 0.032, ax)) * front;
    float chinPatch = (1.0 - smoothstep(0.012, 0.024, length(vec2(r.x, (faceY - (chinY + 0.014)) * 0.8)))) * front;
    // individual whiskers: fine streaks running down the face, darker at the roots
    float strands = smoothstep(0.35, 0.75, vnoise(r * vec3(900.0, 160.0, 900.0)));
    float roots = 0.75 + 0.25 * vnoise(r * 1400.0);
    float lipClear = 1.0 - lip * 0.85;
    vec3 whisker = hairCol * (0.7 + 0.3 * strands) * roots;
    if (facial == 1) col = mix(col, mix(col, hairCol * 0.7, 0.55), beardZone * lipClear * (0.45 + 0.35 * strands));
    if (facial == 2) col = mix(col, whisker, max(mustache, chinPatch) * lipClear * (0.85 + 0.15 * strands));
    if (facial == 3) col = mix(col, whisker, max(beardZone, mustache) * lipClear * (0.94 + 0.06 * strands));
    // scalp: buzz cut shading or hair roots under the hair shell
    float hairline = eyeY + mix(0.068, -0.06, smoothstep(0.0, -0.08, r.z)) - smoothstep(0.045, 0.07, abs(r.x)) * smoothstep(0.06, 0.0, r.z) * 0.02;
    float scalp = smoothstep(hairline - 0.004, hairline + 0.006, faceY) * step(0.5, headW);
    // buzz cut: dense dark stubble on the scalp
    if (hairStyle == 1) col = mix(col, hairCol * (0.6 + 0.4 * vnoise(r * 1200.0)), scalp * 0.85);
    if (hairStyle >= 2) col = mix(col, hairCol * 0.6, scalp * 0.9);
    // face paint
    if (paint == 1) { // warrior: two-tone stripes across the face
      float band = step(0.5, fract((faceY + r.x * 0.6) * 22.0));
      col = mix(col, mix(uPrim, uSec, band), step(chinY, faceY) * front * 0.92);
    } else if (paint == 2) { // crow: white face, black eyes and mouth lines
      float eyeL = 1.0 - smoothstep(0.0, 0.004, abs(r.x - sign(r.x) * eyeX) - 0.006 + max(0.0, eyeY - faceY - 0.05) * 0.0);
      col = mix(col, vec3(0.92), step(chinY - 0.005, faceY) * front);
      col = mix(col, vec3(0.03), eyeL * step(eyeY - 0.06, faceY) * step(faceY, eyeY + 0.03) * front);
      col = mix(col, vec3(0.03), mouthLine * 3.0);
    } else if (paint == 3) { // half skull
      float half_ = step(0.0, -r.x);
      col = mix(col, vec3(0.9), half_ * step(chinY, faceY) * front);
      float socket = 1.0 - smoothstep(0.012, 0.016, length(vec2(r.x + eyeX, (faceY - eyeY) * 1.2)));
      col = mix(col, vec3(0.02), socket * half_);
    } else if (paint == 4) { // demon
      col = mix(col, vec3(0.5, 0.03, 0.03), step(chinY, faceY) * front * step(0.45, fbm(r * 40.0)));
    }
    // luchador / full mask
    if (uMask > 0.5) {
      float maskCover = smoothstep(chinY - 0.03, chinY - 0.01, faceY);
      vec3 m = uPrim;
      float eyeHole = 1.0 - smoothstep(0.012, 0.016, length(vec2(ax - eyeX, (faceY - eyeY) * 1.15)));
      float trim = (1.0 - smoothstep(0.016, 0.021, length(vec2(ax - eyeX, (faceY - eyeY) * 1.15)))) - eyeHole;
      float stripe = (1.0 - smoothstep(0.006, 0.009, ax)) * step(eyeY + 0.02, faceY);
      float flame = step(0.55, fbm(vec3(r.x * 40.0, faceY * 25.0, 1.0))) * step(eyeY + 0.03, faceY);
      m = mix(m, uSec, max(max(trim, stripe), flame * 0.8));
      float mouthHole = (1.0 - smoothstep(0.016, 0.022, length(vec2(r.x, (faceY - mouthY) * 0.9)))) * front;
      float open = max(eyeHole * 0.85, mouthHole);
      col = mix(col, m, maskCover * (1.0 - open));
      gearMask = max(gearMask, maskCover * (1.0 - open));
      gearRough = 0.32; gearSheen = 0.6;
    }
  }

  // ── tattoos ──
  vec3 ink = vec3(0.035, 0.045, 0.07);
  float tat = 0.0;
  bool onArm = armW > 0.45 && limbT > 0.0 && limbT < 1.05;
  if (onArm) {
    bool left = side > 0.0;
    float t = limbT;
    if ((left && has(1)) || (!left && has(2))) tat = max(tat, sleeveInk(r) * smoothstep(0.02, 0.06, t) * (1.0 - smoothstep(0.9, 0.95, t)));
    if ((left && has(4)) || (!left && has(8))) tat = max(tat, sleeveInk(r) * smoothstep(0.02, 0.06, t) * (1.0 - smoothstep(0.44, 0.5, t)));
    if ((left && has(16)) || (!left && has(32))) tat = max(tat, tribalInk(t * 14.0, atan(sphi, cphi) / 6.2832) * (1.0 - smoothstep(0.55, 0.6, t)));
  }
  if (torsoW > 0.45 && headW < 0.4) {
    bool frontSide = r.z > 0.0;
    float ax = abs(r.x);
    bool tribalSide = (r.x > 0.0 && has(16)) || (r.x < 0.0 && has(32));
    if (tribalSide && r.y > chestY - 0.13 && frontSide) tat = max(tat, tribalInk((r.y - chestY) * 40.0 + ax * 12.0, ax * 8.0) * smoothstep(0.02, 0.05, ax) * (1.0 - smoothstep(chestY + 0.02, chestY + 0.06, r.y)));
    if (has(64) && frontSide && r.y > chestY - 0.12 && r.y < chestY + 0.05) tat = max(tat, sleeveInk(vec3(ax, r.y, r.z)) * smoothstep(0.015, 0.03, ax));
    if (has(128) && !frontSide && r.y > navelY - 0.05) tat = max(tat, sleeveInk(vec3(ax, r.y, r.z)));
    if (has(512)) tat = max(tat, sleeveInk(r) * step(pelvisY + 0.08, r.y));
  }
  if (has(256) && headW > 0.4 && r.y < chinY - 0.005) tat = max(tat, sleeveInk(r));
  if (has(1024) && legW > 0.45 && abs(sphi) > 0.6) tat = max(tat, sleeveInk(r) * step(ankleY + 0.15, r.y));
  if (has(2048) && handW > 0.45) tat = max(tat, sleeveInk(r * 1.6));
  col = mix(col, ink, tat * 0.9);

  // ── ring gear ──
  float trunkTop = pelvisY + (outfit == 2 ? 0.0 : 0.075);
  float onBody = clamp(torsoW + thighW, 0.0, 1.0) * (1.0 - smoothstep(0.2, 0.5, handW + armW));
  float ax = abs(r.x);
  float briefBottom = pelvisY - 0.105 + smoothstep(0.03, 0.15, ax) * 0.075;
  float waistband = 0.0;
  float cover = 0.0;
  vec3 gear = uPrim;
  if (outfit == 0) { // trunks
    cover = onBody * step(briefBottom, r.y) * step(r.y, trunkTop);
    waistband = step(trunkTop - 0.018, r.y);
    float sideStripe = 1.0 - smoothstep(0.008, 0.012, abs(ax - 0.15));
    gear = mix(uPrim, uSec, max(waistband, sideStripe * 0.0));
  } else if (outfit == 1 || outfit == 3) { // tights / pants
    cover = max(onBody * step(r.y, trunkTop), clamp(legW, 0.0, 1.0)) * step(ankleY - 0.02, r.y);
    waistband = step(trunkTop - 0.022, r.y) * step(r.y, trunkTop);
    float panel = (1.0 - smoothstep(0.25, 0.35, abs(abs(sphi) - 1.0) + 0.0)) * step(0.45, legW);
    if (outfit == 1) {
      float flameUp = step(0.55, fbm(vec3(r.x * 30.0, r.y * 12.0 - uSeed, r.z * 30.0))) * smoothstep(kneeY + 0.1, ankleY + 0.1, r.y);
      gear = mix(uPrim, uSec, max(max(waistband, panel * 0.9), flameUp * 0.0));
      gearRough = 0.35; gearSheen = 0.7;
    } else {
      float weave = 0.85 + 0.15 * vnoise(r * vec3(900.0, 200.0, 900.0));
      float seam = 1.0 - smoothstep(0.0, 0.004, abs(abs(sphi) - 1.0)) * step(0.45, legW);
      gear = uPrim * weave * (1.0 - 0.35 * seam);
      gear = mix(gear, uSec, waistband);
      gearRough = 0.85;
    }
  } else if (outfit == 2) { // singlet
    float strap = (1.0 - smoothstep(0.024, 0.03, abs(ax - 0.1))) * step(chestY - 0.02, r.y);
    float bodyPart = step(r.y, chestY - 0.01 - (r.z > 0.0 ? 0.03 : 0.0));
    float legPart = step(pelvisY - 0.2, r.y);
    cover = onBody * max(bodyPart, strap) * legPart + clamp(thighW, 0.0, 1.0) * legPart * step(0.45, thighW);
    float sideP = 1.0 - smoothstep(0.02, 0.03, abs(ax - 0.16 + (r.y - pelvisY) * 0.15));
    gear = mix(uPrim, uSec, sideP * step(r.y, chestY - 0.05));
    gearRough = 0.3; gearSheen = 0.8;
  } else if (outfit == 4) { // bodysuit
    cover = (1.0 - smoothstep(0.3, 0.5, headW)) * (1.0 - smoothstep(0.4, 0.6, handW)) * step(ankleY - 0.02, r.y);
    float sideP = 1.0 - smoothstep(0.015, 0.025, abs(ax - 0.12 - (r.y - chestY) * 0.08));
    gear = mix(uPrim, uSec, sideP * step(pelvisY - 0.05, r.y));
    gearRough = 0.3; gearSheen = 0.8;
  }
  col = mix(col, gear, cover);
  gearMask = max(gearMask, cover);

  // boots with laces and soles
  float bootTop = ankleY + (kneeY - ankleY) * 0.55;
  float boot = step(r.y, bootTop) * step(0.3, legW + footW) * (1.0 - step(0.5, handW + armW));
  if (boot > 0.5) {
    float lace = (1.0 - smoothstep(0.012, 0.016, ax - 0.098 + 0.0)) * 0.0;
    float laces = step(0.55, cphi) * step(0.5, fract(r.y * 70.0)) * step(r.y, bootTop - 0.01) * step(0.03, r.y);
    vec3 b = uBoot * (1.0 - 0.25 * laces);
    b = mix(b, uSec, (1.0 - smoothstep(0.004, 0.007, abs(r.y - bootTop + 0.008))) * 0.9);
    if (r.y < 0.022) b = vec3(0.03);
    col = b;
    gearMask = 1.0; gearRough = 0.22; gearSheen = 0.2;
  }
  // kneepads
  if (uFlags.x > 0.5) {
    float pad = (1.0 - smoothstep(0.045, 0.055, abs(r.y - kneeY))) * step(0.4, legW) * smoothstep(-0.4, 0.2, cphi);
    col = mix(col, uSec * 0.9, pad);
    gearMask = max(gearMask, pad);
  }
  // elbow pads
  if (uFlags.w > 0.5) {
    float pad = (1.0 - smoothstep(0.045, 0.06, abs(limbT - 0.5))) * step(0.4, armW) * step(0.0, limbT);
    col = mix(col, vec3(0.05), pad);
    gearMask = max(gearMask, pad);
  }
  // wrist tape
  if (uFlags.y > 0.5 && limbT > 0.88 && limbT < 1.0 && armW > 0.4) {
    float tape = 0.85 + 0.15 * vnoise(r * vec3(300.0, 2000.0, 300.0));
    col = vec3(0.92, 0.9, 0.86) * tape;
    gearMask = 1.0; gearRough = 0.8;
  }
  // fingerless MMA gloves
  if (uFlags.z > 0.5 && handW > 0.45 && limbT < 1.14) {
    col = mix(uSec, vec3(0.04), 0.6);
    gearMask = 1.0; gearRough = 0.35;
  }
  diffuseColor.rgb = col;
}`,
      )
      .replace(
        "#include <roughnessmap_fragment>",
        `#include <roughnessmap_fragment>
roughnessFactor = mix(roughnessFactor - uSweat * 0.16, gearRough, gearMask);`,
      )
      .replace(
        "#include <lights_physical_fragment>",
        `#include <lights_physical_fragment>
material.clearcoat = mix(0.08 + uSweat * 0.55, 0.0, gearMask);
material.sheenColor = mix(material.sheenColor, diffuseColor.rgb * 0.8, gearMask) * (1.0 - gearMask + gearMask * gearSheen);`,
      );
  };
  mat.customProgramCacheKey = () => "wrestler-skin-v1";
  return { material: mat, uniforms };
}
