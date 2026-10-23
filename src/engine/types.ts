/**
 * Core domain model for Ringside Empire.
 * Everything in the universe save is plain JSON-serialisable data so it can be
 * stored in IndexedDB, exported as a file and synced to Supabase unchanged.
 */

export const ATTRIBUTE_KEYS = [
  "strength",
  "striking",
  "grappling",
  "technical",
  "submission",
  "aerial",
  "reversal",
  "defense",
  "durability",
  "stamina",
  "recovery",
  "speed",
  "agility",
  "psychology",
  "selling",
  "charisma",
  "promo",
  "crowdConnection",
  "bigMatch",
  "tagChemistry",
] as const;

export type AttributeKey = (typeof ATTRIBUTE_KEYS)[number];
export type Attributes = Record<AttributeKey, number>;

export const ATTRIBUTE_LABELS: Record<AttributeKey, string> = {
  strength: "Strength",
  striking: "Striking",
  grappling: "Grappling",
  technical: "Technical",
  submission: "Submission",
  aerial: "Aerial",
  reversal: "Reversals",
  defense: "Defense",
  durability: "Durability",
  stamina: "Stamina",
  recovery: "Recovery",
  speed: "Speed",
  agility: "Agility",
  psychology: "Ring Psychology",
  selling: "Selling",
  charisma: "Charisma",
  promo: "Promo",
  crowdConnection: "Crowd Connection",
  bigMatch: "Big-Match",
  tagChemistry: "Tag Chemistry",
};

export const IN_RING_KEYS: AttributeKey[] = [
  "strength",
  "striking",
  "grappling",
  "technical",
  "submission",
  "aerial",
  "reversal",
  "defense",
  "durability",
  "stamina",
  "recovery",
  "speed",
  "agility",
  "psychology",
  "selling",
];
export const ENTERTAINMENT_KEYS: AttributeKey[] = ["charisma", "promo", "crowdConnection"];

export type WrestlingStyle =
  | "powerhouse"
  | "technician"
  | "high-flyer"
  | "brawler"
  | "striker"
  | "showman"
  | "giant"
  | "all-rounder";

export const STYLES: WrestlingStyle[] = [
  "all-rounder",
  "powerhouse",
  "technician",
  "high-flyer",
  "brawler",
  "striker",
  "showman",
  "giant",
];

export type Alignment = "face" | "heel" | "tweener";
export type Division = "men" | "women";
export type WeightClass = "cruiserweight" | "light-heavyweight" | "heavyweight" | "super-heavyweight";
export type BrandId = "mayhem" | "fury" | "legends" | "free-agents";
export type Era = "golden" | "boom" | "attitude" | "ruthless" | "modern";
export type DevelopmentTrend = "rising" | "peak" | "declining";

export interface Appearance {
  skinTone: string;
  hairColor: string;
  hairStyle: "bald" | "buzz" | "short" | "long" | "mohawk" | "ponytail";
  facialHair: "none" | "stubble" | "goatee" | "beard";
  primaryColor: string;
  secondaryColor: string;
  outfit: "trunks" | "tights" | "singlet" | "pants" | "bodysuit";
  /** Frame / bone thickness: 0 = slight, 1 = very heavy. */
  bulk: number;
  mask: boolean;
  /** 0..1 muscle mass. */
  muscle: number;
  /** 0..1 how visible the separation between muscles is. */
  definition: number;
  /** 0..1 softness: belly, smoother contours. */
  bodyFat: number;
  /** 0..1, 0.5 = neutral. */
  shoulderWidth: number;
  armSize: number;
  legSize: number;
  bootColor: string;
  kneepads: boolean;
  wristTape: boolean;
  /** Face shape, each 0..1 with 0.5 neutral. Missing values are derived from the wrestler id. */
  face?: Partial<FaceShape>;
  /** Tattoo placements, e.g. "sleeveR", "tribalL", "chest", "back", "neck". */
  tattoos?: TattooSpot[];
  gloves?: boolean;
  elbowPads?: boolean;
  facePaint?: "none" | "warrior" | "crow" | "skull" | "demon";
  /** Third gear colour for patterns, trim and lettering. */
  accentColor?: string;
  gearPattern?: GearPattern;
  /** Up to 8 characters printed on the trunks / tights (initials, a catchphrase). */
  gearText?: string;
  maskStyle?: MaskStyle;
  maskPattern?: MaskPattern;
  bootStyle?: "boots" | "kickpads" | "sneakers" | "barefoot";
  gloveStyle?: "fingerless" | "full" | "wraps";
  armSleeve?: "none" | "left" | "right" | "both";
  kneeSleeves?: boolean;
}

