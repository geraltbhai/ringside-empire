/**
 * Roster definitions: the WWE and AEW men's rosters, plus Legends & Icons and a
 * few free agents. Ratings are subjective gameplay estimates. Personal-use
 * build. `scripts/generate-roster.ts` expands these compact entries into the
 * full, fixed attribute database in `roster.json`.
 */
import type { Alignment, Appearance, AttributeKey, BrandId, Division, Era, WrestlingStyle } from "../engine/types";

export interface WrestlerDef {
  id: string;
  ringName: string;
  name: string;
  nickname: string;
  brand: BrandId;
  division: Division;
  style: WrestlingStyle;
  alignment: Alignment;
  /** Target formula overall. */
  ovr: number;
  /** Target entertainment rating. */
  ent: number;
  pop: number;
  pot: number;
  age: number;
  h: number;
  w: number;
  era: Era;
  finisher: string;
  sigs: string[];
  theme: string;
  look?: Partial<Appearance>;
  team?: string;
  boosts?: Partial<Record<AttributeKey, number>>;
  versionOf?: string;
  versionLabel?: string;
}

export interface TeamDef {
  id: string;
  name: string;
  members: [string, string];
  brand: BrandId;
  chemistry: number;
}

const M = "men" as const;

// Skin tones, light to dark.
const S1 = "#e9bf9f";
const S2 = "#e8b48f";
const S3 = "#c98e62";
const S4 = "#a86b45";
const S5 = "#7d4a2d";
const S6 = "#5a341f";
// Hair colours.
const BLACK = "#16130f";
const BROWN = "#3f2a1d";
const LBROWN = "#6b4423";
const BLOND = "#c9a35a";
const PLAT = "#ece4cf";
const RED = "#8a3a1c";

type Row = [
  id: string,
  ringName: string,
  nickname: string,
  style: WrestlingStyle,
  alignment: Alignment,
  ovr: number,
  ent: number,
  pop: number,
  pot: number,
  age: number,
  h: number,
  w: number,
  finisher: string,
  sigs: string[],
  look: Partial<Appearance>,
  extra?: Partial<WrestlerDef>,
];

function rows(brand: BrandId, era: Era, list: Row[]): WrestlerDef[] {
  return list.map(([id, ringName, nickname, style, alignment, ovr, ent, pop, pot, age, h, w, finisher, sigs, look, extra]) => ({
    id,
    ringName,
    name: ringName,
    nickname,
    brand,
    division: M,
    style,
    alignment,
    ovr,
    ent,
    pop,
    pot,
    age,
    h,
    w,
    era,
    finisher,
    sigs,
    theme: `${ringName} theme`,
    look,
    ...extra,
  }));
}

