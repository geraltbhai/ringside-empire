import roster from "./roster.json";
import type {
  Brand,
  BrandId,
  Championship,
  Rivalry,
  Settings,
  Team,
  Universe,
  Venue,
  Wrestler,
} from "../engine/types";

export const SCHEMA_VERSION = 1;

export const ROSTER_WRESTLERS = roster.wrestlers as unknown as Wrestler[];
export const ROSTER_TEAMS = roster.teams as unknown as { id: string; name: string; members: [string, string]; brand: BrandId; chemistry: number }[];

export const BRANDS: Record<BrandId, Brand> = {
  mayhem: { id: "mayhem", name: "Mayhem", showName: "Monday Mayhem", color: "#e11d48", popularity: 68, reputation: 66, showDayOffset: 0, weeklyBudget: 450_000, history: [], bookable: true },
  fury: { id: "fury", name: "Fury", showName: "Friday Fury", color: "#2563eb", popularity: 66, reputation: 67, showDayOffset: 4, weeklyBudget: 450_000, history: [], bookable: true },
  legends: { id: "legends", name: "Legends", showName: "Legends", color: "#d4a017", popularity: 80, reputation: 85, showDayOffset: 6, weeklyBudget: 0, history: [], bookable: false },
  "free-agents": { id: "free-agents", name: "Free Agents", showName: "Free Agency", color: "#71717a", popularity: 0, reputation: 0, showDayOffset: 6, weeklyBudget: 0, history: [], bookable: false },
};

export const VENUES: Venue[] = [
  { id: "harbor-club", name: "Harbor Street Club", city: "Portside", capacity: 2_500, rent: 35_000, tier: "club" },
  { id: "riverside-hall", name: "Riverside Hall", city: "Millbrook", capacity: 6_500, rent: 70_000, tier: "arena" },
  { id: "metro-arena", name: "Metro Arena", city: "Northgate", capacity: 15_000, rent: 120_000, tier: "arena" },
  { id: "union-garden", name: "Union Garden", city: "Eastport", capacity: 17_500, rent: 150_000, tier: "arena" },
  { id: "capital-center", name: "Capital Center", city: "Kingsbridge", capacity: 19_000, rent: 175_000, tier: "arena" },
  { id: "grand-coliseum", name: "Grand Coliseum", city: "Sunvale", capacity: 21_000, rent: 210_000, tier: "arena" },
  { id: "lakeside-dome", name: "Lakeside Dome", city: "Lakeshore", capacity: 48_000, rent: 650_000, tier: "stadium" },
  { id: "apex-stadium", name: "Apex Stadium", city: "Crown City", capacity: 72_000, rent: 1_100_000, tier: "stadium" },
];

export const PLE_NAMES = [
  "Uprising",
  "Breaking Point",
  "Iron Summit",
  "Collision Course",
  "Summer Inferno",
  "Fallout",
  "Ascension",
  "Night of Gold",
  "Last Stand",
  "Apex Supreme",
];

export const DEFAULT_SETTINGS: Settings = {
  controls: {
    up: "w",
    down: "s",
    left: "a",
    right: "d",
    light: "j",
    heavy: "k",
    grapple: "l",
    dodge: " ",
    run: "shift",
    reverse: "r",
    signature: "f",
    finisher: "g",
    pin: "p",
    pause: "escape",
  },
  difficulty: "normal",
  matchMinutes: 8,
  ratingWeightOverrides: {},
  allowCrossBrand: false,
  autoRenewContracts: true,
  maxMatchesPerMonth: 6,
  soundEnabled: true,
  reducedMotion: false,
};

type TitleSeed = Omit<Championship, "reigns" | "holderIds"> & {
  reigns: { holderIds: string[]; startWeek: number; endWeek: number | null; defenses: number }[];
};

