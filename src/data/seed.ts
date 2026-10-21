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

export const SCHEMA_VERSION = 2;

export const ROSTER_WRESTLERS = roster.wrestlers as unknown as Wrestler[];
export const ROSTER_TEAMS = roster.teams as unknown as { id: string; name: string; members: [string, string]; brand: BrandId; chemistry: number }[];

export const BRANDS: Record<BrandId, Brand> = {
  mayhem: { id: "mayhem", name: "WWE", showName: "Monday Night Raw", color: "#e11d48", popularity: 68, reputation: 66, showDayOffset: 0, weeklyBudget: 450_000, history: [], bookable: true },
  fury: { id: "fury", name: "AEW", showName: "AEW Dynamite", color: "#c9a227", popularity: 66, reputation: 67, showDayOffset: 4, weeklyBudget: 450_000, history: [], bookable: true },
  legends: { id: "legends", name: "Legends & Icons", showName: "Legends & Icons", color: "#d4a017", popularity: 80, reputation: 85, showDayOffset: 6, weeklyBudget: 0, history: [], bookable: false },
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
  graphics: "high",
  reducedMotion: false,
};

type TitleSeed = Omit<Championship, "reigns" | "holderIds"> & {
  reigns: { holderIds: string[]; startWeek: number; endWeek: number | null; defenses: number }[];
};

const TITLE_SEEDS: TitleSeed[] = [
  { id: "wwe-undisputed", name: "Undisputed WWE Championship", shortName: "Undisputed WWE", brand: "mayhem", tier: "world", division: "men", isTag: false, prestige: 95, reigns: [
    { holderIds: ["roman-reigns"], startWeek: -190, endWeek: -80, defenses: 24 },
    { holderIds: ["cody-rhodes"], startWeek: -80, endWeek: -28, defenses: 12 },
    { holderIds: ["john-cena-2025"], startWeek: -28, endWeek: -12, defenses: 2 },
    { holderIds: ["cody-rhodes"], startWeek: -12, endWeek: null, defenses: 3 },
  ] },
  { id: "wwe-world-heavyweight", name: "World Heavyweight Championship", shortName: "World Heavyweight", brand: "mayhem", tier: "world", division: "men", isTag: false, prestige: 90, reigns: [
    { holderIds: ["gunther"], startWeek: -60, endWeek: -24, defenses: 8 },
    { holderIds: ["seth-rollins"], startWeek: -24, endWeek: -10, defenses: 2 },
    { holderIds: ["cm-punk"], startWeek: -10, endWeek: null, defenses: 2 },
  ] },
  { id: "wwe-intercontinental", name: "Intercontinental Championship", shortName: "Intercontinental", brand: "mayhem", tier: "midcard", division: "men", isTag: false, prestige: 78, reigns: [
    { holderIds: ["dominik-mysterio"], startWeek: -34, endWeek: null, defenses: 7 },
  ] },
  { id: "wwe-united-states", name: "United States Championship", shortName: "United States", brand: "mayhem", tier: "midcard", division: "men", isTag: false, prestige: 74, reigns: [
    { holderIds: ["solo-sikoa"], startWeek: -20, endWeek: -6, defenses: 3 },
    { holderIds: ["sami-zayn"], startWeek: -6, endWeek: null, defenses: 1 },
  ] },
  { id: "wwe-tag", name: "World Tag Team Championship", shortName: "WWE Tag", brand: "mayhem", tier: "tag", division: "men", isTag: true, prestige: 70, reigns: [
    { holderIds: ["finn-balor", "jd-mcdonagh"], startWeek: -9, endWeek: null, defenses: 2 },
  ] },
  { id: "aew-world", name: "AEW World Championship", shortName: "AEW World", brand: "fury", tier: "world", division: "men", isTag: false, prestige: 92, reigns: [
    { holderIds: ["jon-moxley"], startWeek: -50, endWeek: -14, defenses: 7 },
    { holderIds: ["hangman-page"], startWeek: -14, endWeek: null, defenses: 3 },
  ] },
  { id: "aew-tnt", name: "AEW TNT Championship", shortName: "TNT", brand: "fury", tier: "midcard", division: "men", isTag: false, prestige: 76, reigns: [
    { holderIds: ["adam-cole"], startWeek: -30, endWeek: -12, defenses: 3 },
    { holderIds: ["kyle-fletcher"], startWeek: -12, endWeek: null, defenses: 3 },
  ] },
  { id: "aew-international", name: "AEW International Championship", shortName: "International", brand: "fury", tier: "midcard", division: "men", isTag: false, prestige: 78, reigns: [
    { holderIds: ["konosuke-takeshita"], startWeek: -26, endWeek: null, defenses: 6 },
  ] },
  { id: "aew-tag", name: "AEW World Tag Team Championship", shortName: "AEW Tag", brand: "fury", tier: "tag", division: "men", isTag: true, prestige: 74, reigns: [
    { holderIds: ["brody-king", "bandido"], startWeek: -16, endWeek: null, defenses: 4 },
  ] },
];