// ───────────── WWE ─────────────
const WWE = rows("mayhem", "modern", [
  ["cody-rhodes", "Cody Rhodes", "The American Nightmare", "all-rounder", "face", 93, 94, 98, 93, 41, 74, 220, "Cross Rhodes", ["Cody Cutter", "Disaster Kick", "Bionic Elbow"], { skinTone: S1, hairColor: LBROWN, hairStyle: "short", facialHair: "stubble", primaryColor: "#111318", secondaryColor: "#dc2626", outfit: "tights", muscle: 0.8, definition: 0.72 }],
  ["roman-reigns", "Roman Reigns", "The OTC", "all-rounder", "face", 94, 93, 98, 94, 41, 75, 265, "Spear", ["Superman Punch", "Drive By", "Guillotine Choke"], { skinTone: S3, hairColor: BLACK, hairStyle: "ponytail", facialHair: "beard", primaryColor: "#0b0b0d", secondaryColor: "#52525b", outfit: "pants", muscle: 0.9, definition: 0.66 }, { boosts: { strength: 6 } }],
  ["seth-rollins", "Seth Rollins", "The Visionary", "all-rounder", "heel", 92, 92, 94, 92, 40, 73, 217, "Stomp", ["Pedigree", "Buckle Bomb", "Superkick"], { skinTone: S2, hairColor: BLACK, hairStyle: "long", facialHair: "beard", primaryColor: "#7c3aed", secondaryColor: "#f8fafc", outfit: "tights", muscle: 0.74, definition: 0.78 }],
  ["cm-punk", "CM Punk", "The Best in the World", "all-rounder", "face", 89, 97, 97, 89, 47, 73, 218, "GTS", ["Anaconda Vise", "Running Knee", "Diving Elbow"], { skinTone: S1, hairColor: BLACK, hairStyle: "short", facialHair: "beard", primaryColor: "#111318", secondaryColor: "#f8fafc", outfit: "trunks", muscle: 0.62, definition: 0.5, bodyFat: 0.18 }],
  ["gunther", "Gunther", "The Ring General", "striker", "heel", 93, 84, 90, 93, 38, 76, 297, "Sleeper Hold", ["Knife-Edge Chop", "Powerbomb", "Lariat"], { skinTone: S1, hairColor: BLOND, hairStyle: "buzz", facialHair: "none", primaryColor: "#111318", secondaryColor: "#111318", outfit: "trunks", muscle: 0.82, definition: 0.4, bodyFat: 0.26, bulk: 0.72 }, { boosts: { strength: 8, technical: 6 } }],
  ["drew-mcintyre", "Drew McIntyre", "The Scottish Warrior", "brawler", "heel", 90, 88, 90, 90, 41, 77, 265, "Claymore", ["Future Shock DDT", "Glasgow Kiss", "Alabama Slam"], { skinTone: S1, hairColor: BROWN, hairStyle: "long", facialHair: "stubble", primaryColor: "#1f2937", secondaryColor: "#a16207", outfit: "trunks", muscle: 0.92, definition: 0.7 }],
  ["randy-orton", "Randy Orton", "The Viper", "technician", "face", 90, 92, 96, 90, 46, 77, 250, "RKO", ["Hanging DDT", "Punt Kick", "Draping DDT"], { skinTone: S2, hairColor: BROWN, hairStyle: "buzz", facialHair: "stubble", primaryColor: "#111318", secondaryColor: "#a1a1aa", outfit: "trunks", muscle: 0.8, definition: 0.7 }],
  ["brock-lesnar", "Brock Lesnar", "The Beast Incarnate", "powerhouse", "heel", 91, 88, 96, 91, 49, 75, 286, "F-5", ["German Suplex", "Kimura Lock", "Belly-to-Belly"], { skinTone: S1, hairColor: BLOND, hairStyle: "buzz", facialHair: "goatee", primaryColor: "#111318", secondaryColor: "#b91c1c", outfit: "trunks", muscle: 0.98, definition: 0.55, bodyFat: 0.2, bulk: 0.8 }, { boosts: { strength: 10 } }],
  ["la-knight", "LA Knight", "The Megastar", "brawler", "face", 84, 93, 93, 84, 43, 73, 240, "BFT", ["Jumping Elbow", "Neckbreaker", "Shoulder Block"], { skinTone: S1, hairColor: BLOND, hairStyle: "buzz", facialHair: "stubble", primaryColor: "#111318", secondaryColor: "#facc15", outfit: "trunks", muscle: 0.78 }],
  ["jey-uso", "Jey Uso", "Main Event Jey", "all-rounder", "face", 85, 88, 94, 85, 40, 73, 235, "Uso Splash", ["Superkick", "Spear", "Running Hip Attack"], { skinTone: S3, hairColor: BLACK, hairStyle: "ponytail", facialHair: "beard", primaryColor: "#111318", secondaryColor: "#facc15", outfit: "tights" }, { team: "the-usos" }],
  ["jimmy-uso", "Jimmy Uso", "Uce", "all-rounder", "face", 80, 81, 83, 80, 40, 74, 235, "Uso Splash", ["Superkick", "Running Hip Attack", "Samoan Drop"], { skinTone: S3, hairColor: BLACK, hairStyle: "long", facialHair: "beard", primaryColor: "#1e3a8a", secondaryColor: "#f8fafc", outfit: "tights" }, { team: "the-usos" }],
  ["solo-sikoa", "Solo Sikoa", "The Street Champion", "powerhouse", "heel", 84, 77, 84, 86, 33, 74, 267, "Samoan Spike", ["Spinning Solo", "Hip Attack", "Uranage"], { skinTone: S3, hairColor: BLACK, hairStyle: "buzz", facialHair: "beard", primaryColor: "#111318", secondaryColor: "#525252", outfit: "pants" }],
  ["jacob-fatu", "Jacob Fatu", "The Samoan Werewolf", "powerhouse", "tweener", 88, 82, 89, 93, 34, 73, 300, "Moonsault", ["Pop-Up Samoan Drop", "Superkick", "Tongan Death Grip"], { skinTone: S4, hairColor: BLACK, hairStyle: "long", facialHair: "beard", primaryColor: "#111318", secondaryColor: "#b91c1c", outfit: "tights", bodyFat: 0.34 }, { boosts: { agility: 14, aerial: 18 } }],
  ["sami-zayn", "Sami Zayn", "The Underdog from the Underground", "all-rounder", "face", 85, 90, 91, 85, 42, 73, 212, "Helluva Kick", ["Blue Thunder Bomb", "Exploder Suplex", "Tornado DDT"], { skinTone: S2, hairColor: BROWN, hairStyle: "short", facialHair: "beard", primaryColor: "#111318", secondaryColor: "#e5e7eb", outfit: "tights", muscle: 0.55, bodyFat: 0.2 }],
  ["kevin-owens", "Kevin Owens", "KO", "brawler", "tweener", 86, 89, 89, 86, 42, 72, 266, "Pop-Up Powerbomb", ["Stunner", "Swanton Bomb", "Cannonball"], { skinTone: S1, hairColor: BROWN, hairStyle: "short", facialHair: "beard", primaryColor: "#111318", secondaryColor: "#2563eb", outfit: "trunks", muscle: 0.5, bodyFat: 0.5 }],
  ["bron-breakker", "Bron Breakker", "The Unhinged Dog", "powerhouse", "heel", 88, 80, 89, 96, 28, 72, 255, "Spear", ["Frankensteiner", "Gorilla Press", "Steiner Recliner"], { skinTone: S2, hairColor: BLACK, hairStyle: "buzz", facialHair: "none", primaryColor: "#111318", secondaryColor: "#991b1b", outfit: "trunks", muscle: 0.98, definition: 0.8 }, { boosts: { speed: 14, strength: 6 } }],
  ["bronson-reed", "Bronson Reed", "Big Bronson", "giant", "heel", 84, 76, 82, 85, 37, 72, 330, "Tsunami", ["Death Valley Driver", "Senton", "Pounce"], { skinTone: S1, hairColor: BLOND, hairStyle: "long", facialHair: "beard", primaryColor: "#111318", secondaryColor: "#facc15", outfit: "singlet" }],
  ["logan-paul", "Logan Paul", "The Maverick", "showman", "heel", 80, 90, 88, 84, 31, 74, 220, "Lucky Punch", ["Buckshot Lariat", "Frog Splash", "Springboard Moonsault"], { skinTone: S1, hairColor: BLOND, hairStyle: "short", facialHair: "none", primaryColor: "#0ea5e9", secondaryColor: "#f8fafc", outfit: "trunks", muscle: 0.78, definition: 0.85 }, { boosts: { agility: 10 } }],
  ["dominik-mysterio", "Dominik Mysterio", "Dirty Dom", "showman", "heel", 80, 88, 90, 85, 29, 73, 200, "Frog Splash", ["619", "Three Amigos", "Sit-Out Powerbomb"], { skinTone: S2, hairColor: BLACK, hairStyle: "buzz", facialHair: "stubble", primaryColor: "#111318", secondaryColor: "#7c3aed", outfit: "pants", muscle: 0.55 }],
  ["finn-balor", "Finn Bálor", "The Prince", "high-flyer", "heel", 85, 82, 85, 85, 45, 71, 190, "Coup de Grâce", ["Sling Blade", "1916", "Shotgun Dropkick"], { skinTone: S1, hairColor: BROWN, hairStyle: "short", facialHair: "stubble", primaryColor: "#111318", secondaryColor: "#7c3aed", outfit: "tights" }, { team: "judgment-day" }],
  ["jd-mcdonagh", "JD McDonagh", "Irish Ace", "technician", "heel", 76, 72, 72, 79, 35, 70, 180, "Devil Inside", ["Spanish Fly", "Moonsault", "Tornado DDT"], { skinTone: S1, hairColor: BROWN, hairStyle: "short", facialHair: "beard", primaryColor: "#111318", secondaryColor: "#7c3aed", outfit: "trunks" }, { team: "judgment-day" }],
  ["damian-priest", "Damian Priest", "The Archer of Infamy", "brawler", "face", 84, 83, 86, 84, 43, 77, 250, "South of Heaven", ["Razor's Edge", "Broken Arrow", "Reckoning"], { skinTone: S3, hairColor: BLACK, hairStyle: "long", facialHair: "beard", primaryColor: "#111318", secondaryColor: "#525252", outfit: "pants" }],
  ["penta", "Penta", "Cero Miedo", "brawler", "face", 84, 87, 88, 84, 41, 72, 220, "Penta Driver", ["Sacrifice", "Backstabber", "Slingblade"], { skinTone: S3, hairColor: BLACK, mask: true, primaryColor: "#111318", secondaryColor: "#f8fafc", outfit: "pants" }],
  ["rey-mysterio", "Rey Mysterio", "The Master of the 619", "high-flyer", "face", 78, 88, 91, 78, 51, 66, 175, "619", ["Hurricanrana", "Seated Senton", "Frog Splash"], { skinTone: S3, hairColor: BLACK, mask: true, primaryColor: "#1d4ed8", secondaryColor: "#facc15", outfit: "pants" }],
  ["dragon-lee", "Dragon Lee", "The Dragon", "high-flyer", "face", 78, 72, 74, 84, 31, 67, 165, "Operation Dragon", ["Shotgun Dropkick", "Incineration", "Spanish Fly"], { skinTone: S3, hairColor: BLACK, hairStyle: "short", primaryColor: "#b91c1c", secondaryColor: "#facc15", outfit: "tights" }],
  ["carmelo-hayes", "Carmelo Hayes", "Him", "high-flyer", "tweener", 80, 80, 78, 87, 31, 70, 185, "Nothing But Net", ["First 48", "Codebreaker", "Fadeaway Leg Drop"], { skinTone: S5, hairColor: BLACK, hairStyle: "buzz", facialHair: "stubble", primaryColor: "#111318", secondaryColor: "#eab308", outfit: "tights" }],
  ["the-miz", "The Miz", "The A-Lister", "showman", "heel", 77, 89, 81, 77, 46, 73, 221, "Skull-Crushing Finale", ["Figure-Four", "Reality Check", "It Kicks"], { skinTone: S1, hairColor: BROWN, hairStyle: "short", primaryColor: "#111318", secondaryColor: "#facc15", outfit: "trunks" }],
  ["sheamus", "Sheamus", "The Celtic Warrior", "brawler", "face", 83, 82, 85, 83, 48, 76, 267, "Brogue Kick", ["Ten Beats of the Bodhrán", "White Noise", "Cloverleaf"], { skinTone: "#f0cdb4", hairColor: RED, hairStyle: "mohawk", facialHair: "beard", primaryColor: "#14532d", secondaryColor: "#f8fafc", outfit: "trunks", muscle: 0.88 }],
  ["shinsuke-nakamura", "Shinsuke Nakamura", "The King of Strong Style", "striker", "heel", 80, 85, 85, 80, 46, 74, 229, "Kinshasa", ["Good Vibrations", "Landslide", "Sliding German"], { skinTone: S2, hairColor: BLACK, hairStyle: "short", facialHair: "goatee", primaryColor: "#7f1d1d", secondaryColor: "#111318", outfit: "pants" }],
  ["rusev", "Rusev", "The Bulgarian Brute", "powerhouse", "heel", 81, 77, 80, 81, 40, 72, 300, "Accolade", ["Machka Kick", "Fallaway Slam", "Superkick"], { skinTone: S1, hairColor: BLACK, hairStyle: "short", facialHair: "beard", primaryColor: "#14532d", secondaryColor: "#f8fafc", outfit: "trunks", bodyFat: 0.3 }],
  ["aleister-black", "Aleister Black", "The Dark One", "striker", "heel", 81, 79, 80, 81, 40, 71, 200, "Black Mass", ["Pump Kick", "Moonsault Knee Drop", "Rolling Elbow"], { skinTone: S1, hairColor: BLACK, hairStyle: "long", facialHair: "beard", primaryColor: "#111318", secondaryColor: "#111318", outfit: "trunks" }],
  ["chad-gable", "Chad Gable", "Master Gable", "technician", "heel", 82, 80, 80, 82, 40, 68, 202, "Chaos Theory", ["Ankle Lock", "Moonsault", "German Suplex"], { skinTone: S1, hairColor: BROWN, hairStyle: "short", facialHair: "beard", primaryColor: "#1d4ed8", secondaryColor: "#f8fafc", outfit: "singlet" }],
  ["oba-femi", "Oba Femi", "The Ruler", "powerhouse", "face", 86, 78, 83, 96, 27, 78, 310, "Fall From Grace", ["Pop-Up Powerslam", "Military Press", "Lariat"], { skinTone: S6, hairColor: BLACK, hairStyle: "bald", facialHair: "beard", primaryColor: "#111318", secondaryColor: "#facc15", outfit: "trunks", muscle: 0.96, bulk: 0.85 }, { boosts: { strength: 10 } }],
  ["trick-williams", "Trick Williams", "Whoop That Trick", "all-rounder", "face", 80, 86, 83, 89, 32, 76, 233, "Trick Shot", ["Spinebuster", "Flatliner", "Jumping Knee"], { skinTone: S5, hairColor: BLACK, hairStyle: "buzz", facialHair: "beard", primaryColor: "#111318", secondaryColor: "#22c55e", outfit: "tights" }],
  ["ilja-dragunov", "Ilja Dragunov", "The Mad Dragon", "striker", "face", 84, 80, 80, 86, 32, 68, 210, "Torpedo Moscow", ["H-Bomb", "Coast to Coast", "Constantine Special"], { skinTone: S1, hairColor: BLOND, hairStyle: "short", primaryColor: "#111318", secondaryColor: "#dc2626", outfit: "trunks" }],
  ["je-von-evans", "Je'Von Evans", "The Young OG", "high-flyer", "face", 76, 76, 75, 93, 21, 70, 180, "OG Cutter", ["Springboard Spin Kick", "Frog Splash", "Corkscrew Plancha"], { skinTone: S5, hairColor: BLACK, hairStyle: "short", primaryColor: "#111318", secondaryColor: "#22d3ee", outfit: "tights" }],
  ["uncle-howdy", "Uncle Howdy", "Leader of the Wyatt Sicks", "brawler", "tweener", 77, 82, 80, 78, 37, 76, 270, "Sister Abigail", ["Sit-Out Spinebuster", "Senton", "Lariat"], { skinTone: S1, hairColor: BROWN, hairStyle: "long", mask: true, primaryColor: "#e7e5e4", secondaryColor: "#111318", outfit: "pants" }],
  ["kofi-kingston", "Kofi Kingston", "The Dreadlocked Dynamo", "high-flyer", "heel", 76, 80, 81, 76, 45, 72, 212, "Trouble in Paradise", ["SOS", "Boom Drop", "Midnight Hour"], { skinTone: S6, hairColor: BLACK, hairStyle: "ponytail", primaryColor: "#7c3aed", secondaryColor: "#facc15", outfit: "tights" }, { team: "new-day" }],
  ["xavier-woods", "Xavier Woods", "King Woods", "all-rounder", "heel", 74, 81, 77, 74, 40, 71, 205, "Limit Break", ["Honor Roll", "Lost in the Woods", "Shining Wizard"], { skinTone: S5, hairColor: BLACK, hairStyle: "long", facialHair: "beard", primaryColor: "#7c3aed", secondaryColor: "#facc15", outfit: "tights" }, { team: "new-day" }],
  ["montez-ford", "Montez Ford", "The Street Profit", "high-flyer", "face", 80, 82, 80, 84, 35, 70, 210, "From the Heavens", ["Standing Moonsault", "Spinebuster", "Dropkick"], { skinTone: S5, hairColor: BLACK, hairStyle: "mohawk", facialHair: "beard", primaryColor: "#111318", secondaryColor: "#facc15", outfit: "trunks", muscle: 0.86, definition: 0.85 }, { team: "street-profits" }],
  ["angelo-dawkins", "Angelo Dawkins", "The Street Profit", "powerhouse", "face", 76, 74, 75, 77, 35, 73, 255, "Cyclone Crash", ["Spinebuster", "Gutwrench Suplex", "Shoulder Block"], { skinTone: S5, hairColor: BLACK, hairStyle: "buzz", facialHair: "beard", primaryColor: "#111318", secondaryColor: "#facc15", outfit: "trunks" }, { team: "street-profits" }],
  ["johnny-gargano", "Johnny Gargano", "Johnny Wrestling", "technician", "tweener", 80, 83, 80, 80, 38, 68, 197, "One Final Beat", ["Gargano Escape", "Lawn Dart", "Slingshot Spear"], { skinTone: S1, hairColor: BROWN, hairStyle: "long", facialHair: "beard", primaryColor: "#111318", secondaryColor: "#facc15", outfit: "tights" }, { team: "diy" }],
  ["tommaso-ciampa", "Tommaso Ciampa", "The Psycho Killer", "brawler", "tweener", 80, 80, 78, 80, 40, 72, 201, "Fairytale Ending", ["Project Ciampa", "Running Knee", "Willow's Bell"], { skinTone: S1, hairColor: BROWN, hairStyle: "short", facialHair: "beard", primaryColor: "#111318", secondaryColor: "#f8fafc", outfit: "trunks" }, { team: "diy" }],
  ["tama-tonga", "Tama Tonga", "Gun Stun Gunner", "brawler", "heel", 76, 72, 72, 77, 43, 72, 230, "Gun Stun", ["Veleno", "Tongan Twist", "Headbutt"], { skinTone: S4, hairColor: BLACK, hairStyle: "ponytail", facialHair: "beard", primaryColor: "#111318", secondaryColor: "#f8fafc", outfit: "pants" }, { team: "mft" }],
  ["tonga-loa", "Tonga Loa", "The Tongan Monster", "powerhouse", "heel", 74, 66, 68, 74, 41, 75, 260, "Tongan Death Grip", ["Spear", "Uranage", "Sit-Out Powerbomb"], { skinTone: S4, hairColor: BLACK, hairStyle: "long", facialHair: "beard", primaryColor: "#111318", secondaryColor: "#f8fafc", outfit: "pants" }, { team: "mft" }],
  ["austin-theory", "Austin Theory", "A-Town", "all-rounder", "heel", 76, 76, 73, 80, 29, 73, 220, "A-Town Down", ["Blue Collar Driller", "Rope-Hung Dropkick", "Standing Shooting Star"], { skinTone: S1, hairColor: BLOND, hairStyle: "short", primaryColor: "#1d4ed8", secondaryColor: "#f8fafc", outfit: "trunks", muscle: 0.86, definition: 0.86 }, { team: "a-town-down-under" }],
  ["grayson-waller", "Grayson Waller", "The Aussie Icon", "showman", "heel", 74, 81, 73, 76, 35, 75, 220, "Rolling Stunner", ["Elbow Drop", "Springboard Neckbreaker", "Superkick"], { skinTone: S1, hairColor: BLOND, hairStyle: "short", primaryColor: "#0ea5e9", secondaryColor: "#facc15", outfit: "trunks" }, { team: "a-town-down-under" }],
]);