export const GEAR_PATTERNS = ["solid", "stripes", "flames", "stars", "camo", "checker", "tribal", "fade", "lightning", "splatter", "snake"] as const;
export type GearPattern = (typeof GEAR_PATTERNS)[number];
export const MASK_STYLES = ["luchador", "full", "half", "eyes", "skull"] as const;
export type MaskStyle = (typeof MASK_STYLES)[number];
export const MASK_PATTERNS = ["plain", "flames", "stripes", "stars", "cross", "web", "wings", "teeth"] as const;
export type MaskPattern = (typeof MASK_PATTERNS)[number];

export interface FaceShape {
  jaw: number;
  chin: number;
  brow: number;
  nose: number;
  cheeks: number;
  width: number;
  length: number;
}

export const TATTOO_SPOTS = ["sleeveL", "sleeveR", "upperL", "upperR", "tribalL", "tribalR", "chest", "back", "neck", "torso", "legs", "hands"] as const;
export type TattooSpot = (typeof TATTOO_SPOTS)[number];

export const APPEARANCE_BODY_KEYS = ["muscle", "definition", "bodyFat", "shoulderWidth", "armSize", "legSize", "bulk"] as const;

export type ContractStatus = "signed" | "free-agent" | "legend-deal";

export interface Contract {
  status: ContractStatus;
  /** Fictional in-game weekly salary in game dollars. */
  weeklySalary: number;
  weeksRemaining: number;
  signedWeek: number;
}

export interface Injury {
  description: string;
  weeksRemaining: number;
}

export interface WinLossRecord {
  wins: number;
  losses: number;
  draws: number;
}

export interface Wrestler {
  id: string;
  /** Original wrestler id when this is an alternate (era) version. */
  baseId: string | null;
  versionLabel: string | null;
  name: string;
  ringName: string;
  nickname: string;
  brand: BrandId;
  division: Division;
  weightClass: WeightClass;
  weightLbs: number;
  heightIn: number;
  age: number;
  era: Era;
  style: WrestlingStyle;
  alignment: Alignment;
  attributes: Attributes;
  /** Manual overall override. When null the weighted formula is used. */
  overallOverride: number | null;
  popularity: number;
  potential: number;
  morale: number;
  momentum: number;
  /** 0 fresh – 100 exhausted. */
  fatigue: number;
  injury: Injury | null;
  finisher: string;
  signatures: string[];
  theme: string;
  record: WinLossRecord;
  contract: Contract;
  teamId: string | null;
  allies: string[];
  appearance: Appearance;
  trend: DevelopmentTrend;
  isCustom: boolean;
  lastMatchWeek: number | null;
  /** Matches worked in the last 4 weeks; used for overwork penalties. */
  recentMatches: number[];
}

export interface Team {
  id: string;
  name: string;
  memberIds: [string, string];
  brand: BrandId;
  chemistry: number;
  record: WinLossRecord;
}

export type TitleTier = "world" | "midcard" | "tag" | "womens-world" | "womens-tag";

export interface TitleReign {
  holderIds: string[];
  holderName: string;
  startWeek: number;
  endWeek: number | null;
  defenses: number;
  /** How the reign ended, if it did. */
  endedBy: "match" | "vacated" | null;
}