type RivalrySeed = Pick<Rivalry, "id" | "sideA" | "sideB" | "brand" | "intensity" | "fanInterest" | "stage" | "payoff" | "titleId" | "origin">;

const RIVALRY_SEEDS: RivalrySeed[] = [
  { id: "riv-cody-drew", sideA: ["drew-mcintyre"], sideB: ["cody-rhodes"], brand: "mayhem", intensity: 62, fanInterest: 74, stage: 1, payoff: "title-match", titleId: "wwe-undisputed", origin: "McIntyre calls Cody a fraud champion every week, and says he'll prove it." },
  { id: "riv-punk-rollins", sideA: ["cm-punk"], sideB: ["seth-rollins"], brand: "mayhem", intensity: 78, fanInterest: 86, stage: 2, payoff: "title-match", titleId: "wwe-world-heavyweight", origin: "Rollins says Punk only holds the title because he was hurt. Punk says that's what happens to the guy who never earns it." },
  { id: "riv-jey-solo", sideA: ["jey-uso"], sideB: ["solo-sikoa"], brand: "mayhem", intensity: 55, fanInterest: 70, stage: 1, payoff: "grudge-match", titleId: null, origin: "Solo cost Jey his main-event shot with a Samoan Spike behind the referee's back." },
  { id: "riv-reigns-breakker", sideA: ["roman-reigns"], sideB: ["bron-breakker"], brand: "mayhem", intensity: 46, fanInterest: 68, stage: 0, payoff: "grudge-match", titleId: null, origin: "Breakker speared the OTC through the barricade on his way back to the ring." },
  { id: "riv-usos-judgment", sideA: ["jey-uso", "jimmy-uso"], sideB: ["finn-balor", "jd-mcdonagh"], brand: "mayhem", intensity: 38, fanInterest: 55, stage: 0, payoff: "tag-showdown", titleId: "wwe-tag", origin: "The Judgment Day jumped the Usos during their entrance." },
  { id: "riv-hangman-mjf", sideA: ["hangman-page"], sideB: ["mjf"], brand: "fury", intensity: 66, fanInterest: 80, stage: 1, payoff: "title-match", titleId: "aew-world", origin: "MJF says the cowboy is keeping his title warm for him." },
  { id: "riv-ospreay-fletcher", sideA: ["will-ospreay"], sideB: ["kyle-fletcher"], brand: "fury", intensity: 60, fanInterest: 72, stage: 1, payoff: "title-match", titleId: "aew-tnt", origin: "Former tag partners, now the bitterest rivalry in the company." },
  { id: "riv-darby-moxley", sideA: ["darby-allin"], sideB: ["jon-moxley"], brand: "fury", intensity: 58, fanInterest: 70, stage: 1, payoff: "grudge-match", titleId: null, origin: "The Death Riders left Darby laid out on the ramp." },
  { id: "riv-ftr-bucks", sideA: ["dax-harwood", "cash-wheeler"], sideB: ["matt-jackson", "nick-jackson"], brand: "fury", intensity: 50, fanInterest: 66, stage: 0, payoff: "tag-showdown", titleId: null, origin: "Who is the greatest tag team of the decade? Neither will let it go." },
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
    defaults[w.id] = { attributes: { ...w.attributes }, popularity: w.popularity, potential: w.potential, overallOverride: null, appearance: { ...w.appearance } };
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
    news: [{ week: 0, text: `${options.promotionName} opens its doors. The WWE and AEW rosters are set.`, tone: "neutral" }],
    settings: { ...structuredClone(DEFAULT_SETTINGS), difficulty: options.difficulty },
    counters: { nextId: 1 },
  };
}
