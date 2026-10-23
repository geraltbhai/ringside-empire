/**
 * Skin + ring gear material. A MeshPhysicalMaterial whose colour, roughness,
 * sheen and surface detail are painted per pixel from rest-pose coordinates
 * and body-region weights (see sculpt.ts):
 *  - skin: MakeHuman photo detail tinted to the wrestler's tone, baked ambient
 *    occlusion, muscle definition from surface curvature, pore bump detail
 *  - face: stubble, masks (five styles, eight patterns) and face paint
 *  - gear: trunks / tights / pants / singlet / bodysuit with patterns, three
 *    colours and lettering; boots, kick pads, sneakers or bare feet; knee and
 *    elbow pads, sleeves, wrist tape, gloves
 *  - tattoos: free-hand sleeves and Polynesian tribal bands
 */
import * as THREE from "three";
import type { Appearance, GearPattern, MaskPattern, MaskStyle, TattooSpot } from "@/engine/types";
import type { Landmarks } from "./sculpt";

const OUTFIT = { trunks: 0, tights: 1, singlet: 2, pants: 3, bodysuit: 4 } as const;
const FACIAL = { none: 0, stubble: 1, goatee: 2, beard: 3 } as const;
const HAIR = { bald: 0, buzz: 1, short: 2, long: 3, mohawk: 4, ponytail: 5 } as const;
const PAINT = { none: 0, warrior: 1, crow: 2, skull: 3, demon: 4 } as const;
const PATTERN: Record<GearPattern, number> = { solid: 0, stripes: 1, flames: 2, stars: 3, camo: 4, checker: 5, tribal: 6, fade: 7, lightning: 8, splatter: 9, snake: 10 };
const MASK_STYLE: Record<MaskStyle, number> = { luchador: 1, full: 2, half: 3, eyes: 4, skull: 5 };
const MASK_PATTERN: Record<MaskPattern, number> = { plain: 0, flames: 1, stripes: 2, stars: 3, cross: 4, web: 5, wings: 6, teeth: 7 };
const BOOTS = { boots: 0, kickpads: 1, sneakers: 2, barefoot: 3 } as const;
const GLOVES = { fingerless: 0, full: 1, wraps: 2 } as const;
const SLEEVE = { none: 0, left: 1, right: 2, both: 3 } as const;
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