// ───────────── AEW ─────────────
const AEW = rows("fury", "modern", [
  ["hangman-page", "Hangman Adam Page", "The Anxious Millennial Cowboy", "all-rounder", "face", 90, 88, 92, 90, 34, 72, 210, "Buckshot Lariat", ["Deadeye", "Moonsault", "Fallaway Slam"], { skinTone: S1, hairColor: LBROWN, hairStyle: "long", facialHair: "beard", primaryColor: "#7f1d1d", secondaryColor: "#f8fafc", outfit: "tights" }],
  ["mjf", "MJF", "The Salt of the Earth", "showman", "heel", 88, 97, 92, 92, 30, 71, 216, "Heatseeker", ["Panama Sunrise", "Salt of the Earth", "Kangaroo Kick"], { skinTone: S1, hairColor: BLACK, hairStyle: "short", primaryColor: "#111318", secondaryColor: "#facc15", outfit: "tights" }],
  ["kenny-omega", "Kenny Omega", "The Best Bout Machine", "all-rounder", "face", 91, 89, 91, 91, 42, 72, 203, "One-Winged Angel", ["V-Trigger", "Snap Dragon Suplex", "Kotaro Krusher"], { skinTone: S1, hairColor: BLOND, hairStyle: "long", primaryColor: "#111318", secondaryColor: "#dc2626", outfit: "tights" }],
  ["will-ospreay", "Will Ospreay", "The Aerial Assassin", "high-flyer", "face", 93, 86, 89, 94, 33, 72, 207, "Hidden Blade", ["Storm Breaker", "Oscutter", "Tiger Driver '91"], { skinTone: S1, hairColor: BROWN, hairStyle: "short", facialHair: "beard", primaryColor: "#111318", secondaryColor: "#facc15", outfit: "tights" }, { boosts: { striking: 8 } }],
  ["swerve-strickland", "Swerve Strickland", "Whose House", "all-rounder", "tweener", 88, 88, 88, 90, 35, 74, 221, "House Call", ["Swerve Stomp", "JML Driver", "Rolling Flatliner"], { skinTone: S5, hairColor: BLACK, hairStyle: "buzz", facialHair: "beard", primaryColor: "#111318", secondaryColor: "#f8fafc", outfit: "tights" }],
  ["jon-moxley", "Jon Moxley", "The Purveyor of Violence", "brawler", "heel", 88, 90, 91, 88, 40, 74, 234, "Death Rider", ["Bulldog Choke", "King Kong Lariat", "Paradigm Shift"], { skinTone: S1, hairColor: BROWN, hairStyle: "short", facialHair: "stubble", primaryColor: "#111318", secondaryColor: "#111318", outfit: "pants", bodyFat: 0.22 }],
  ["darby-allin", "Darby Allin", "The Daredevil", "high-flyer", "face", 84, 86, 89, 86, 33, 68, 170, "Coffin Drop", ["Code Red", "Suicide Dive", "Scorpion Deathlock"], { skinTone: S1, hairColor: BLACK, hairStyle: "short", primaryColor: "#111318", secondaryColor: "#f8fafc", outfit: "pants", muscle: 0.45 }],
  ["orange-cassidy", "Orange Cassidy", "Freshly Squeezed", "showman", "face", 82, 90, 90, 82, 42, 70, 180, "Beach Break", ["Orange Punch", "Stundog Millionaire", "Superman Punch"], { skinTone: S1, hairColor: LBROWN, hairStyle: "long", facialHair: "beard", primaryColor: "#2563eb", secondaryColor: "#f8fafc", outfit: "pants", muscle: 0.4 }],
  ["kyle-fletcher", "Kyle Fletcher", "The Protostar", "all-rounder", "heel", 86, 80, 84, 95, 27, 73, 210, "Grimstone", ["Aussie Arrow", "Brainbuster", "Sky Twister Press"], { skinTone: S1, hairColor: BLOND, hairStyle: "short", primaryColor: "#111318", secondaryColor: "#facc15", outfit: "tights" }],
  ["konosuke-takeshita", "Konosuke Takeshita", "The Alpha", "all-rounder", "heel", 89, 80, 84, 93, 31, 74, 220, "Raging Fire", ["Blue Thunder Driver", "Power Drive Knee", "Brainbuster"], { skinTone: S2, hairColor: BLACK, hairStyle: "short", primaryColor: "#111318", secondaryColor: "#dc2626", outfit: "trunks", muscle: 0.86 }],
  ["kazuchika-okada", "Kazuchika Okada", "The Rainmaker", "all-rounder", "heel", 90, 88, 91, 90, 38, 75, 236, "Rainmaker", ["Dropkick", "Tombstone Piledriver", "Money Clip"], { skinTone: S2, hairColor: "#c08a2a", hairStyle: "long", primaryColor: "#111318", secondaryColor: "#facc15", outfit: "trunks" }],
  ["ricochet", "Ricochet", "The One and Only", "high-flyer", "heel", 84, 82, 82, 84, 37, 69, 188, "Vertigo", ["630 Senton", "Recoil", "Shooting Star Press"], { skinTone: S4, hairColor: BLACK, hairStyle: "buzz", facialHair: "stubble", primaryColor: "#111318", secondaryColor: "#facc15", outfit: "tights", definition: 0.9 }],
  ["adam-cole", "Adam Cole", "BAY BAY", "showman", "face", 82, 88, 86, 82, 37, 72, 210, "Panama Sunrise", ["Last Shot", "Superkick", "Figure-Four"], { skinTone: S1, hairColor: BROWN, hairStyle: "long", facialHair: "stubble", primaryColor: "#111318", secondaryColor: "#dc2626", outfit: "tights" }],
  ["samoa-joe", "Samoa Joe", "The Samoan Submission Machine", "brawler", "heel", 86, 84, 87, 86, 47, 74, 282, "Coquina Clutch", ["Muscle Buster", "Uranage", "Senton"], { skinTone: S3, hairColor: BLACK, hairStyle: "buzz", facialHair: "goatee", primaryColor: "#111318", secondaryColor: "#525252", outfit: "trunks", bodyFat: 0.55 }],
  ["powerhouse-hobbs", "Powerhouse Hobbs", "Big Business", "powerhouse", "heel", 80, 75, 78, 81, 35, 74, 285, "Town Business", ["Spinebuster", "Powerslam", "Lariat"], { skinTone: S5, hairColor: BLACK, hairStyle: "buzz", facialHair: "beard", primaryColor: "#111318", secondaryColor: "#facc15", outfit: "trunks" }],
  ["christian-cage", "Christian Cage", "The Patriarch", "showman", "heel", 82, 92, 86, 82, 52, 74, 212, "Killswitch", ["Spear", "Reverse DDT", "Frog Splash"], { skinTone: S1, hairColor: BLOND, hairStyle: "short", facialHair: "stubble", primaryColor: "#111318", secondaryColor: "#dc2626", outfit: "tights" }],
  ["adam-copeland", "Adam Copeland", "The Rated-R Superstar", "all-rounder", "face", 86, 90, 92, 86, 52, 76, 241, "Spear", ["Impaler DDT", "Edge-O-Matic", "Crossface"], { skinTone: S1, hairColor: BLOND, hairStyle: "long", facialHair: "stubble", primaryColor: "#111318", secondaryColor: "#991b1b", outfit: "tights" }],
  ["jay-white", "Jay White", "Switchblade", "technician", "heel", 84, 84, 82, 85, 33, 73, 220, "Blade Runner", ["Kiwi Krusher", "Uranage", "Sleeper Suplex"], { skinTone: S1, hairColor: BLOND, hairStyle: "short", primaryColor: "#111318", secondaryColor: "#f8fafc", outfit: "trunks" }],
  ["mark-briscoe", "Mark Briscoe", "Redneck Kung Fu", "brawler", "face", 80, 82, 80, 80, 41, 71, 220, "Jay Driller", ["Froggy-Bow", "Cannonball", "Redneck Kung Fu"], { skinTone: S1, hairColor: BROWN, hairStyle: "long", facialHair: "beard", primaryColor: "#7f1d1d", secondaryColor: "#facc15", outfit: "pants" }],
  ["claudio-castagnoli", "Claudio Castagnoli", "The Swiss Superman", "powerhouse", "heel", 87, 76, 82, 87, 42, 77, 232, "Ricola Bomb", ["Giant Swing", "European Uppercut", "Neutralizer"], { skinTone: S1, hairColor: BLOND, hairStyle: "buzz", primaryColor: "#b91c1c", secondaryColor: "#f8fafc", outfit: "trunks", muscle: 0.9 }, { team: "death-riders" }],
  ["wheeler-yuta", "Wheeler Yuta", "The Death Rider", "technician", "heel", 76, 70, 70, 82, 29, 70, 185, "Seatbelt Pin", ["Busaiku Knee", "Crossface", "German Suplex"], { skinTone: S2, hairColor: BLACK, hairStyle: "short", facialHair: "beard", primaryColor: "#111318", secondaryColor: "#111318", outfit: "trunks" }, { team: "death-riders" }],
  ["pac", "PAC", "The Bastard", "high-flyer", "heel", 82, 78, 78, 82, 39, 69, 194, "Black Arrow", ["Brutalizer", "German Suplex", "Shooting Star Press"], { skinTone: S1, hairColor: BLACK, hairStyle: "buzz", facialHair: "beard", primaryColor: "#111318", secondaryColor: "#111318", outfit: "trunks" }],
  ["daniel-garcia", "Daniel Garcia", "Red Death", "technician", "tweener", 80, 80, 78, 87, 27, 69, 189, "Dragon Tamer", ["Piledriver", "Sharpshooter", "Brainbuster"], { skinTone: S1, hairColor: BROWN, hairStyle: "short", facialHair: "stubble", primaryColor: "#7f1d1d", secondaryColor: "#111318", outfit: "trunks" }],
  ["matt-jackson", "Matt Jackson", "The Young Buck", "high-flyer", "heel", 84, 86, 86, 84, 41, 70, 180, "Meltzer Driver", ["BTE Trigger", "Superkick", "Northern Lights Suplex"], { skinTone: S1, hairColor: BROWN, hairStyle: "long", primaryColor: "#111318", secondaryColor: "#ec4899", outfit: "tights" }, { team: "young-bucks" }],
  ["nick-jackson", "Nick Jackson", "The Young Buck", "high-flyer", "heel", 83, 84, 86, 84, 36, 70, 175, "Meltzer Driver", ["BTE Trigger", "Superkick", "450 Splash"], { skinTone: S1, hairColor: BROWN, hairStyle: "long", primaryColor: "#111318", secondaryColor: "#ec4899", outfit: "tights" }, { team: "young-bucks" }],
  ["dax-harwood", "Dax Harwood", "Top Guy", "technician", "face", 84, 80, 82, 84, 41, 70, 225, "Shatter Machine", ["Brainbuster", "Piledriver", "Figure-Four"], { skinTone: S1, hairColor: BROWN, hairStyle: "short", facialHair: "goatee", primaryColor: "#111318", secondaryColor: "#facc15", outfit: "trunks" }, { team: "ftr" }],
  ["cash-wheeler", "Cash Wheeler", "Top Guy", "technician", "face", 82, 78, 80, 82, 38, 71, 223, "Shatter Machine", ["Superplex", "Spinebuster", "Gutwrench Powerbomb"], { skinTone: S1, hairColor: BROWN, hairStyle: "short", facialHair: "stubble", primaryColor: "#111318", secondaryColor: "#facc15", outfit: "trunks" }, { team: "ftr" }],
  ["brody-king", "Brody King", "Mean Gene", "brawler", "face", 82, 78, 80, 83, 38, 77, 290, "Gonzo Bomb", ["Cannonball", "Lariat", "Piledriver"], { skinTone: S1, hairColor: BLACK, hairStyle: "bald", facialHair: "beard", primaryColor: "#111318", secondaryColor: "#dc2626", outfit: "pants", bodyFat: 0.36 }, { team: "brodido" }],
  ["bandido", "Bandido", "The Bandit", "high-flyer", "face", 84, 80, 82, 87, 31, 68, 185, "21 Plex", ["Moonsault", "Pop-Up Cutter", "Gorilla Press"], { skinTone: S3, hairColor: BLACK, mask: true, primaryColor: "#111318", secondaryColor: "#dc2626", outfit: "tights" }, { team: "brodido" }],
  ["bobby-lashley", "Bobby Lashley", "The All Mighty", "powerhouse", "heel", 86, 80, 86, 86, 50, 75, 273, "Hurt Lock", ["Spear", "Dominator", "Delayed Suplex"], { skinTone: S5, hairColor: BLACK, hairStyle: "bald", facialHair: "goatee", primaryColor: "#111318", secondaryColor: "#facc15", outfit: "trunks", muscle: 1, definition: 0.85 }, { team: "hurt-syndicate", boosts: { strength: 8 } }],
  ["shelton-benjamin", "Shelton Benjamin", "The Gold Standard", "technician", "heel", 80, 72, 74, 80, 50, 74, 249, "Paydirt", ["Exploder Suplex", "Stinger Splash", "T-Bone Suplex"], { skinTone: S5, hairColor: BLACK, hairStyle: "bald", primaryColor: "#111318", secondaryColor: "#facc15", outfit: "trunks" }, { team: "hurt-syndicate" }],
  ["hook", "Hook", "The Ultimate HOOK", "technician", "face", 76, 76, 81, 86, 26, 69, 210, "Redrum", ["T-Bone Suplex", "Judo Throw", "Lariat"], { skinTone: S1, hairColor: BLACK, hairStyle: "short", primaryColor: "#111318", secondaryColor: "#111318", outfit: "pants" }],
  ["mike-bailey", "Mike Bailey", "Speedball", "striker", "face", 82, 80, 80, 82, 35, 68, 160, "Ultimate Weapon", ["Tornado Kick", "Flamingo Driver", "Speedball Kicks"], { skinTone: S1, hairColor: BROWN, hairStyle: "short", primaryColor: "#f8fafc", secondaryColor: "#2563eb", outfit: "tights", muscle: 0.42 }, { team: "jetspeed" }],
  ["kevin-knight", "Kevin Knight", "The Jet", "high-flyer", "face", 76, 80, 76, 90, 29, 74, 215, "UFO Splash", ["Springboard Blockbuster", "Jumping Knee", "Rope Walk Dropkick"], { skinTone: S5, hairColor: BLACK, hairStyle: "short", primaryColor: "#f8fafc", secondaryColor: "#2563eb", outfit: "tights" }, { team: "jetspeed" }],
  ["mistico", "Místico", "La Leyenda de Plata", "high-flyer", "face", 82, 80, 82, 82, 43, 68, 170, "La Mística", ["Tornillo", "Arm Drag", "Moonsault"], { skinTone: S3, hairColor: BLACK, mask: true, primaryColor: "#cbd5e1", secondaryColor: "#2563eb", outfit: "pants" }],
  ["komander", "Komander", "El Comandante", "high-flyer", "face", 76, 76, 74, 84, 28, 68, 160, "Cielito Lindo", ["Rope Walk Rana", "Shooting Star", "Corkscrew Plancha"], { skinTone: S3, hairColor: BLACK, mask: true, primaryColor: "#111318", secondaryColor: "#facc15", outfit: "pants" }],
  ["jack-perry", "Jack Perry", "Scapegoat", "all-rounder", "heel", 80, 80, 78, 84, 28, 70, 180, "Snare Trap", ["Running Knee", "Tope Con Hilo", "Judas Effect"], { skinTone: S1, hairColor: BLACK, hairStyle: "long", primaryColor: "#111318", secondaryColor: "#f8fafc", outfit: "tights" }],
  ["josh-alexander", "Josh Alexander", "The Walking Weapon", "technician", "heel", 82, 74, 76, 82, 39, 73, 230, "C4 Spike", ["Ankle Lock", "Rolling Germans", "Divine Intervention"], { skinTone: S1, hairColor: BROWN, hairStyle: "short", facialHair: "beard", primaryColor: "#111318", secondaryColor: "#dc2626", outfit: "trunks" }],
  ["big-bill", "Big Bill", "The Big Bill", "giant", "heel", 78, 70, 74, 78, 38, 84, 300, "Chokeslam", ["Big Boot", "Bossman Slam", "Running Splash"], { skinTone: S1, hairColor: BROWN, hairStyle: "bald", facialHair: "beard", primaryColor: "#111318", secondaryColor: "#f8fafc", outfit: "trunks" }],
  ["kyle-o-reilly", "Kyle O'Reilly", "The Violent Artist", "technician", "face", 82, 74, 78, 82, 38, 73, 205, "Armbar", ["Brainbuster", "Kicks", "Guillotine Choke"], { skinTone: S1, hairColor: RED, hairStyle: "short", facialHair: "beard", primaryColor: "#111318", secondaryColor: "#dc2626", outfit: "trunks" }],
  ["roderick-strong", "Roderick Strong", "The Messiah of the Backbreaker", "technician", "heel", 80, 74, 74, 80, 43, 70, 200, "End of Heartache", ["Backbreaker", "Strong Hold", "Jumping Knee"], { skinTone: S2, hairColor: BLACK, hairStyle: "short", facialHair: "stubble", primaryColor: "#111318", secondaryColor: "#facc15", outfit: "trunks" }],
]);