export interface Championship {
  id: string;
  name: string;
  shortName: string;
  brand: BrandId | "shared";
  tier: TitleTier;
  division: Division;
  isTag: boolean;
  prestige: number;
  holderIds: string[];
  reigns: TitleReign[];
}

export type RivalryStage = 0 | 1 | 2 | 3 | 4;
export const RIVALRY_STAGES = ["Initial conflict", "Escalation", "Confrontation", "Major match", "Resolution"];
export type RivalryStatus = "active" | "paused" | "resolved";
export type RivalryPayoff = "title-match" | "grudge-match" | "stipulation-match" | "tag-showdown";
export const RIVALRY_THEMES = ["personal", "title-pursuit", "betrayal", "respect", "legacy", "jealousy", "revenge", "invasion"] as const;
export type RivalryTheme = (typeof RIVALRY_THEMES)[number];
export const RIVALRY_THEME_LABELS: Record<RivalryTheme, string> = {
  personal: "Personal grudge",
  "title-pursuit": "Chasing the gold",
  betrayal: "Betrayal",
  respect: "Competitive respect",
  legacy: "Legacy / old guard vs new",
  jealousy: "Jealousy",
  revenge: "Revenge",
  invasion: "Invasion / faction war",
};

export interface RivalryEvent {
  week: number;
  text: string;
}

export interface Rivalry {
  id: string;
  sideA: string[];
  sideB: string[];
  brand: BrandId;
  intensity: number;
  fanInterest: number;
  stage: RivalryStage;
  startWeek: number;
  lastActiveWeek: number;
  status: RivalryStatus;
  payoff: RivalryPayoff;
  titleId: string | null;
  aWins: number;
  bWins: number;
  events: RivalryEvent[];
  origin: string;
  /** Story flavour; drives promo dialogue. Older saves default to "personal". */
  theme?: RivalryTheme;
  /** Stipulation for the payoff match when the payoff is a stipulation match. */
  stipulation?: Stipulation;
}

export interface Venue {
  id: string;
  name: string;
  city: string;
  capacity: number;
  rent: number;
  tier: "club" | "arena" | "stadium";
}

export type SegmentKind = "match" | "promo" | "interview" | "rivalry";
export type MatchType = "singles" | "tag" | "triple-threat";
export type Stipulation = "standard" | "no-dq" | "steel-cage" | "ladder" | "submission" | "last-man-standing";

export type Outcome =
  | { mode: "simulate" }
  | { mode: "manual"; winnerSide: "A" | "B" | "C" | "draw" };

export interface Segment {
  id: string;
  kind: SegmentKind;
  label: string;
  matchType: MatchType;
  stipulation: Stipulation;
  /** Side A participants. For promos/interviews this holds all participants. */
  sideA: string[];
  sideB: string[];
  sideC: string[];
  titleId: string | null;
  rivalryId: string | null;
  durationMin: number;
  outcome: Outcome;
  isMainEvent: boolean;
  /** "played" when the user decides it in the playable 3D match. */
  playedResult: { winnerSide: "A" | "B" | "C"; quality: number; durationSec: number; finish: string } | null;
}

export type ShowType = "weekly" | "ple";

export interface PopularityChange {
  wrestlerId: string;
  delta: number;
}

export interface SegmentResult {
  segmentId: string;
  kind: SegmentKind;
  source: "simulated" | "manual" | "played";
  winnerSide: "A" | "B" | "C" | "draw" | null;
  winnerIds: string[];
  loserIds: string[];
  quality: number;
  stars: number;
  durationMin: number;
  finish: string;
  summary: string;
  titleChange: { titleId: string; newHolderIds: string[]; previousHolderIds: string[] } | null;
  qualityBreakdown: Record<string, number>;
  injuries: { wrestlerId: string; weeks: number; description: string }[];
  /** Spoken lines for talk segments; speakerId null is a stage direction. */
  dialogue?: DialogueLine[];
}

export interface DialogueLine {
  speakerId: string | null;
  text: string;
}

export interface MoneyBreakdown {
  [key: string]: number;
}