/** Lettering for the gear (initials, a catchphrase), drawn once per wrestler. */
export function gearTextTexture(text: string, color: string) {
  if (typeof document === "undefined" || !text.trim()) return null;
  const c = document.createElement("canvas");
  c.width = 512;
  c.height = 128;
  const g = c.getContext("2d")!;
  g.clearRect(0, 0, 512, 128);
  g.font = `900 ${text.length > 5 ? 70 : 96}px "Anton", "Impact", "Arial Black", sans-serif`;
  g.textAlign = "center";
  g.textBaseline = "middle";
  g.lineWidth = 10;
  g.strokeStyle = "rgba(0,0,0,0.85)";
  g.strokeText(text.toUpperCase(), 256, 68);
  g.fillStyle = color;
  g.fillText(text.toUpperCase(), 256, 68);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

/**
 * `skinMap` is a MakeHuman skin texture (pores, lips, nipples, knuckles); it is
 * used as detail and tinted to the wrestler's tone. `skinMean` / `headMean` are
 * its average linear colours, so the tint keeps the wrestler's exact skin tone.
 */
export function createSkinMaterial(a: Appearance, lm: Landmarks, seed: number, skinMap: THREE.Texture | null, skinMean: THREE.Vector3, headMean: THREE.Vector3 = skinMean, textMap: THREE.Texture | null = null) {
  const bits = (a.tattoos ?? []).reduce((s, t) => s | TATTOO_BITS[t], 0);
  const maskStyle = a.mask ? MASK_STYLE[a.maskStyle ?? "luchador"] : 0;
  const definition = a.definition * (1 - a.bodyFat * 0.85);
  const uniforms: SkinUniforms = {
    uSkin: { value: hexToVec3(a.skinTone) },
    uHair: { value: hexToVec3(a.hairColor) },
    uPrim: { value: hexToVec3(a.primaryColor) },
    uSec: { value: hexToVec3(a.secondaryColor) },
    uAcc: { value: hexToVec3(a.accentColor ?? a.secondaryColor) },
    uBoot: { value: hexToVec3(a.bootColor) },
    uStyle: { value: new THREE.Vector4(OUTFIT[a.outfit], FACIAL[a.facialHair], HAIR[a.hairStyle], PAINT[a.facePaint ?? "none"]) },
    uFlags: { value: new THREE.Vector4(a.kneepads ? 1 : 0, a.wristTape ? 1 : 0, a.gloves ? 1 : 0, a.elbowPads ? 1 : 0) },
    uGear: { value: new THREE.Vector4(PATTERN[a.gearPattern ?? "solid"], BOOTS[a.bootStyle ?? "boots"], GLOVES[a.gloveStyle ?? "fingerless"], SLEEVE[a.armSleeve ?? "none"]) },
    uMaskStyle: { value: new THREE.Vector3(maskStyle, MASK_PATTERN[a.maskPattern ?? "plain"], a.kneeSleeves ? 1 : 0) },
    uTattoo: { value: bits },
    uSeed: { value: (seed % 1000) / 37 },
    uSweat: { value: 0 },
    uDef: { value: definition },
    uL1: { value: new THREE.Vector4(lm.headTop, lm.eyeY, lm.mouthY, lm.chinY) },
    uL2: { value: new THREE.Vector4(lm.pelvisY, lm.navelY, lm.kneeY, lm.ankleY) },
    uL3: { value: new THREE.Vector4(lm.eyeX, lm.eyeZ, lm.chestY, lm.neckY) },
    uSkinMap: { value: skinMap },
    uSkinMean: { value: skinMean },
    uHeadMean: { value: headMean },
    uHasMap: { value: skinMap ? 1 : 0 },
    uText: { value: textMap },
    uHasText: { value: textMap ? 1 : 0 },
  };
  const mat = new THREE.MeshPhysicalMaterial({
    color: "#ffffff",
    roughness: 0.5,
    sheen: 0.35,
    sheenRoughness: 0.45,
    sheenColor: new THREE.Color("#ff8a6a"),
    clearcoat: 0.08,
    clearcoatRoughness: 0.3,
    specularIntensity: 0.6,
  });
  mat.onBeforeCompile = (shader) => {
    Object.assign(shader.uniforms, uniforms);
    shader.vertexShader = shader.vertexShader
      .replace(
        "#include <common>",
        `#include <common>
attribute vec3 aRest; attribute vec4 aRegA; attribute vec4 aRegB; attribute vec4 aLimb; attribute vec2 aShade;
varying vec3 vRest; varying vec4 vRegA; varying vec4 vRegB; varying vec4 vLimb; varying vec2 vSkinUv; varying vec2 vShade;`,
      )
      .replace(
        "#include <begin_vertex>",
        `#include <begin_vertex>
vRest = aRest; vRegA = aRegA; vRegB = aRegB; vLimb = aLimb; vSkinUv = uv; vShade = aShade;`,
      );
    shader.fragmentShader = shader.fragmentShader
      .replace(
        "#include <common>",
        `#include <common>
varying vec3 vRest; varying vec4 vRegA; varying vec4 vRegB; varying vec4 vLimb; varying vec2 vSkinUv; varying vec2 vShade;
uniform sampler2D uSkinMap; uniform vec3 uSkinMean; uniform vec3 uHeadMean; uniform float uHasMap;
uniform sampler2D uText; uniform float uHasText;
uniform vec3 uSkin, uHair, uPrim, uSec, uAcc, uBoot;
uniform vec4 uStyle, uFlags, uGear, uL1, uL2, uL3;
uniform vec3 uMaskStyle;
uniform float uSeed, uSweat, uDef;
uniform int uTattoo;
${NOISE}
float gearMask = 0.0; float gearRough = 0.6; float gearSheen = 0.0; float bumpAmt = 1.0; float clothBump = 0.0;
bool has(int bit){ return (uTattoo & bit) != 0; }
float h21(vec2 p){ return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
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
}
float starShape(vec2 p, float r){
  // five-point star SDF (approximate), filled
  float a = atan(p.y, p.x) + 1.5708;
  float k = 0.5 + 0.5 * cos(a * 5.0);
  return 1.0 - smoothstep(r * (0.45 + 0.55 * k) - 0.002, r * (0.45 + 0.55 * k) + 0.002, length(p));
}
/** Accent coverage (0..1, or 2 for a third colour) of a gear pattern at rest point r; h = 0..1 up the garment. */
float gearPat(int pat, vec3 r, float h, float sphi){
  if (pat == 1) return step(0.62, fract(r.y * 26.0)) * 1.0;
  if (pat == 2) { // flames licking up from the bottom
    float n = fbm(vec3(r.x * 16.0, r.y * 5.0 - uSeed, r.z * 16.0));
    float tongues = 0.38 + 0.35 * (n - 0.5) * 2.4 + 0.12 * sin(atan(r.x, r.z) * 9.0 + r.y * 10.0);
    float inner = step(h, tongues - 0.08);
    return step(h, tongues) * (inner > 0.5 ? 2.0 : 1.0);
  }
  if (pat == 3) {
    vec2 q = vec2(atan(r.x, r.z) * 0.12, r.y) * 16.0;
    vec2 c = floor(q);
    vec2 f = fract(q) - 0.5;
    return h21(c) > 0.45 ? starShape(f * 0.06, 0.018) : 0.0;
  }
  if (pat == 4) { float n = fbm(r * 9.0 + uSeed); return n > 0.58 ? 2.0 : n > 0.48 ? 1.0 : 0.0; }
  if (pat == 5) return mod(floor(r.x * 22.0) + floor(r.y * 22.0) + floor(r.z * 22.0), 2.0);
  if (pat == 6) return tribalInk(r.y * 18.0, atan(r.x, r.z) / 6.2832 * 3.0);
  if (pat == 7) return smoothstep(0.15, 0.85, h);
  if (pat == 8) { float zig = abs(fract(r.y * 6.0 + abs(fract(atan(r.x, r.z) * 1.6) - 0.5)) - 0.5); return step(zig, 0.06); }
  if (pat == 9) return step(0.66, fbm(r * 22.0 + uSeed));
  if (pat == 10) { // snake skin: scales with darker edges and an accent saddle
    vec2 q = vec2(atan(r.x, r.z) * 0.6, r.y) * 60.0;
    q.x += mod(floor(q.y), 2.0) * 0.5;
    vec2 f = fract(q) - 0.5;
    float edge = smoothstep(0.32, 0.48, max(abs(f.x), abs(f.y)));
    return edge > 0.5 ? 2.0 : step(0.55, fbm(r * 7.0 + uSeed));
  }
  return 0.0;
}
vec3 patColor(float k){ return k > 1.5 ? uAcc : mix(uPrim, uSec, clamp(k, 0.0, 1.0)); }`,
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
  int pattern = int(uGear.x + 0.5); int bootStyle = int(uGear.y + 0.5); int gloveStyle = int(uGear.z + 0.5); int sleeve = int(uGear.w + 0.5);
  int maskStyle = int(uMaskStyle.x + 0.5); int maskPat = int(uMaskStyle.y + 0.5);
  float ao = vShade.x; float cav = vShade.y;

  // ── skin: photographic detail from the skin map, tinted to this wrestler's tone ──
  vec3 col = uSkin;
  if (uHasMap > 0.5) {
    vec3 tex = texture2D(uSkinMap, vSkinUv).rgb;
    // the head has its own UV island (u > 0.62) with a different base brightness
    vec3 mean = vSkinUv.x > 0.62 && vSkinUv.y > 0.15 ? uHeadMean : uSkinMean;
    col = uSkin * clamp(tex / mean, 0.0, 2.2) * (vSkinUv.x > 0.62 && vSkinUv.y > 0.15 ? 0.94 : 1.0);
  }
  col *= 0.97 + 0.06 * fbm(r * 55.0 + uSeed);
  // muscle definition: creases between muscles darken, the bellies of the muscles catch light
  float crease = clamp(cav * 5.0, 0.0, 1.0);
  float ridge = clamp(-cav * 5.0, 0.0, 1.0);
  col *= 1.0 - crease * (0.18 + 0.32 * uDef) * (1.0 - headW * 0.6);
  col *= 1.0 + ridge * 0.08 * uDef;
  vec3 hairCol = uHair;

  // ── face ──
  float front = smoothstep(-0.02, 0.04, r.z);
  float ax = abs(r.x);
  if (headW > 0.4) {
    float faceY = r.y;
    float lip = (1.0 - smoothstep(0.006, 0.01, abs(faceY - mouthY))) * (1.0 - smoothstep(0.022, 0.028, ax)) * front;
    float mouthLine = (1.0 - smoothstep(0.0005, 0.0015, abs(faceY - mouthY))) * (1.0 - smoothstep(0.016, 0.022, ax)) * front;
    // facial hair zones (the hair itself is fur geometry; here only the shadow of the roots)
    float top = mix(mouthY + 0.014, eyeY - 0.035, smoothstep(0.016, 0.045, ax));
    float lower = 1.0 - smoothstep(top - 0.004, top + 0.006, faceY);
    float neckline = chinY - 0.022 + smoothstep(0.015, 0.062, ax) * (mouthY - chinY + 0.014);
    float jawline = smoothstep(neckline - 0.004, neckline + 0.006, faceY) * smoothstep(-0.012, 0.008, r.z);
    float beardZone = lower * jawline * (1.0 - smoothstep(0.066, 0.078, ax + max(0.0, -r.z) * 2.0));
    float roots = smoothstep(0.35, 0.8, vnoise(r * 2200.0));
    if (facial == 1) col = mix(col, col * mix(vec3(1.0), hairCol * 1.4 + 0.08, 0.9), beardZone * (1.0 - lip) * (0.35 + 0.5 * roots));
    if (facial >= 2) col = mix(col, col * (hairCol * 1.2 + 0.12), beardZone * (1.0 - lip) * (facial == 3 ? 0.75 : 0.3));
    // scalp shadow under hair
    float hairline = eyeY + mix(0.068, -0.06, smoothstep(0.0, -0.08, r.z)) - smoothstep(0.045, 0.07, abs(r.x)) * smoothstep(0.06, 0.0, r.z) * 0.02;
    float scalp = smoothstep(hairline - 0.004, hairline + 0.006, faceY) * step(0.5, headW);
    if (hairStyle == 1) col = mix(col, col * (hairCol * 1.3 + 0.08), scalp * 0.8);
    if (hairStyle >= 2) col = mix(col, hairCol * 0.5, scalp * 0.9);
    // face paint
    if (paint == 1) { // warrior: two-tone stripes across the face
      float band = step(0.5, fract((faceY + r.x * 0.6) * 22.0));
      col = mix(col, mix(uPrim, uSec, band), step(chinY, faceY) * front * 0.92);
    } else if (paint == 2) { // crow: white face, black eyes and mouth lines
      float eyeL = 1.0 - smoothstep(0.0, 0.004, abs(r.x - sign(r.x) * eyeX) - 0.006);
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
    // masks
    if (maskStyle > 0) {
      vec2 e = vec2(ax - eyeX, (faceY - eyeY) * 1.15);
      float eyeHole = 1.0 - smoothstep(maskStyle == 2 ? 0.009 : 0.012, maskStyle == 2 ? 0.012 : 0.016, length(e));
      float trim = (1.0 - smoothstep(0.016, 0.022, length(e))) - eyeHole;
      float cover = smoothstep(chinY - 0.03, chinY - 0.01, faceY);
      float mouthHole = (1.0 - smoothstep(0.016, 0.022, length(vec2(r.x, (faceY - mouthY) * 0.9)))) * front;
      if (maskStyle == 2) mouthHole = 0.0;                                   // full: closed mouth
      if (maskStyle == 3) cover *= smoothstep(mouthY + 0.008, mouthY + 0.02, faceY) * (1.0 - front * smoothstep(eyeY - 0.03, eyeY - 0.05, faceY) * 0.0); // half: upper face
      if (maskStyle == 4) { cover = (1.0 - smoothstep(0.018, 0.026, abs(faceY - eyeY - 0.004))) * front * (1.0 - smoothstep(0.075, 0.085, ax)); trim = 0.0; } // eye mask
      vec3 m = uPrim;
      float acc = 0.0;
      if (maskStyle == 1) acc = max(trim, 0.0);
      if (maskStyle == 5) { // skull: bone white with black sockets, nose and teeth
        m = vec3(0.88, 0.86, 0.8);
        float sock = 1.0 - smoothstep(0.016, 0.022, length(e));
        float nose = (1.0 - smoothstep(0.006, 0.01, ax)) * step(mouthY + 0.012, faceY) * step(faceY, eyeY - 0.02) * front;
        float teeth = (1.0 - smoothstep(0.004, 0.006, abs(faceY - mouthY))) * (1.0 - smoothstep(0.03, 0.035, ax)) * front;
        float gaps = step(0.85, fract(r.x * 130.0)) * (1.0 - smoothstep(0.012, 0.016, abs(faceY - mouthY))) * (1.0 - smoothstep(0.03, 0.035, ax)) * front;
        m = mix(m, vec3(0.02), max(max(sock, nose), max(teeth * 0.0, gaps)));
        mouthHole = 0.0;
      }
      // pattern overlays
      if (maskPat == 1) acc = max(acc, step(0.55, fbm(vec3(r.x * 40.0, faceY * 22.0, 1.0)) + (faceY - eyeY) * 4.0) * step(eyeY, faceY));
      if (maskPat == 2) acc = max(acc, (1.0 - smoothstep(0.006, 0.009, ax)) * step(eyeY + 0.02, faceY) + (1.0 - smoothstep(0.004, 0.006, abs(ax - 0.03))) * step(eyeY + 0.025, faceY));
      if (maskPat == 3) { vec2 q = vec2(r.x, faceY) * 40.0; acc = max(acc, h21(floor(q)) > 0.75 ? starShape((fract(q) - 0.5) * 0.025, 0.009) : 0.0); }
      if (maskPat == 4) acc = max(acc, max((1.0 - smoothstep(0.005, 0.008, ax)) * step(eyeY + 0.02, faceY), (1.0 - smoothstep(0.004, 0.007, abs(faceY - eyeY - 0.05))) * (1.0 - smoothstep(0.03, 0.035, ax))));
      if (maskPat == 5) { float ang = atan(r.x, faceY - eyeY); float rad = length(vec2(r.x, faceY - eyeY)); acc = max(acc, max(step(abs(fract(ang * 1.9) - 0.5), 0.04), step(abs(fract(rad * 45.0) - 0.5), 0.05))); }
      if (maskPat == 6) acc = max(acc, step(abs(faceY - eyeY - (ax - eyeX) * 0.9 - 0.012 * sin(ax * 180.0)), 0.006) * step(eyeX, ax) * front);
      if (maskPat == 7) acc = max(acc, step(abs(fract(r.x * 70.0) - 0.5) * 0.02 + mouthY - 0.008, faceY) * step(faceY, mouthY + 0.008) * (1.0 - smoothstep(0.03, 0.04, ax)) * front);
      m = mix(m, uSec, clamp(acc, 0.0, 1.0));
      float open = max(eyeHole * 0.9, mouthHole);
      col = mix(col, m, cover * (1.0 - open));
      gearMask = max(gearMask, cover * (1.0 - open));
      gearRough = 0.32; gearSheen = 0.6;
      clothBump = max(clothBump, cover * (1.0 - open));
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
  float briefBottom = pelvisY - 0.105 + smoothstep(0.03, 0.15, ax) * 0.075;
  float waistband = 0.0;
  float cover = 0.0;
  float gearLo = briefBottom;
  vec3 gear = uPrim;
  if (outfit == 0) { // trunks
    cover = onBody * step(briefBottom, r.y) * step(r.y, trunkTop);
    waistband = step(trunkTop - 0.018, r.y);
    gearRough = 0.32; gearSheen = 0.7;
  } else if (outfit == 1 || outfit == 3) { // tights / pants
    cover = max(onBody * step(r.y, trunkTop), clamp(legW, 0.0, 1.0)) * step(ankleY - 0.02, r.y);
    waistband = step(trunkTop - 0.022, r.y) * step(r.y, trunkTop);
    gearLo = ankleY;
    gearRough = outfit == 1 ? 0.4 : 0.85; gearSheen = outfit == 1 ? 0.6 : 0.2;
  } else if (outfit == 2) { // singlet
    float strap = (1.0 - smoothstep(0.024, 0.03, abs(ax - 0.1))) * step(chestY - 0.02, r.y);
    float bodyPart = step(r.y, chestY - 0.01 - (r.z > 0.0 ? 0.03 : 0.0));
    float legPart = step(pelvisY - 0.2, r.y);
    cover = onBody * max(bodyPart, strap) * legPart + clamp(thighW, 0.0, 1.0) * legPart * step(0.45, thighW);
    gearLo = pelvisY - 0.2;
    gearRough = 0.3; gearSheen = 0.8;
  } else if (outfit == 4) { // bodysuit
    cover = (1.0 - smoothstep(0.3, 0.5, headW)) * (1.0 - smoothstep(0.4, 0.6, handW)) * step(ankleY - 0.02, r.y);
    gearLo = ankleY;
    gearRough = 0.3; gearSheen = 0.8;
  }
  if (cover > 0.0) {
    float h = clamp((r.y - gearLo) / max(0.05, trunkTop - gearLo), 0.0, 1.0);
    float k = gearPat(pattern, r, h, sphi);
    gear = pattern == 7 ? mix(uPrim, uSec, k) : patColor(k);
    // side panels on long tights, piping on trunks
    if (outfit == 1 && pattern == 0) gear = mix(gear, uSec, (1.0 - smoothstep(0.25, 0.35, abs(abs(sphi) - 1.0))) * step(0.45, legW) * 0.9);
    if (outfit == 3) {
      float weave = 0.85 + 0.15 * vnoise(r * vec3(900.0, 200.0, 900.0));
      float seam = 1.0 - smoothstep(0.0, 0.004, abs(abs(sphi) - 1.0)) * step(0.45, legW);
      gear *= weave * (1.0 - 0.35 * seam);
    }
    gear = mix(gear, uSec, waistband);
    // lettering across the seat (and down the leg on tights)
    if (uHasText > 0.5) {
      vec2 tuv = vec2(-r.x / 0.26 + 0.5, (r.y - (pelvisY - 0.06)) / 0.075);
      if (r.z < -0.02 && tuv.x > 0.0 && tuv.x < 1.0 && tuv.y > 0.0 && tuv.y < 1.0) {
        vec4 tx = texture2D(uText, tuv);
        gear = mix(gear, tx.rgb, tx.a);
      }
      if (outfit == 1 && legW > 0.45 && side < 0.0) {
        vec2 luv = vec2((r.y - kneeY) / 0.3, sphi * 0.5 + 0.5);
        if (luv.x > 0.0 && luv.x < 1.0 && cphi > 0.3) { vec4 tx = texture2D(uText, vec2(luv.x, luv.y)); gear = mix(gear, tx.rgb, tx.a); }
      }
    }
    col = mix(col, gear, cover);
    gearMask = max(gearMask, cover);
    clothBump = max(clothBump, cover);
  }

  // arm sleeves and knee sleeves (compression gear)
  if (sleeve > 0 && armW > 0.45 && limbT > 0.08 && limbT < 0.93) {
    bool want = sleeve == 3 || (sleeve == 1 && side > 0.0) || (sleeve == 2 && side < 0.0);
    if (want) { col = mix(uPrim, uAcc, step(0.88, limbT) + step(limbT, 0.11)); gearMask = 1.0; gearRough = 0.45; gearSheen = 0.5; clothBump = 1.0; }
  }
  if (uMaskStyle.z > 0.5 && legW > 0.45 && abs(r.y - kneeY - 0.01) < 0.11) { col = vec3(0.06); gearMask = 1.0; gearRough = 0.55; clothBump = 1.0; }

  // footwear
  float shoeTop = bootStyle == 2 ? ankleY + 0.03 : ankleY + (kneeY - ankleY) * 0.55;
  float onFoot = step(0.3, legW + footW) * (1.0 - step(0.5, handW + armW));
  if (bootStyle != 3 && onFoot > 0.5 && r.y < shoeTop) {
    float laces = step(0.55, cphi) * step(0.5, fract(r.y * 70.0)) * step(r.y, shoeTop - 0.01) * step(0.03, r.y);
    vec3 b = uBoot * (1.0 - 0.25 * laces);
    b = mix(b, uSec, (1.0 - smoothstep(0.004, 0.007, abs(r.y - shoeTop + 0.008))) * 0.9);
    if (r.y < 0.022) b = bootStyle == 2 ? vec3(0.92) : vec3(0.03);
    col = b;
    gearMask = 1.0; gearRough = bootStyle == 2 ? 0.6 : 0.22; gearSheen = 0.2;
  }
  // kick pads over the shins
  if (bootStyle == 1 && legW > 0.4 && r.y > ankleY + 0.02 && r.y < kneeY - 0.02 && cphi > -0.1) {
    float stitch = step(0.9, fract((r.y - ankleY) * 30.0));
    col = mix(uAcc, uSec, stitch * 0.6);
    gearMask = 1.0; gearRough = 0.3; gearSheen = 0.5;
  }
  if (bootStyle == 3 && uFlags.y > 0.5 && footW + legW > 0.3 && abs(r.y - ankleY) < 0.035) { col = vec3(0.92, 0.9, 0.86); gearMask = 1.0; gearRough = 0.8; }
  // kneepads
  if (uFlags.x > 0.5) {
    float pad = (1.0 - smoothstep(0.045, 0.055, abs(r.y - kneeY))) * step(0.4, legW) * smoothstep(-0.4, 0.2, cphi);
    col = mix(col, mix(uSec, uAcc, 0.5) * 0.9, pad);
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
  // gloves
  if (uFlags.z > 0.5 && handW > 0.45) {
    if (gloveStyle == 0 && limbT < 1.14) { col = mix(uSec, vec3(0.04), 0.6); gearMask = 1.0; gearRough = 0.35; }
    if (gloveStyle == 1) { col = mix(uPrim, vec3(0.03), 0.5); gearMask = 1.0; gearRough = 0.35; }
    if (gloveStyle == 2 && limbT < 1.1) { col = vec3(0.9, 0.88, 0.84) * (0.85 + 0.15 * vnoise(r * vec3(300.0, 2000.0, 300.0))); gearMask = 1.0; gearRough = 0.85; }
  }

  // ambient occlusion: creases, sockets, armpits
  col *= mix(1.0, ao, 0.9);
  bumpAmt = 1.0 - gearMask;
  diffuseColor.rgb = col;
}`,
      )
      .replace(
        "#include <roughnessmap_fragment>",
        `#include <roughnessmap_fragment>
// oily T-zone and sweat on skin; occluded areas don't shine
float skinRough = 0.5 - uSweat * 0.16 - (vRegA.y > 0.5 ? 0.06 * smoothstep(0.02, -0.0, abs(vRest.x) - 0.02) : 0.0);
roughnessFactor = mix(skinRough, gearRough, gearMask);
roughnessFactor = mix(roughnessFactor, 1.0, (1.0 - vShade.x) * 0.5);`,
      )
      .replace(
        "#include <normal_fragment_maps>",
        `#include <normal_fragment_maps>
{
  // procedural bump: skin pores and fine creases, or a fabric weave on gear
  float hgt = bumpAmt * (vnoise(vRest * 900.0) * 0.6 + vnoise(vRest * 2600.0) * 0.4) * 0.00035
    + clothBump * vnoise(vRest * vec3(1400.0, 250.0, 1400.0)) * 0.00025;
  vec3 sp = -vViewPosition;
  vec3 sx = dFdx(sp);
  vec3 sy = dFdy(sp);
  vec3 r1 = cross(sy, normal);
  vec3 r2 = cross(normal, sx);
  float det = dot(sx, r1);
  vec2 dh = vec2(dFdx(hgt), dFdy(hgt));
  vec3 grad = sign(det) * (dh.x * r1 + dh.y * r2);
  normal = normalize(abs(det) * normal - grad);
}`,
      )
      .replace(
        "#include <lights_physical_fragment>",
        `#include <lights_physical_fragment>
material.clearcoat = mix(0.06 + uSweat * 0.55, 0.0, gearMask);
material.sheenColor = mix(material.sheenColor, diffuseColor.rgb * 0.8, gearMask) * (1.0 - gearMask + gearMask * gearSheen);`,
      );
  };
  mat.customProgramCacheKey = () => "wrestler-skin-v2";
  return { material: mat, uniforms };
}