// ───────────── LEGENDS & ICONS ─────────────
const LEGENDS: WrestlerDef[] = [
  ...rows("legends", "attitude", [
    ["undertaker", "The Undertaker", "The Deadman", "giant", "tweener", 96, 95, 99, 96, 32, 82, 309, "Tombstone Piledriver", ["Chokeslam", "Old School", "Last Ride"], { skinTone: S1, hairColor: BLACK, hairStyle: "long", facialHair: "none", primaryColor: "#111318", secondaryColor: "#4c1d95", outfit: "pants" }, { versionLabel: "Peak 1997", boosts: { agility: 18, striking: 8 } }],
    ["stone-cold", "Stone Cold Steve Austin", "The Texas Rattlesnake", "brawler", "tweener", 95, 99, 99, 95, 33, 74, 252, "Stone Cold Stunner", ["Lou Thesz Press", "Mudhole Stomps", "Spinebuster"], { skinTone: S1, hairColor: BROWN, hairStyle: "bald", facialHair: "goatee", primaryColor: "#111318", secondaryColor: "#111318", outfit: "trunks", muscle: 0.86 }, { versionLabel: "Peak 1998" }],
    ["the-rock", "The Rock", "The People's Champion", "showman", "face", 95, 99, 99, 95, 28, 77, 260, "Rock Bottom", ["People's Elbow", "Spinebuster", "Sharpshooter"], { skinTone: S3, hairColor: BLACK, hairStyle: "buzz", facialHair: "none", primaryColor: "#111318", secondaryColor: "#f8fafc", outfit: "trunks", muscle: 0.92, definition: 0.8 }, { versionLabel: "Peak 2000", boosts: { strength: 6 } }],
    ["triple-h", "Triple H", "The Game", "all-rounder", "heel", 93, 93, 96, 93, 31, 76, 255, "Pedigree", ["Spinebuster", "Facebuster", "Knee Drop"], { skinTone: S1, hairColor: LBROWN, hairStyle: "long", primaryColor: "#111318", secondaryColor: "#a1a1aa", outfit: "trunks", muscle: 0.94 }, { versionLabel: "Peak 2000" }],
    ["shawn-michaels", "Shawn Michaels", "The Heartbreak Kid", "showman", "tweener", 95, 95, 97, 95, 32, 73, 225, "Sweet Chin Music", ["Flying Elbow", "Kip-Up", "Inverted Atomic Drop"], { skinTone: S2, hairColor: BLOND, hairStyle: "long", primaryColor: "#db2777", secondaryColor: "#111318", outfit: "pants" }, { versionLabel: "Peak 1997", boosts: { agility: 10 } }],
    ["mick-foley", "Mankind", "The Hardcore Legend", "brawler", "face", 86, 94, 95, 86, 33, 74, 287, "Mandible Claw", ["Double-Arm DDT", "Cactus Clothesline", "Running Knee"], { skinTone: S1, hairColor: BROWN, hairStyle: "long", mask: true, primaryColor: "#57534e", secondaryColor: "#a16207", outfit: "pants", bodyFat: 0.55 }, { versionLabel: "Peak 1998", boosts: { durability: 16 } }],
    ["kane", "Kane", "The Big Red Machine", "giant", "heel", 88, 84, 91, 88, 31, 84, 323, "Chokeslam", ["Tombstone Piledriver", "Flying Clothesline", "Uppercut"], { skinTone: S1, hairColor: BLACK, hairStyle: "long", mask: true, primaryColor: "#991b1b", secondaryColor: "#111318", outfit: "bodysuit" }, { versionLabel: "Peak 1998" }],
    ["goldberg", "Goldberg", "Da Man", "powerhouse", "face", 92, 88, 97, 92, 32, 76, 285, "Jackhammer", ["Spear", "Gorilla Press", "Powerslam"], { skinTone: S1, hairColor: BLACK, hairStyle: "bald", facialHair: "goatee", primaryColor: "#111318", secondaryColor: "#111318", outfit: "trunks", muscle: 1, definition: 0.72, bulk: 0.8 }, { versionLabel: "Peak 1998", boosts: { strength: 10 } }],
    ["sting", "Sting", "The Icon", "all-rounder", "face", 91, 92, 97, 91, 38, 74, 250, "Scorpion Death Drop", ["Scorpion Deathlock", "Stinger Splash", "Diving Splash"], { skinTone: S1, hairColor: BLACK, hairStyle: "long", primaryColor: "#111318", secondaryColor: "#e5e7eb", outfit: "pants" }, { versionLabel: "Peak 1997" }],
    ["chris-jericho-2001", "Chris Jericho", "Y2J", "technician", "heel", 92, 96, 94, 92, 31, 72, 227, "Walls of Jericho", ["Codebreaker", "Lionsault", "Enzuigiri"], { skinTone: S1, hairColor: BLOND, hairStyle: "long", primaryColor: "#111318", secondaryColor: "#dc2626", outfit: "tights" }, { versionOf: "chris-jericho", versionLabel: "Peak 2001" }],
    ["razor-ramon", "Razor Ramon", "The Bad Guy", "brawler", "heel", 88, 90, 92, 88, 36, 79, 287, "Razor's Edge", ["Fallaway Slam", "Chokeslam", "Back Suplex Side Slam"], { skinTone: S2, hairColor: BLACK, hairStyle: "long", facialHair: "stubble", primaryColor: "#111318", secondaryColor: "#facc15", outfit: "pants" }, { era: "boom", versionLabel: "Peak 1994" }],
    ["owen-hart", "Owen Hart", "The King of Harts", "technician", "heel", 89, 85, 87, 89, 29, 70, 227, "Sharpshooter", ["Spinning Heel Kick", "Missile Dropkick", "Enzuigiri"], { skinTone: S1, hairColor: BLOND, hairStyle: "short", primaryColor: "#db2777", secondaryColor: "#111318", outfit: "singlet" }, { era: "boom", versionLabel: "Peak 1994" }],
  ]),
  ...rows("legends", "ruthless", [
    ["john-cena", "John Cena", "The Champ", "all-rounder", "face", 92, 96, 99, 92, 30, 73, 251, "Attitude Adjustment", ["Five Knuckle Shuffle", "STF", "Shoulder Tackle"], { skinTone: S1, hairColor: BROWN, hairStyle: "buzz", primaryColor: "#1d4ed8", secondaryColor: "#f97316", outfit: "pants", muscle: 0.96, definition: 0.75 }, { versionLabel: "Peak 2007", boosts: { strength: 8, durability: 8 } }],
    ["kurt-angle", "Kurt Angle", "The Olympic Hero", "technician", "face", 95, 91, 94, 95, 33, 72, 225, "Ankle Lock", ["Angle Slam", "German Suplex Chain", "Moonsault"], { skinTone: S1, hairColor: BROWN, hairStyle: "bald", primaryColor: "#1d4ed8", secondaryColor: "#dc2626", outfit: "singlet" }, { versionLabel: "Peak 2002", boosts: { strength: 6 } }],
    ["eddie-guerrero", "Eddie Guerrero", "Latino Heat", "showman", "tweener", 92, 95, 96, 92, 37, 68, 220, "Frog Splash", ["Three Amigos", "Lasso from El Paso", "Feigned Injury"], { skinTone: S3, hairColor: BLACK, hairStyle: "short", primaryColor: "#1d4ed8", secondaryColor: "#facc15", outfit: "tights" }, { versionLabel: "Peak 2004" }],
    ["batista", "Batista", "The Animal", "powerhouse", "face", 90, 88, 93, 90, 36, 78, 290, "Batista Bomb", ["Spinebuster", "Spear", "Running Powerslam"], { skinTone: S3, hairColor: BLACK, hairStyle: "short", facialHair: "goatee", primaryColor: "#111318", secondaryColor: "#f8fafc", outfit: "trunks", muscle: 1, definition: 0.7, bulk: 0.78 }, { versionLabel: "Peak 2005" }],
    ["rey-mysterio-2006", "Rey Mysterio", "The Ultimate Underdog", "high-flyer", "face", 91, 90, 96, 91, 31, 66, 175, "619", ["West Coast Pop", "Hurricanrana", "Seated Senton"], { skinTone: S3, hairColor: BLACK, mask: true, primaryColor: "#f8fafc", secondaryColor: "#1d4ed8", outfit: "pants" }, { versionOf: "rey-mysterio", versionLabel: "Peak 2006" }],
    ["edge-2006", "Edge", "The Rated-R Superstar", "showman", "heel", 92, 93, 95, 92, 32, 76, 241, "Spear", ["Edgecution", "Impaler DDT", "Edge-O-Matic"], { skinTone: S1, hairColor: BLOND, hairStyle: "long", facialHair: "stubble", primaryColor: "#111318", secondaryColor: "#991b1b", outfit: "trunks" }, { versionOf: "adam-copeland", versionLabel: "Peak 2006" }],
    ["rob-van-dam", "Rob Van Dam", "Mr. Monday Night", "high-flyer", "face", 89, 90, 93, 89, 31, 72, 235, "Five-Star Frog Splash", ["Rolling Thunder", "Van Daminator", "Split-Legged Moonsault"], { skinTone: S2, hairColor: BROWN, hairStyle: "ponytail", primaryColor: "#7c3aed", secondaryColor: "#facc15", outfit: "pants" }, { versionLabel: "Peak 2002" }],
    ["booker-t", "Booker T", "The Five-Time Champ", "striker", "face", 88, 91, 91, 88, 36, 75, 256, "Book End", ["Spinaroonie", "Scissors Kick", "Harlem Hangover"], { skinTone: S5, hairColor: BLACK, hairStyle: "long", facialHair: "goatee", primaryColor: "#facc15", secondaryColor: "#111318", outfit: "tights" }, { versionLabel: "Peak 2001" }],
    ["jeff-hardy", "Jeff Hardy", "The Charismatic Enigma", "high-flyer", "face", 88, 89, 95, 88, 30, 73, 225, "Swanton Bomb", ["Twist of Fate", "Whisper in the Wind", "Poetry in Motion"], { skinTone: S1, hairColor: "#7c3aed", hairStyle: "long", primaryColor: "#111318", secondaryColor: "#22c55e", outfit: "pants" }, { versionLabel: "Peak 2008" }],
    ["big-show", "Big Show", "The World's Largest Athlete", "giant", "heel", 86, 85, 90, 86, 30, 84, 441, "Chokeslam", ["Knockout Punch", "Colossal Clutch", "Big Boot"], { skinTone: S1, hairColor: BROWN, hairStyle: "bald", facialHair: "goatee", primaryColor: "#111318", secondaryColor: "#facc15", outfit: "singlet" }, { versionLabel: "Peak 2002" }],
    ["bryan-danielson", "Bryan Danielson", "The American Dragon", "technician", "face", 95, 91, 97, 95, 33, 70, 210, "Busaiku Knee", ["LeBell Lock", "Running Knee", "Yes! Kicks"], { skinTone: S1, hairColor: BROWN, hairStyle: "long", facialHair: "beard", primaryColor: "#7f1d1d", secondaryColor: "#111318", outfit: "trunks" }, { versionLabel: "Peak 2014", boosts: { striking: 6 } }],
    ["aj-styles", "AJ Styles", "The Phenomenal One", "all-rounder", "face", 94, 89, 93, 94, 39, 71, 218, "Styles Clash", ["Phenomenal Forearm", "Calf Crusher", "Pelé Kick"], { skinTone: S1, hairColor: BROWN, hairStyle: "long", facialHair: "beard", primaryColor: "#111318", secondaryColor: "#f8fafc", outfit: "tights" }, { versionLabel: "Peak 2016" }],
    ["john-cena-2025", "John Cena", "The Last Real Champion", "all-rounder", "heel", 87, 95, 99, 87, 48, 73, 251, "Attitude Adjustment", ["Five Knuckle Shuffle", "STF", "Springboard Stunner"], { skinTone: S1, hairColor: BROWN, hairStyle: "buzz", primaryColor: "#111318", secondaryColor: "#facc15", outfit: "pants", muscle: 0.92 }, { era: "modern", versionOf: "john-cena", versionLabel: "Farewell 2025" }],
    ["undertaker-2020", "The Undertaker", "The Phenom", "giant", "face", 84, 93, 99, 84, 55, 82, 300, "Tombstone Piledriver", ["Chokeslam", "Old School", "Hell's Gate"], { skinTone: S1, hairColor: BLACK, hairStyle: "short", facialHair: "beard", primaryColor: "#111318", secondaryColor: "#111318", outfit: "pants" }, { era: "modern", versionOf: "undertaker", versionLabel: "Final Run 2020" }],
    ["shawn-michaels-2008", "Shawn Michaels", "Mr. WrestleMania", "showman", "face", 93, 95, 98, 93, 43, 73, 225, "Sweet Chin Music", ["Flying Elbow", "Moonsault to the Floor", "Figure-Four"], { skinTone: S2, hairColor: LBROWN, hairStyle: "short", facialHair: "beard", primaryColor: "#111318", secondaryColor: "#f8fafc", outfit: "pants" }, { versionOf: "shawn-michaels", versionLabel: "Peak 2008" }],
    ["brock-lesnar-2003", "Brock Lesnar", "The Next Big Thing", "powerhouse", "face", 93, 82, 92, 93, 26, 75, 295, "F-5", ["Shooting Star Press", "Belly-to-Belly", "Running Powerbomb"], { skinTone: S1, hairColor: BLOND, hairStyle: "buzz", primaryColor: "#111318", secondaryColor: "#f8fafc", outfit: "trunks", muscle: 1, definition: 0.82 }, { versionOf: "brock-lesnar", versionLabel: "Peak 2003", boosts: { strength: 10, aerial: 20 } }],
  ]),
  ...rows("legends", "golden", [
    ["hulk-hogan", "Hulk Hogan", "The Hulkster", "powerhouse", "face", 88, 97, 99, 88, 33, 79, 302, "Atomic Leg Drop", ["Big Boot", "Body Slam", "Hulk-Up Punches"], { skinTone: S2, hairColor: BLOND, hairStyle: "long", facialHair: "goatee", primaryColor: "#facc15", secondaryColor: "#dc2626", outfit: "trunks", muscle: 1, definition: 0.6, bulk: 0.8 }, { versionLabel: "Peak 1987" }],
    ["ric-flair", "Ric Flair", "The Nature Boy", "showman", "heel", 92, 98, 96, 92, 40, 73, 243, "Figure-Four Leglock", ["Knife-Edge Chop", "Knee Drop", "Flair Flop"], { skinTone: S1, hairColor: PLAT, hairStyle: "short", primaryColor: "#111318", secondaryColor: "#facc15", outfit: "trunks", muscle: 0.6 }, { versionLabel: "Peak 1989", boosts: { stamina: 14 } }],
    ["randy-savage", "Randy Savage", "Macho Man", "showman", "face", 90, 97, 97, 90, 35, 74, 237, "Flying Elbow Drop", ["Double Axe Handle", "Clothesline", "Atomic Drop"], { skinTone: S2, hairColor: BROWN, hairStyle: "long", facialHair: "beard", primaryColor: "#db2777", secondaryColor: "#facc15", outfit: "tights" }, { versionLabel: "Peak 1988" }],
    ["ultimate-warrior", "Ultimate Warrior", "The Warrior", "powerhouse", "face", 86, 92, 96, 86, 31, 74, 280, "Warrior Splash", ["Gorilla Press", "Running Clothesline", "Shoulder Block"], { skinTone: S2, hairColor: BROWN, hairStyle: "long", primaryColor: "#f97316", secondaryColor: "#7c3aed", outfit: "trunks", muscle: 1, definition: 0.85 }, { versionLabel: "Peak 1990" }],
    ["andre-the-giant", "André the Giant", "The Eighth Wonder of the World", "giant", "heel", 85, 90, 98, 85, 41, 88, 520, "Sit-Down Splash", ["Headbutt", "Big Boot", "Bearhug"], { skinTone: S1, hairColor: BROWN, hairStyle: "long", primaryColor: "#111318", secondaryColor: "#111318", outfit: "singlet", bodyFat: 0.7, bulk: 1 }, { versionLabel: "Peak 1987" }],
    ["dusty-rhodes", "Dusty Rhodes", "The American Dream", "brawler", "face", 86, 97, 95, 86, 40, 74, 275, "Bionic Elbow", ["Flying Elbow", "Figure-Four", "Cross Body"], { skinTone: S1, hairColor: BLOND, hairStyle: "short", primaryColor: "#facc15", secondaryColor: "#111318", outfit: "trunks", bodyFat: 0.6 }, { versionLabel: "Peak 1985" }],
    ["roddy-piper", "Roddy Piper", "Rowdy", "brawler", "heel", 85, 97, 94, 85, 31, 74, 230, "Sleeper Hold", ["Eye Poke", "Bulldog", "Belly-to-Back Suplex"], { skinTone: S1, hairColor: RED, hairStyle: "short", primaryColor: "#991b1b", secondaryColor: "#14532d", outfit: "trunks" }, { versionLabel: "Peak 1985" }],
    ["ricky-steamboat", "Ricky Steamboat", "The Dragon", "technician", "face", 93, 86, 91, 93, 36, 70, 235, "Diving Crossbody", ["Arm Drag", "Chops", "Small Package"], { skinTone: S2, hairColor: BLACK, hairStyle: "short", primaryColor: "#111318", secondaryColor: "#dc2626", outfit: "trunks" }, { versionLabel: "Peak 1989" }],
    ["mr-perfect", "Mr. Perfect", "Mr. Perfect", "technician", "heel", 90, 90, 89, 90, 32, 75, 245, "Perfect-Plex", ["Rolling Necksnap", "Dropkick", "Sleeper Hold"], { skinTone: S1, hairColor: BLOND, hairStyle: "long", primaryColor: "#db2777", secondaryColor: "#111318", outfit: "singlet" }, { versionLabel: "Peak 1990" }],
    ["yokozuna", "Yokozuna", "The Sumo", "giant", "heel", 84, 80, 87, 84, 27, 76, 568, "Banzai Drop", ["Belly-to-Belly", "Leg Drop", "Samoan Drop"], { skinTone: S3, hairColor: BLACK, hairStyle: "ponytail", primaryColor: "#111318", secondaryColor: "#f8fafc", outfit: "trunks", bodyFat: 0.9, bulk: 1 }, { era: "boom", versionLabel: "Peak 1993" }],
  ]),
  ...rows("legends", "boom", [
    ["bret-hart", "Bret Hart", "The Hitman", "technician", "heel", 94, 86, 93, 94, 40, 72, 234, "Sharpshooter", ["Russian Legsweep", "Second-Rope Elbow", "Backbreaker"], { skinTone: S1, hairColor: BLACK, hairStyle: "long", primaryColor: "#db2777", secondaryColor: "#111318", outfit: "singlet" }, { versionLabel: "Peak 1997" }],
  ]),
];