export interface ShowResult {
  rating: number;
  stars: number;
  avgMatchQuality: number;
  mainEventQuality: number;
  attendance: number;
  viewership: number;
  fanSatisfaction: number;
  revenue: MoneyBreakdown;
  expenses: MoneyBreakdown;
  profit: number;
  brandPopularityDelta: number;
  popularityChanges: PopularityChange[];
  segments: SegmentResult[];
  notes: string[];
}

export interface Show {
  id: string;
  name: string;
  brand: BrandId | "joint";
  type: ShowType;
  week: number;
  dayOffset: number;
  venueId: string;
  ticketPrice: number;
  marketingSpend: number;
  segments: Segment[];
  status: "planned" | "completed";
  result: ShowResult | null;
}

export interface MatchHistoryEntry {
  id: string;
  week: number;
  showId: string | null;
  showName: string;
  source: "simulated" | "manual" | "played" | "exhibition";
  matchType: MatchType;
  stipulation: Stipulation;
  sideA: string[];
  sideB: string[];
  sideC: string[];
  winnerIds: string[];
  quality: number;
  stars: number;
  titleId: string | null;
  titleChange: boolean;
  summary: string;
}

export type TransactionCategory =
  | "tickets"
  | "ple"
  | "sponsorship"
  | "merchandise"
  | "broadcast"
  | "bonus"
  | "salaries"
  | "venue"
  | "production"
  | "marketing"
  | "medical"
  | "signing";

export interface Transaction {
  id: string;
  week: number;
  brand: BrandId | "joint" | null;
  category: TransactionCategory;
  amount: number;
  note: string;
}

export interface Brand {
  id: BrandId;
  name: string;
  showName: string;
  color: string;
  popularity: number;
  reputation: number;
  showDayOffset: number;
  weeklyBudget: number;
  history: { week: number; rating: number; viewership: number; profit: number }[];
  bookable: boolean;
}

export interface NewsItem {
  week: number;
  text: string;
  tone: "neutral" | "good" | "bad" | "title";
}

export type ControlAction =
  | "up"
  | "down"
  | "left"
  | "right"
  | "light"
  | "heavy"
  | "grapple"
  | "dodge"
  | "run"
  | "reverse"
  | "signature"
  | "finisher"
  | "pin"
  | "pause";

export interface Settings {
  controls: Record<ControlAction, string>;
  difficulty: "easy" | "normal" | "hard";
  matchMinutes: number;
  /** Optional per-style weight overrides for the overall formula. */
  ratingWeightOverrides: Partial<Record<WrestlingStyle, Partial<Record<AttributeKey, number>>>>;
  allowCrossBrand: boolean;
  /** Happy wrestlers re-sign at their asking price when a contract runs out. */
  autoRenewContracts: boolean;
  maxMatchesPerMonth: number;
  soundEnabled: boolean;
  /** "low" turns off shadows, lowers resolution and thins the crowd for weaker machines. */
  graphics: "high" | "low";
  reducedMotion: boolean;
}

export interface Universe {
  schemaVersion: number;
  id: string;
  name: string;
  promotionName: string;
  createdAt: string;
  updatedAt: string;
  startDate: string;
  week: number;
  seed: number;
  cash: number;
  audienceDemand: number;
  wrestlers: Record<string, Wrestler>;
  /** Snapshot of each wrestler's original ratings for "restore defaults". */
  defaults: Record<string, Pick<Wrestler, "attributes" | "popularity" | "potential" | "overallOverride"> & { appearance?: Appearance }>;
  brands: Record<BrandId, Brand>;
  teams: Record<string, Team>;
  championships: Record<string, Championship>;
  rivalries: Record<string, Rivalry>;
  venues: Venue[];
  shows: Show[];
  history: MatchHistoryEntry[];
  transactions: Transaction[];
  news: NewsItem[];
  settings: Settings;
  counters: { nextId: number };
}

export interface SaveSlotMeta {
  slot: string;
  universeName: string;
  promotionName: string;
  week: number;
  cash: number;
  updatedAt: string;
  schemaVersion: number;
}
