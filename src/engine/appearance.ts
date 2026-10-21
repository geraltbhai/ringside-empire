/**
 * Default physiques. Shared by the roster generator and the v1→v2 save migration
 * so a wrestler's body is always derived the same way from style, size and age.
 */
import { hashString } from "./rng";
import type { Appearance, Division, FaceShape, WrestlingStyle } from "./types";

export type BodyFields = Pick<Appearance, "muscle" | "definition" | "bodyFat" | "shoulderWidth" | "armSize" | "legSize" | "bootColor" | "kneepads" | "wristTape">;

/** [muscle, definition, bodyFat] by style. */
const STYLE_BUILD: Record<WrestlingStyle, [number, number, number]> = {
  powerhouse: [0.9, 0.62, 0.18],
  giant: [0.72, 0.28, 0.5],
  "high-flyer": [0.5, 0.82, 0.05],
  technician: [0.6, 0.58, 0.14],
  brawler: [0.72, 0.42, 0.32],
  striker: [0.6, 0.78, 0.08],
  showman: [0.72, 0.68, 0.14],
  "all-rounder": [0.76, 0.66, 0.12],
};

const r2 = (v: number) => Math.round(Math.max(0, Math.min(1, v)) * 100) / 100;

export function defaultBuild(input: { id: string; style: WrestlingStyle; division: Division; weightLbs: number; heightIn: number; age: number; bulk: number }): BodyFields {
  const h = hashString(`${input.id}:build`);
  const j = (shift: number, spread: number) => (((h >>> shift) % 1000) / 1000 - 0.5) * spread;
  let [muscle, definition, bodyFat] = STYLE_BUILD[input.style];
  // Weight per inch of height relative to an athletic baseline.
  const density = input.weightLbs / input.heightIn - (input.division === "women" ? 1.95 : 3.1);
  bodyFat += Math.max(0, density) * 0.12;
  muscle += density * 0.05;
  if (input.age >= 40) {
    definition -= 0.15;
    bodyFat += 0.08;
  }
  if (input.division === "women") {
    muscle *= 0.62;
    definition *= 0.85;
  }
  return {
    muscle: r2(muscle + j(1, 0.12)),
    definition: r2(definition + j(5, 0.14)),
    bodyFat: r2(bodyFat + j(9, 0.08)),
    shoulderWidth: r2(0.5 + (input.style === "powerhouse" || input.style === "giant" ? 0.12 : 0) + j(13, 0.16)),
    armSize: r2(0.5 + j(17, 0.2)),
    legSize: r2(0.5 + (input.style === "high-flyer" || input.style === "striker" ? 0.06 : 0) + j(21, 0.2)),
    bootColor: ["#111318", "#111318", "#f5f5f4", "#7f1d1d"][(h >>> 25) % 4],
    kneepads: (h >>> 3) % 3 !== 0,
    wristTape: (h >>> 7) % 2 === 0,
  };
}

/** Face shape: explicit values win, the rest come from a hash so everyone looks different. */
export function faceFor(id: string, a: Appearance): FaceShape {
  const h = hashString(`${id}:face`);
  const r = (shift: number) => ((h >>> shift) % 1000) / 1000;
  const heavy = a.bulk * 0.5 + a.bodyFat * 0.3;
  return {
    jaw: 0.35 + r(1) * 0.4 + heavy * 0.25,
    chin: 0.25 + r(5) * 0.6,
    brow: 0.3 + r(9) * 0.5 + a.muscle * 0.1,
    nose: 0.3 + r(13) * 0.5,
    cheeks: 0.3 + r(17) * 0.5,
    width: 0.35 + r(21) * 0.35 + heavy * 0.25,
    length: 0.3 + r(25) * 0.45,
    ...a.face,
  };
}