// ───────────── FREE AGENTS ─────────────
const FREE = rows("free-agents", "modern", [
  ["chris-jericho", "Chris Jericho", "The Ocho", "technician", "heel", 80, 93, 88, 80, 55, 72, 227, "Judas Effect", ["Walls of Jericho", "Codebreaker", "Lionsault"], { skinTone: S1, hairColor: BLOND, hairStyle: "short", facialHair: "beard", primaryColor: "#111318", secondaryColor: "#dc2626", outfit: "tights", bodyFat: 0.3 }],
  ["braun-strowman", "Braun Strowman", "The Monster of All Monsters", "giant", "face", 82, 80, 85, 82, 42, 80, 385, "Running Powerslam", ["Reverse Chokeslam", "Shoulder Tackle", "Corner Splash"], { skinTone: S1, hairColor: BROWN, hairStyle: "long", facialHair: "beard", primaryColor: "#111318", secondaryColor: "#14532d", outfit: "singlet" }],
  ["karrion-kross", "Karrion Kross", "The Herald of Doomsday", "striker", "heel", 80, 84, 80, 81, 40, 76, 265, "Kross Jacket", ["Doomsday Saito", "Forearm", "Knee Strike"], { skinTone: S1, hairColor: BLACK, hairStyle: "bald", facialHair: "beard", primaryColor: "#111318", secondaryColor: "#991b1b", outfit: "pants" }],
  ["andrade", "Andrade", "El Ídolo", "high-flyer", "heel", 82, 76, 78, 82, 36, 70, 210, "The Message", ["Hammerlock DDT", "Running Double Knees", "Moonsault"], { skinTone: S3, hairColor: BLACK, hairStyle: "long", facialHair: "beard", primaryColor: "#111318", secondaryColor: "#facc15", outfit: "tights" }],
  ["nic-nemeth", "Nic Nemeth", "The Wanted Man", "all-rounder", "face", 80, 84, 82, 80, 46, 72, 218, "Danger Zone", ["Zig Zag", "Superkick", "Famouser"], { skinTone: S1, hairColor: BLOND, hairStyle: "short", primaryColor: "#111318", secondaryColor: "#f8fafc", outfit: "trunks" }],
  ["matt-riddle", "Matt Riddle", "The Original Bro", "striker", "tweener", 80, 80, 78, 80, 40, 74, 216, "Bro to Sleep", ["Floating Bro", "Bromission", "Exploder Suplex"], { skinTone: S1, hairColor: BLOND, hairStyle: "long", facialHair: "beard", primaryColor: "#111318", secondaryColor: "#22c55e", outfit: "trunks" }],
  ["cedric-alexander", "Cedric Alexander", "The Soul of 205", "high-flyer", "face", 76, 74, 70, 77, 36, 70, 205, "Lumbar Check", ["Michinoku Driver", "Springboard Clothesline", "Neuralizer"], { skinTone: S5, hairColor: BLACK, hairStyle: "short", facialHair: "beard", primaryColor: "#111318", secondaryColor: "#facc15", outfit: "tights" }],
]);

