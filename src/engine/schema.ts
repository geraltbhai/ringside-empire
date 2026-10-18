/**
 * Versioned save schema. Imports are validated with Zod and migrated forward
 * to SCHEMA_VERSION before they reach the game.
 */
import { z } from "zod";
import { DEFAULT_SETTINGS, SCHEMA_VERSION } from "../data/seed";
import { ATTRIBUTE_KEYS, type Universe } from "./types";

const score = z.number().min(0).max(100);
const attributes = z.object(Object.fromEntries(ATTRIBUTE_KEYS.map((k) => [k, z.number().min(1).max(100)])) as Record<(typeof ATTRIBUTE_KEYS)[number], z.ZodNumber>);
const brandId = z.enum(["mayhem", "fury", "legends", "free-agents"]);

export const wrestlerSchema = z.object({
  id: z.string().min(1),
  baseId: z.string().nullable(),
  versionLabel: z.string().nullable(),
  name: z.string(),
  ringName: z.string().min(1),
  nickname: z.string(),
  brand: brandId,
  division: z.enum(["men", "women"]),
  weightClass: z.enum(["cruiserweight", "light-heavyweight", "heavyweight", "super-heavyweight"]),
  weightLbs: z.number().positive(),
  heightIn: z.number().positive(),
  age: z.number().int().min(16).max(80),
  era: z.enum(["golden", "boom", "attitude", "ruthless", "modern"]),
  style: z.enum(["powerhouse", "technician", "high-flyer", "brawler", "striker", "showman", "giant", "all-rounder"]),
  alignment: z.enum(["face", "heel", "tweener"]),
  attributes,
  overallOverride: z.number().min(1).max(99).nullable(),
  popularity: score,
  potential: score,
  morale: score,
  momentum: score,
  fatigue: score,
  injury: z.object({ description: z.string(), weeksRemaining: z.number() }).nullable(),
  finisher: z.string(),
  signatures: z.array(z.string()),
  theme: z.string(),
  record: z.object({ wins: z.number(), losses: z.number(), draws: z.number() }),
  contract: z.object({
    status: z.enum(["signed", "free-agent", "legend-deal"]),
    weeklySalary: z.number().min(0),
    weeksRemaining: z.number(),
    signedWeek: z.number(),
  }),
  teamId: z.string().nullable(),
  allies: z.array(z.string()),
  appearance: z.object({
    skinTone: z.string(),
    hairColor: z.string(),
    hairStyle: z.enum(["bald", "buzz", "short", "long", "mohawk", "ponytail"]),
    facialHair: z.enum(["none", "stubble", "goatee", "beard"]),
    primaryColor: z.string(),
    secondaryColor: z.string(),
    outfit: z.enum(["trunks", "tights", "singlet", "pants", "bodysuit"]),
    bulk: z.number().min(0).max(1),
    mask: z.boolean(),
  }),
  trend: z.enum(["rising", "peak", "declining"]),
  isCustom: z.boolean(),
  lastMatchWeek: z.number().nullable(),
  recentMatches: z.array(z.number()),
});

export const universeSchema = z
  .object({
    schemaVersion: z.number().int().min(1),
    id: z.string(),
    name: z.string(),
    promotionName: z.string(),
    createdAt: z.string(),
    updatedAt: z.string(),
    startDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
    week: z.number().int().min(0),
    seed: z.number(),
    cash: z.number(),
    audienceDemand: score,
    wrestlers: z.record(z.string(), wrestlerSchema),
    defaults: z.record(z.string(), z.any()),
    brands: z.record(z.string(), z.any()),
    teams: z.record(z.string(), z.any()),
    championships: z.record(z.string(), z.any()),
    rivalries: z.record(z.string(), z.any()),
    venues: z.array(z.any()),
    shows: z.array(z.any()),
    history: z.array(z.any()),
    transactions: z.array(z.any()),
    news: z.array(z.any()),
    settings: z.record(z.string(), z.any()),
    counters: z.object({ nextId: z.number().int() }),
  })
  .passthrough();

/** Forward migrations keyed by the version they upgrade *from*. */
const MIGRATIONS: Record<number, (raw: Record<string, unknown>) => Record<string, unknown>> = {
  // Example for future versions:
  // 1: (raw) => ({ ...raw, schemaVersion: 2, newField: defaultValue }),
};

export function migrate(raw: Record<string, unknown>): Record<string, unknown> {
  let current = { ...raw };
  let version = Number(current.schemaVersion ?? 1);
  while (version < SCHEMA_VERSION) {
    const step = MIGRATIONS[version];
    if (!step) throw new Error(`No migration from save version ${version}`);
    current = step(current);
    version = Number(current.schemaVersion);
  }
  if (version > SCHEMA_VERSION) throw new Error(`This save was made by a newer version of the game (v${version}).`);
  // Fill settings added after the save was made.
  current.settings = { ...DEFAULT_SETTINGS, ...(current.settings as object), controls: { ...DEFAULT_SETTINGS.controls, ...((current.settings as { controls?: object })?.controls ?? {}) } };
  return current;
}

export const SAVE_FORMAT = "ringside-empire-save";

export function serializeUniverse(universe: Universe) {
  return JSON.stringify({ format: SAVE_FORMAT, exportedAt: new Date().toISOString(), universe });
}

export function parseUniverse(json: string): Universe {
  let data: unknown;
  try {
    data = JSON.parse(json);
  } catch {
    throw new Error("That file is not valid JSON.");
  }
  const wrapped = data as { format?: string; universe?: unknown };
  const raw = (wrapped?.format === SAVE_FORMAT ? wrapped.universe : data) as Record<string, unknown>;
  if (!raw || typeof raw !== "object") throw new Error("Save file is empty.");
  const migrated = migrate(raw);
  const parsed = universeSchema.safeParse(migrated);
  if (!parsed.success) {
    const first = parsed.error.issues[0];
    throw new Error(`Save file failed validation at ${first.path.join(".") || "root"}: ${first.message}`);
  }
  return parsed.data as unknown as Universe;
}