const TITLE_SEEDS: TitleSeed[] = [
  { id: "apex-world", name: "Apex World Heavyweight Championship", shortName: "World Heavyweight", brand: "mayhem", tier: "world", division: "men", isTag: false, prestige: 90, reigns: [
    { holderIds: ["marcus-vale"], startWeek: -64, endWeek: -22, defenses: 9 },
    { holderIds: ["drago-kessler"], startWeek: -22, endWeek: null, defenses: 4 },
  ] },
  { id: "mayhem-crown", name: "Mayhem Crown Championship", shortName: "Crown", brand: "mayhem", tier: "midcard", division: "men", isTag: false, prestige: 72, reigns: [
    { holderIds: ["theo-blackwood"], startWeek: -30, endWeek: -12, defenses: 3 },
    { holderIds: ["elias-crowe"], startWeek: -12, endWeek: null, defenses: 2 },
  ] },
  { id: "mayhem-womens", name: "Mayhem Women's Championship", shortName: "Mayhem Women's", brand: "mayhem", tier: "womens-world", division: "women", isTag: false, prestige: 84, reigns: [
    { holderIds: ["valentina-cruz"], startWeek: -26, endWeek: null, defenses: 5 },
  ] },
  { id: "mayhem-tag", name: "Mayhem Tag Team Championship", shortName: "Mayhem Tag", brand: "mayhem", tier: "tag", division: "men", isTag: true, prestige: 68, reigns: [
    { holderIds: ["cain-hollow", "abel-hollow"], startWeek: -9, endWeek: null, defenses: 1 },
  ] },
  { id: "fury-undisputed", name: "Undisputed Fury Championship", shortName: "Undisputed", brand: "fury", tier: "world", division: "men", isTag: false, prestige: 92, reigns: [
    { holderIds: ["cole-maddox"], startWeek: -80, endWeek: -40, defenses: 6 },
    { holderIds: ["solomon-reyes"], startWeek: -40, endWeek: null, defenses: 11 },
  ] },
  { id: "fury-national", name: "Fury National Championship", shortName: "National", brand: "fury", tier: "midcard", division: "men", isTag: false, prestige: 75, reigns: [
    { holderIds: ["viktor-rask"], startWeek: -34, endWeek: null, defenses: 8 },
  ] },
  { id: "fury-womens", name: "Fury Women's Championship", shortName: "Fury Women's", brand: "fury", tier: "womens-world", division: "women", isTag: false, prestige: 85, reigns: [
    { holderIds: ["aaliyah-grant"], startWeek: -40, endWeek: -15, defenses: 4 },
    { holderIds: ["rae-mercer"], startWeek: -15, endWeek: null, defenses: 2 },
  ] },
  { id: "fury-tag", name: "Fury Tag Team Championship", shortName: "Fury Tag", brand: "fury", tier: "tag", division: "men", isTag: true, prestige: 70, reigns: [
    { holderIds: ["rex-wolfe", "ryder-wolfe"], startWeek: -14, endWeek: null, defenses: 2 },
  ] },
  { id: "womens-tag", name: "Women's Tag Team Championship", shortName: "Women's Tag", brand: "shared", tier: "womens-tag", division: "women", isTag: true, prestige: 62, reigns: [
    { holderIds: ["ivy-calder", "tess-monroe"], startWeek: -6, endWeek: null, defenses: 0 },
  ] },
];

type RivalrySeed = Pick<Rivalry, "id" | "sideA" | "sideB" | "brand" | "intensity" | "fanInterest" | "stage" | "payoff" | "titleId" | "origin">;

const RIVALRY_SEEDS: RivalrySeed[] = [
  { id: "riv-vale-kessler", sideA: ["marcus-vale"], sideB: ["drago-kessler"], brand: "mayhem", intensity: 62, fanInterest: 70, stage: 1, payoff: "title-match", titleId: "apex-world", origin: "Kessler ended Vale's 42-week reign with a low blow the referee never saw." },
  { id: "riv-maddox-reyes", sideA: ["cole-maddox"], sideB: ["solomon-reyes"], brand: "fury", intensity: 74, fanInterest: 80, stage: 2, payoff: "title-match", titleId: "fury-undisputed", origin: "Maddox has never won back the title Reyes took from him 40 weeks ago." },
  { id: "riv-harlow-cruz", sideA: ["skye-harlow"], sideB: ["valentina-cruz"], brand: "mayhem", intensity: 40, fanInterest: 58, stage: 0, payoff: "title-match", titleId: "mayhem-womens", origin: "Harlow pinned La Reina in a non-title tag match." },
  { id: "riv-grant-mercer", sideA: ["aaliyah-grant"], sideB: ["rae-mercer"], brand: "fury", intensity: 55, fanInterest: 66, stage: 1, payoff: "title-match", titleId: "fury-womens", origin: "Mercer ended Grant's reign and then attacked her in the post-match." },
  { id: "riv-rourke-crowe", sideA: ["jax-rourke"], sideB: ["elias-crowe"], brand: "mayhem", intensity: 48, fanInterest: 60, stage: 1, payoff: "grudge-match", titleId: null, origin: "Crowe cost Rourke a title shot with a chair shot behind the referee." },
  { id: "riv-kingsley-rask", sideA: ["ash-kingsley"], sideB: ["viktor-rask"], brand: "fury", intensity: 35, fanInterest: 52, stage: 0, payoff: "title-match", titleId: "fury-national", origin: "Rask called the Prodigy 'a highlight reel, not a wrestler'." },
  { id: "riv-skyhigh-hollows", sideA: ["ty-okafor", "lucas-rey"], sideB: ["cain-hollow", "abel-hollow"], brand: "mayhem", intensity: 38, fanInterest: 48, stage: 0, payoff: "tag-showdown", titleId: "mayhem-tag", origin: "The Hollows ambushed Sky High during their entrance." },
];