/**
 * Real-life details layered on top of each look: tattoo placements, gloves,
 * pads and face paint. Approximations of what each wrestler is known for.
 */
const DETAILS: Record<string, Partial<Appearance>> = {
  "roman-reigns": { tattoos: ["tribalR"], face: { jaw: 0.8, brow: 0.7, width: 0.6 } },
  "cm-punk": { tattoos: ["sleeveL", "sleeveR", "chest"], face: { jaw: 0.5, chin: 0.6, length: 0.6 } },
  "seth-rollins": { tattoos: ["upperR"], elbowPads: true, face: { jaw: 0.55, cheeks: 0.7 } },
  "gunther": { face: { jaw: 0.75, width: 0.7, brow: 0.6 } },
  "cody-rhodes": { tattoos: ["upperL"], face: { jaw: 0.7, chin: 0.7, length: 0.6 } },
  "drew-mcintyre": { tattoos: ["sleeveR"], face: { jaw: 0.75, brow: 0.7, length: 0.65 } },
  "randy-orton": { tattoos: ["upperL", "upperR", "back"], face: { jaw: 0.55, length: 0.7, cheeks: 0.7 } },
  "brock-lesnar": { tattoos: ["chest", "back"], gloves: true, face: { jaw: 0.85, width: 0.75, brow: 0.8 } },
  "la-knight": { face: { jaw: 0.7, chin: 0.65 } },
  "jey-uso": { tattoos: ["tribalL", "tribalR", "legs"], elbowPads: true },
  "jimmy-uso": { tattoos: ["tribalL", "tribalR", "legs"], elbowPads: true },
  "solo-sikoa": { tattoos: ["tribalL", "chest"], face: { jaw: 0.75, width: 0.7 } },
  "jacob-fatu": { tattoos: ["sleeveL", "sleeveR", "neck", "torso"], face: { jaw: 0.8, width: 0.8 } },
  "sami-zayn": { face: { jaw: 0.5, nose: 0.7 } },
  "kevin-owens": { face: { jaw: 0.6, width: 0.75 } },
  "bron-breakker": { face: { jaw: 0.8, brow: 0.7 } },
  "bronson-reed": { tattoos: ["upperL"], face: { width: 0.8 } },
  "logan-paul": { face: { jaw: 0.75, chin: 0.7 } },
  "dominik-mysterio": { tattoos: ["neck", "upperR"], gloves: true },
  "finn-balor": { tattoos: ["upperL"], elbowPads: true },
  "damian-priest": { tattoos: ["sleeveL", "sleeveR", "neck", "chest", "hands"] },
  "penta": { tattoos: ["sleeveL", "sleeveR"], gloves: true },
  "rey-mysterio": { tattoos: ["sleeveL", "sleeveR", "chest", "back"] },
  "the-miz": { face: { jaw: 0.6, chin: 0.6 } },
  "sheamus": { tattoos: ["upperL", "upperR", "back"], elbowPads: true, face: { jaw: 0.7, brow: 0.8, length: 0.7 } },
  "shinsuke-nakamura": { face: { cheeks: 0.8, length: 0.6 } },
  "rusev": { tattoos: ["upperL"] },
  "aleister-black": { tattoos: ["sleeveL", "sleeveR", "chest", "back", "neck", "hands", "legs"] },
  "chad-gable": { face: { jaw: 0.6, width: 0.6 } },
  "oba-femi": { face: { jaw: 0.8, width: 0.7, brow: 0.7 } },
  "trick-williams": { tattoos: ["upperR"] },
  "ilja-dragunov": { tattoos: ["upperL"] },
  "uncle-howdy": { tattoos: ["sleeveL", "sleeveR"] },
  "montez-ford": { tattoos: ["upperL", "chest"] },
  "johnny-gargano": { tattoos: ["upperR"], elbowPads: true },
  "tommaso-ciampa": { tattoos: ["upperL", "upperR"] },
  "tama-tonga": { tattoos: ["tribalL", "tribalR"] },
  "tonga-loa": { tattoos: ["tribalL", "tribalR"] },
  "hangman-page": { face: { jaw: 0.6, length: 0.65 } },
  "mjf": { face: { jaw: 0.5, chin: 0.65, nose: 0.65 } },
  "kenny-omega": { face: { cheeks: 0.75, length: 0.6 } },
  "will-ospreay": { tattoos: ["upperR"] },
  "swerve-strickland": { tattoos: ["sleeveL", "sleeveR", "neck", "chest"] },
  "jon-moxley": { tattoos: ["sleeveL", "upperR", "chest"], face: { jaw: 0.65, brow: 0.7 } },
  "darby-allin": { tattoos: ["sleeveL", "sleeveR", "chest", "torso", "neck", "legs"], facePaint: "skull" },
  "orange-cassidy": { tattoos: ["upperL"] },
  "ricochet": { tattoos: ["sleeveR", "chest"] },
  "samoa-joe": { tattoos: ["tribalL", "tribalR", "back"], elbowPads: true, face: { width: 0.85, jaw: 0.85 } },
  "powerhouse-hobbs": { tattoos: ["upperL", "upperR"] },
  "adam-copeland": { tattoos: ["upperR"], face: { jaw: 0.6, length: 0.7 } },
  "mark-briscoe": { tattoos: ["upperL", "upperR"] },
  "claudio-castagnoli": { face: { jaw: 0.75, length: 0.7 } },
  "matt-jackson": { tattoos: ["upperL"] },
  "nick-jackson": { tattoos: ["upperR"] },
  "dax-harwood": { tattoos: ["sleeveR"], elbowPads: true },
  "brody-king": { tattoos: ["sleeveL", "sleeveR", "chest", "torso", "neck", "hands", "legs"] },
  "bobby-lashley": { face: { jaw: 0.75, width: 0.7 } },
  "jack-perry": { tattoos: ["upperL", "upperR"] },
  "josh-alexander": { tattoos: ["sleeveL"] },
  "kyle-o-reilly": { tattoos: ["sleeveL", "sleeveR"], gloves: true },
  "big-bill": { tattoos: ["upperR"] },
  "undertaker": { tattoos: ["sleeveL", "sleeveR", "chest"], gloves: true, face: { jaw: 0.7, length: 0.8, brow: 0.8 } },
  "undertaker-2020": { tattoos: ["sleeveL", "sleeveR", "chest"], gloves: true },
  "stone-cold": { tattoos: ["legs"], face: { jaw: 0.7, brow: 0.75 } },
  "the-rock": { tattoos: ["tribalL"], face: { jaw: 0.8, brow: 0.85, width: 0.65 } },
  "triple-h": { face: { jaw: 0.75, nose: 0.8, length: 0.75 } },
  "goldberg": { tattoos: ["tribalL"], gloves: true, face: { jaw: 0.85, width: 0.75 } },
  "sting": { facePaint: "crow" },
  "ultimate-warrior": { facePaint: "warrior" },
  "batista": { tattoos: ["sleeveL", "sleeveR", "torso", "back"] },
  "eddie-guerrero": { tattoos: ["back", "torso"] },
  "rey-mysterio-2006": { tattoos: ["sleeveL", "sleeveR", "chest"] },
  "edge-2006": { tattoos: ["upperR"] },
  "jeff-hardy": { tattoos: ["sleeveL", "sleeveR", "chest"], facePaint: "demon" },
  "aj-styles": { tattoos: ["upperL"], face: { jaw: 0.6 } },
  "chris-jericho": { tattoos: ["upperL", "upperR", "chest"] },
  "karrion-kross": { tattoos: ["sleeveL", "sleeveR", "neck", "chest", "back"] },
  "andrade": { tattoos: ["upperL"] },
  "matt-riddle": { tattoos: ["sleeveL"] },
  "braun-strowman": { face: { width: 0.85 } },
  "andre-the-giant": { face: { width: 0.95, jaw: 0.9, nose: 0.9, length: 0.8 } },
  "hulk-hogan": { face: { nose: 0.75, jaw: 0.7 } },
  "ric-flair": { face: { nose: 0.7, chin: 0.65 } },
  "yokozuna": { face: { width: 0.95, jaw: 0.85 } },
};

