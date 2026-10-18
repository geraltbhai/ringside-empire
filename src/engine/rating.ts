/**
 * Wrestler rating model.
 *
 * Five separate ratings are produced and never collapsed into one another:
 *  - In-ring:       style-weighted average of the 15 in-ring attributes
 *  - Entertainment: charisma, promo and crowd connection
 *  - Popularity:    stored value, moved by results and booking
 *  - Form:          momentum, morale, fatigue and injury right now
 *  - Potential:     stored ceiling used by weekly development
 *
 * Overall = 78% in-ring + 12% entertainment + 10% big-match performance,
 * unless the player sets a manual override.
 */
import {
  ATTRIBUTE_KEYS,
  type AttributeKey,
  type Attributes,
  ENTERTAINMENT_KEYS,
  IN_RING_KEYS,
  type Settings,
  type Wrestler,
  type WrestlingStyle,
} from "./types";
import { clamp } from "./rng";

export type StyleWeights = Partial<Record<AttributeKey, number>>;

/** Multipliers applied on top of a base weight of 1 for every in-ring attribute. */
export const DEFAULT_STYLE_WEIGHTS: Record<WrestlingStyle, StyleWeights> = {
  "all-rounder": { psychology: 1.4, stamina: 1.3, reversal: 1.2 },
  powerhouse: {
    strength: 3,
    durability: 2.2,
    grappling: 2,
    striking: 1.2,
    stamina: 1.2,
    technical: 0.8,
    submission: 0.6,
    speed: 0.6,
    agility: 0.5,
    aerial: 0.3,
  },
  technician: {
    technical: 3,
    grappling: 2.4,
    reversal: 2.2,
    psychology: 2.2,
    submission: 2,
    strength: 0.7,
    aerial: 0.4,
  },
  "high-flyer": {
    aerial: 3,
    agility: 2.6,
    speed: 2.2,
    reversal: 1.2,
    durability: 0.7,
    submission: 0.5,
    strength: 0.4,
  },
  brawler: {
    striking: 2.6,
    durability: 2.2,
    strength: 1.6,
    psychology: 1.2,
    selling: 1.2,
    technical: 0.6,
    aerial: 0.4,
  },
  striker: { striking: 3, defense: 1.8, speed: 1.6, reversal: 1.4, aerial: 0.5, submission: 0.7 },
  showman: { psychology: 2.2, selling: 2.2, striking: 1.2, agility: 1.2, technical: 0.8 },
  giant: {
    strength: 3,
    durability: 2.6,
    striking: 1.4,
    stamina: 0.8,
    speed: 0.3,
    agility: 0.3,
    aerial: 0.15,
  },
};

export const OVERALL_BLEND = { inRing: 0.78, entertainment: 0.12, bigMatch: 0.1 } as const;

export function styleWeights(style: WrestlingStyle, settings?: Pick<Settings, "ratingWeightOverrides">) {
  const defaults = DEFAULT_STYLE_WEIGHTS[style];
  const overrides = settings?.ratingWeightOverrides?.[style] ?? {};
  const weights = {} as Record<AttributeKey, number>;
  for (const key of IN_RING_KEYS) {
    weights[key] = Math.max(0, overrides[key] ?? defaults[key] ?? 1);
  }
  return weights;
}

export function inRingRating(
  attributes: Attributes,
  style: WrestlingStyle,
  settings?: Pick<Settings, "ratingWeightOverrides">,
): number {
  const weights = styleWeights(style, settings);
  let total = 0;
  let weightSum = 0;
  for (const key of IN_RING_KEYS) {
    total += attributes[key] * weights[key];
    weightSum += weights[key];
  }
  return weightSum === 0 ? 0 : total / weightSum;
}

export function entertainmentRating(attributes: Attributes): number {
  return (attributes.charisma * 0.35 + attributes.promo * 0.35 + attributes.crowdConnection * 0.3) / 1;
}

export function formulaOverall(
  attributes: Attributes,
  style: WrestlingStyle,
  settings?: Pick<Settings, "ratingWeightOverrides">,
): number {
  const value =
    inRingRating(attributes, style, settings) * OVERALL_BLEND.inRing +
    entertainmentRating(attributes) * OVERALL_BLEND.entertainment +
    attributes.bigMatch * OVERALL_BLEND.bigMatch;
  return Math.round(clamp(value, 1, 99));
}

export function overall(w: Pick<Wrestler, "attributes" | "style" | "overallOverride">, settings?: Settings): number {
  if (w.overallOverride != null) return Math.round(clamp(w.overallOverride, 1, 99));
  return formulaOverall(w.attributes, w.style, settings);
}

/** Current form 0–100: how well the wrestler performs this week. */
export function formRating(w: Pick<Wrestler, "momentum" | "morale" | "fatigue" | "injury">): number {
  const base = 50 + (w.momentum - 50) * 0.5 + (w.morale - 50) * 0.3 - w.fatigue * 0.3;
  return Math.round(clamp(w.injury ? base - 25 : base));
}

export interface RatingCard {
  overall: number;
  formulaOverall: number;
  inRing: number;
  entertainment: number;
  popularity: number;
  form: number;
  potential: number;
  isOverridden: boolean;
}

export function ratingCard(w: Wrestler, settings?: Settings): RatingCard {
  return {
    overall: overall(w, settings),
    formulaOverall: formulaOverall(w.attributes, w.style, settings),
    inRing: Math.round(inRingRating(w.attributes, w.style, settings)),
    entertainment: Math.round(entertainmentRating(w.attributes)),
    popularity: Math.round(w.popularity),
    form: formRating(w),
    potential: Math.round(w.potential),
    isOverridden: w.overallOverride != null,
  };
}

/** Per-attribute share of the overall, for the "why this overall" breakdown. */
export function overallContributions(w: Wrestler, settings?: Settings) {
  const weights = styleWeights(w.style, settings);
  const weightSum = IN_RING_KEYS.reduce((s, k) => s + weights[k], 0);
  const rows = ATTRIBUTE_KEYS.map((key) => {
    let weight = 0;
    if (IN_RING_KEYS.includes(key)) weight = (weights[key] / weightSum) * OVERALL_BLEND.inRing;
    if (ENTERTAINMENT_KEYS.includes(key)) {
      const share = key === "crowdConnection" ? 0.3 : 0.35;
      weight = share * OVERALL_BLEND.entertainment;
    }
    if (key === "bigMatch") weight = OVERALL_BLEND.bigMatch;
    return { key, value: w.attributes[key], weight, points: w.attributes[key] * weight };
  });
  return rows.sort((a, b) => b.weight - a.weight);
}

export function ratingTier(value: number): { label: string; tone: string } {
  if (value >= 95) return { label: "Historic elite", tone: "gold" };
  if (value >= 90) return { label: "Main-event elite", tone: "gold" };
  if (value >= 85) return { label: "Upper card", tone: "emerald" };
  if (value >= 80) return { label: "Featured", tone: "sky" };
  if (value >= 75) return { label: "Midcard", tone: "violet" };
  if (value >= 70) return { label: "Lower card", tone: "zinc" };
  return { label: "Specialist / prospect", tone: "zinc" };
}

export function clampAttributes(attributes: Attributes): Attributes {
  const out = { ...attributes };
  for (const key of ATTRIBUTE_KEYS) out[key] = Math.round(clamp(out[key], 1, 100));
  return out;
}