function teamName(ids: string[], wrestlers: Record<string, Wrestler>, teams: Record<string, Team>) {
  if (ids.length === 2) {
    const team = Object.values(teams).find((t) => t.memberIds.every((m) => ids.includes(m)));
    if (team) return team.name;
  }
  return ids.map((id) => wrestlers[id]?.ringName ?? id).join(" & ");
}

export interface NewUniverseOptions {
  name: string;
  promotionName: string;
  startDate: string;
  startingCash: number;
  difficulty: Settings["difficulty"];
  seed?: number;
}

export function createUniverse(options: NewUniverseOptions): Universe {
  const now = new Date().toISOString();
  const wrestlers: Record<string, Wrestler> = {};
  const defaults: Universe["defaults"] = {};
  for (const w of ROSTER_WRESTLERS) {
    const copy = structuredClone(w);
    wrestlers[w.id] = copy;
    defaults[w.id] = { attributes: { ...w.attributes }, popularity: w.popularity, potential: w.potential, overallOverride: null };
  }
  const teams: Record<string, Team> = {};
  for (const t of ROSTER_TEAMS) {
    teams[t.id] = { id: t.id, name: t.name, memberIds: t.members, brand: t.brand, chemistry: t.chemistry, record: { wins: 0, losses: 0, draws: 0 } };
  }
  const championships: Record<string, Championship> = {};
  for (const seed of TITLE_SEEDS) {
    const reigns = seed.reigns.map((r) => ({
      ...r,
      holderName: teamName(r.holderIds, wrestlers, teams),
      endedBy: r.endWeek == null ? null : ("match" as const),
    }));
    const current = reigns.find((r) => r.endWeek == null);
    championships[seed.id] = { ...seed, reigns, holderIds: current ? [...current.holderIds] : [] };
  }
  const rivalries: Record<string, Rivalry> = {};
  for (const r of RIVALRY_SEEDS) {
    rivalries[r.id] = {
      ...r,
      startWeek: -2 - r.stage * 2,
      lastActiveWeek: -1,
      status: "active",
      aWins: 0,
      bWins: 0,
      events: [{ week: -2 - r.stage * 2, text: r.origin }],
    };
  }
  const seed = options.seed ?? Math.floor(Math.random() * 1_000_000_000);
  const difficultyCash = { easy: 1.5, normal: 1, hard: 0.6 }[options.difficulty];
  return {
    schemaVersion: SCHEMA_VERSION,
    id: `u-${seed.toString(36)}-${Date.now().toString(36)}`,
    name: options.name,
    promotionName: options.promotionName,
    createdAt: now,
    updatedAt: now,
    startDate: options.startDate,
    week: 0,
    seed,
    cash: Math.round(options.startingCash * difficultyCash),
    audienceDemand: 60,
    wrestlers,
    defaults,
    brands: structuredClone(BRANDS),
    teams,
    championships,
    rivalries,
    venues: structuredClone(VENUES),
    shows: [],
    history: [],
    transactions: [],
    news: [{ week: 0, text: `${options.promotionName} opens its doors. The Mayhem and Fury rosters are set.`, tone: "neutral" }],
    settings: { ...structuredClone(DEFAULT_SETTINGS), difficulty: options.difficulty },
    counters: { nextId: 1 },
  };
}