/** Ring gear touches: mask styles, lettering, footwear, sleeves and patterns. */
const GEAR: Record<string, Partial<Appearance>> = {
  "cody-rhodes": { gearPattern: "stripes", accentColor: "#f8fafc", gearText: "AN" },
  "seth-rollins": { gearPattern: "lightning", accentColor: "#facc15", bootStyle: "kickpads" },
  "cm-punk": { gearText: "GTS", accentColor: "#f8fafc" },
  "gunther": { kneeSleeves: true },
  "drew-mcintyre": { gearPattern: "tribal", accentColor: "#a16207" },
  "randy-orton": { gearText: "RKO", accentColor: "#a1a1aa" },
  "brock-lesnar": { gloveStyle: "fingerless" },
  "la-knight": { gearText: "YEAH", accentColor: "#facc15" },
  "jey-uso": { gearText: "YEET", accentColor: "#facc15", armSleeve: "right" },
  "jimmy-uso": { gearText: "USO", accentColor: "#f8fafc", armSleeve: "left" },
  "jacob-fatu": { gearPattern: "tribal", accentColor: "#b91c1c" },
  "bron-breakker": { gearText: "BB", accentColor: "#f8fafc" },
  "logan-paul": { bootStyle: "sneakers", gearPattern: "fade" },
  "dominik-mysterio": { gearText: "DOM", accentColor: "#f8fafc" },
  "finn-balor": { gearPattern: "snake", accentColor: "#f8fafc" },
  "penta": { maskStyle: "luchador", maskPattern: "teeth", gearPattern: "splatter", accentColor: "#dc2626" },
  "rey-mysterio": { maskStyle: "luchador", maskPattern: "cross", bootStyle: "kickpads", gearPattern: "stars", accentColor: "#facc15" },
  "rey-mysterio-2006": { maskStyle: "luchador", maskPattern: "wings", bootStyle: "kickpads", accentColor: "#1d4ed8" },
  "dragon-lee": { bootStyle: "kickpads", gearPattern: "flames", accentColor: "#facc15" },
  "uncle-howdy": { maskStyle: "skull", maskPattern: "plain" },
  "shinsuke-nakamura": { bootStyle: "kickpads", gearPattern: "snake" },
  "ilja-dragunov": { bootStyle: "kickpads" },
  "kofi-kingston": { gearPattern: "fade", accentColor: "#22c55e" },
  "xavier-woods": { gearPattern: "fade", accentColor: "#22c55e" },
  "austin-theory": { gearText: "A-TOWN", accentColor: "#facc15" },
  "will-ospreay": { bootStyle: "kickpads", gearPattern: "flames", accentColor: "#f8fafc" },
  "kenny-omega": { bootStyle: "kickpads", gearPattern: "lightning", accentColor: "#facc15" },
  "kyle-fletcher": { bootStyle: "kickpads" },
  "mjf": { gearText: "MJF", accentColor: "#f8fafc" },
  "hangman-page": { gearPattern: "stars", accentColor: "#facc15" },
  "swerve-strickland": { gearPattern: "splatter", accentColor: "#facc15" },
  "darby-allin": { bootStyle: "sneakers", armSleeve: "both" },
  "mike-bailey": { bootStyle: "kickpads" },
  "kazuchika-okada": { gearText: "OKADA", accentColor: "#facc15" },
  "bandido": { maskStyle: "luchador", maskPattern: "stars", accentColor: "#facc15" },
  "mistico": { maskStyle: "luchador", maskPattern: "wings", accentColor: "#facc15" },
  "komander": { maskStyle: "luchador", maskPattern: "flames", accentColor: "#dc2626" },
  "matt-jackson": { gearPattern: "stars", accentColor: "#f8fafc" },
  "nick-jackson": { gearPattern: "stars", accentColor: "#f8fafc" },
  "kane": { maskStyle: "full", maskPattern: "stripes", gloves: true, gloveStyle: "full" },
  "mick-foley": { maskStyle: "full", maskPattern: "teeth" },
  "stone-cold": { gearText: "3:16", accentColor: "#f8fafc" },
  "hulk-hogan": { gearText: "HULKSTER", accentColor: "#facc15" },
  "randy-savage": { gearPattern: "stars", accentColor: "#facc15" },
  "ultimate-warrior": { gearPattern: "lightning", accentColor: "#facc15", armSleeve: "both" },
  "sting": { gearPattern: "flames", accentColor: "#e5e7eb" },
  "the-rock": { gearText: "ROCK", accentColor: "#f8fafc" },
  "shawn-michaels": { gearPattern: "flames", accentColor: "#facc15" },
  "bret-hart": { gearPattern: "fade", accentColor: "#f8fafc" },
  "owen-hart": { gearPattern: "fade", accentColor: "#f8fafc" },
  "triple-h": { gearText: "DX", accentColor: "#a3e635" },
  "jeff-hardy": { armSleeve: "both", gearPattern: "splatter", accentColor: "#22c55e" },
  "rob-van-dam": { bootStyle: "kickpads", gearPattern: "flames", accentColor: "#facc15" },
  "eddie-guerrero": { gearPattern: "flames", accentColor: "#dc2626" },
  "goldberg": { gloveStyle: "fingerless" },
  "undertaker": { gloveStyle: "fingerless" },
  "undertaker-2020": { gloveStyle: "fingerless" },
  "aj-styles": { gearPattern: "stars", accentColor: "#f8fafc" },
  "booker-t": { gearText: "BOOKER", accentColor: "#111318" },
  "bryan-danielson": { bootStyle: "kickpads" },
  "kurt-angle": { gearPattern: "stars", accentColor: "#f8fafc" },
  "john-cena": { bootStyle: "sneakers", gearText: "HLR", accentColor: "#f8fafc" },
  "john-cena-2025": { bootStyle: "sneakers" },
};

export const WRESTLER_DEFS: WrestlerDef[] = [...WWE, ...AEW, ...LEGENDS, ...FREE].map((d) => {
  const extra = { ...DETAILS[d.id], ...GEAR[d.id] };
  return Object.keys(extra).length ? { ...d, look: { ...d.look, ...extra } } : d;
});

export const TEAM_DEFS: TeamDef[] = [
  { id: "the-usos", name: "The Usos", members: ["jey-uso", "jimmy-uso"], brand: "mayhem", chemistry: 95 },
  { id: "judgment-day", name: "The Judgment Day", members: ["finn-balor", "jd-mcdonagh"], brand: "mayhem", chemistry: 82 },
  { id: "new-day", name: "The New Day", members: ["kofi-kingston", "xavier-woods"], brand: "mayhem", chemistry: 94 },
  { id: "street-profits", name: "The Street Profits", members: ["montez-ford", "angelo-dawkins"], brand: "mayhem", chemistry: 90 },
  { id: "diy", name: "#DIY", members: ["johnny-gargano", "tommaso-ciampa"], brand: "mayhem", chemistry: 88 },
  { id: "mft", name: "MFT", members: ["tama-tonga", "tonga-loa"], brand: "mayhem", chemistry: 86 },
  { id: "a-town-down-under", name: "A-Town Down Under", members: ["austin-theory", "grayson-waller"], brand: "mayhem", chemistry: 80 },
  { id: "young-bucks", name: "The Young Bucks", members: ["matt-jackson", "nick-jackson"], brand: "fury", chemistry: 97 },
  { id: "ftr", name: "FTR", members: ["dax-harwood", "cash-wheeler"], brand: "fury", chemistry: 96 },
  { id: "brodido", name: "Brodido", members: ["brody-king", "bandido"], brand: "fury", chemistry: 86 },
  { id: "hurt-syndicate", name: "The Hurt Syndicate", members: ["bobby-lashley", "shelton-benjamin"], brand: "fury", chemistry: 88 },
  { id: "death-riders", name: "Death Riders", members: ["claudio-castagnoli", "wheeler-yuta"], brand: "fury", chemistry: 82 },
  { id: "jetspeed", name: "JetSpeed", members: ["kevin-knight", "mike-bailey"], brand: "fury", chemistry: 84 },
];
