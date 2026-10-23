/**
 * Promo and confrontation dialogue. Lines are assembled from template pools
 * keyed by rivalry theme, storyline stage and alignment, then filled with the
 * wrestlers' names, nicknames, finishers, titles and the series record.
 */
import { STIPULATION_LABELS } from "./simulation";
import { rivalryTheme } from "./storyline";
import { activeRivalriesFor, championshipsHeldBy, sideName, wrestler } from "./queries";
import type { Rng } from "./rng";
import type { DialogueLine, Rivalry, RivalryTheme, Universe, Wrestler } from "./types";

type Pool = readonly string[];
type Vars = Record<string, string>;

/** Opening statement, by theme and stage bucket (0 early, 1 heated, 2 final words). */
const OPENERS: Record<RivalryTheme, [Pool, Pool, Pool]> = {
  personal: [
    ["{them}, I don't know what your problem is with me, but I'm done keeping quiet about it.", "Everybody keeps asking me about {them}. So let's talk about {them}."],
    ["{them}, you crossed a line. This stopped being business the second you put your hands on me.", "I lie awake at night thinking about what I'm going to do to you, {them}."],
    ["After all the talk, {them}, it's just you, me and a referee. No more excuses.", "This ends when one of us can't get up. I promise you it won't be me."],
  ],
  "title-pursuit": [
    ["I didn't come here to make friends, I came here for that {title}.", "{them}, that {title} looks good on you. It'll look better on me."],
    ["Every week you hide behind that {title}, {them}, and every week I get closer.", "I've beaten everybody they put in front of me. The only name left is {them}."],
    ["When the bell rings, {them}, you're not the champion any more. You're just the man standing between me and my destiny.", "I've imagined holding the {title} a thousand times. The next time won't be imaginary."],
  ],
  betrayal: [
    ["{them}, I trusted you. I'd have taken a bullet for you. And you stabbed me in the back.", "You want to know why I did it? Because you were holding me back, {them}."],
    ["Every time I close my eyes I see you turning on me, {them}.", "Brothers? We were never brothers. You were just my ticket here."],
    ["You taught me everything, {them}. Now I'm going to show you everything I learned.", "I'll finish what I started the night I turned on you."],
  ],
  respect: [
    ["{them}, I've got nothing but respect for you. That's exactly why I want to beat you.", "People say {them} is the best in the world. I want to find out for myself."],
    ["You've pushed me harder than anyone ever has, {them}. Don't you dare take it easy on me.", "{series}. It's close because we're the two best in this building."],
    ["Win or lose, {them}, we're going to tear the house down. But I'm planning on winning.", "One more time, {them}. Best man wins, and we shake hands after."],
  ],
  legacy: [
    ["{them}, your time is up. This is my era now.", "Kid, I was main-eventing when you were in diapers. Show some respect."],
    ["Legends don't fade away, {them}. They get carried out, and you're not strong enough to carry me.", "Every generation needs someone to retire the old guard. I volunteer."],
    ["This is the passing of the torch, {them}, whether you hand it over or I rip it from you.", "One last ride, {them}. Make it count, because I will."],
  ],
  jealousy: [
    ["Everybody loves {them}. Nobody ever asks why.", "They hand {them} everything. I've earned every inch of what I've got."],
    ["You got my spot, {them}. You got my moments. I want them back.", "Smile for the cameras, {them}. Smile while you still can."],
    ["When this is over, nobody will remember your name, {them}.", "I'm done being the second choice."],
  ],
  revenge: [
    ["{them}, you put me on the shelf. I'm back, and I remember everything.", "I've been counting the days, {them}."],
    ["I don't want to beat you, {them}. I want to hurt you.", "Every rehab session, every sleepless night, I was thinking of you, {them}."],
    ["An eye for an eye, {them}. Tonight I collect.", "You started this war, {them}. I'm going to end it."],
  ],
  invasion: [
    ["This brand belongs to us now, and there's nothing {them} can do about it.", "You hear that? That's the sound of us taking over."],
    ["Every week we take a little more, {them}. Your locker room is scared.", "We're not guests here, {them}. We're the new landlords."],
    ["Winner takes all, {them}. Lose this and you never come back.", "When the dust settles, only one side is left standing."],
  ],
};

const FACE_RETORTS: Pool = [
  "You talk a lot, {them}. Let's see if you can back it up.",
  "These people don't want speeches, {them}. They want a fight. So do I.",
  "Say my name one more time, {them}, and I'll give you something to talk about.",
  "I've heard it all before. Then I hit the {fin} and you heard the three-count.",
  "You want to fight me? You've got it. Any time, any place.",
  "Funny. You keep running your mouth, but you never stop running.",
];
const HEEL_RETORTS: Pool = [
  "Shut up! Nobody here cares what you think. Isn't that right, you idiots?",
  "{them}, the only reason you're cheered is because these people don't know any better.",
  "I'm the best thing that ever happened to this company, and it's not even close.",
  "You're out of your league, {them}. And deep down, you know it.",
  "Keep talking, hero. It'll make it sweeter when I take everything from you.",
  "I didn't come out here to listen. I came out here to be listened to.",
];
const THREATS: Pool = [
  "When I hit the {fin}, you'll be seeing stars for a week.",
  "Mark my words: {them} goes down, and stays down.",
  "I'll beat you in {payoff}, and I'll make it look easy.",
  "Bring whatever you want, {them}. You'll still lose.",
  "I've got the {fin} with your name on it.",
];
const HEEL_CLOSERS: Pool = [
  "Enjoy the cheers while you can, {them}. They'll be crying for you soon enough.",
  "This conversation's over. And so is your career.",
  "Get out of my ring.",
];
const FACE_CLOSERS: Pool = [
  "When we meet in {payoff}, bring a stretcher.",
  "Let's make it official: you and me, in {payoff}.",
  "I'm not going anywhere, {them}. I'll be right here waiting.",
];

const ENTRANCES: Pool = [
  "{me}'s music hits and {me} heads down the ramp, microphone in hand.",
  "The lights drop. When they come back up, {me} is standing in the ring.",
  "{me} storms out from the back, waving off the crowd.",
  "{me} walks out to a huge reaction and takes the microphone.",
];
const INTERRUPTS: Pool = [
  "{me} interrupts from the stage.",
  "The crowd erupts as {me}'s music cuts the promo off.",
  "{me} strolls out through the crowd, already talking.",
  "{me} appears on the big screen.",
];
const ENDINGS: Record<"stare" | "brawl" | "sneak" | "respect", Pool> = {
  stare: ["The two go nose to nose as the crowd chants for a fight.", "Neither man blinks. Officials hit the ring, but nobody throws a punch. Yet."],
  brawl: ["Fists start flying. Security floods the ring to pull them apart.", "The brawl spills to the floor, through the timekeeper's area and into the crowd."],
  sneak: ["{heel} feigns a handshake, then drops {face} with a cheap shot and stands tall over the wreckage.", "{heel} blindsides {face} with a low blow and walks off laughing."],
  respect: ["{a} extends a hand. After a long pause, {b} shakes it to a standing ovation.", "The crowd rises as {a} and {b} share a nod of respect."],
};

const SOLO_BOASTS: Pool = [
  "I'm the best in the world, and I'm here to prove it every single week.",
  "Line them up. I'll knock them down.",
  "They call me {nick}, and there's a reason for that.",
  "I want the best competition this company has. Send them.",
  "Everyone in the back is on notice. {me} is coming for the top.",
];
const CHAMP_BOASTS: Pool = [
  "Look at this. The {title}. Mine. And nobody in that locker room is taking it.",
  "I'm the {title} champion, and I'll defend it against anyone with the guts to step up.",
  "This {title} has never been in better hands.",
];
const INTERVIEW_OPEN: Pool = [
  "Backstage, an interviewer asks {me} about the week ahead.",
  "{me} is caught in the locker room corridor by a camera crew.",
  "In a sit-down interview, {me} is asked what comes next.",
];
const CROWD_POP: Pool = ["The crowd chants \"{me}! {me}!\"", "A loud chant of \"You still got it!\" breaks out.", "The building is on its feet."];
const CROWD_HEAT: Pool = ["The crowd showers {me} with boos.", "A deafening \"You suck!\" chant starts up.", "Somebody in the front row throws a drink at {me}."];

function fill(template: string, vars: Vars) {
  return template.replace(/\{(\w+)\}/g, (_, k) => vars[k] ?? k);
}

function stageBucket(r: Rivalry | null) {
  if (!r) return 0;
  return r.stage <= 0 ? 0 : r.stage <= 2 ? 1 : 2;
}

function varsFor(universe: Universe, me: Wrestler, them: string[], rivalry: Rivalry | null): Vars {
  const held = championshipsHeldBy(universe, me.id)[0];
  const title = rivalry?.titleId ? universe.championships[rivalry.titleId] : held;
  const mineA = rivalry ? rivalry.sideA.includes(me.id) : true;
  const series = rivalry ? `${mineA ? rivalry.aWins : rivalry.bWins}–${mineA ? rivalry.bWins : rivalry.aWins} in our series` : "";
  const payoff = rivalry?.payoff === "stipulation-match" && rivalry.stipulation ? `a ${STIPULATION_LABELS[rivalry.stipulation]} match` : rivalry?.payoff === "title-match" ? "the title match" : "our showdown";
  return {
    me: me.ringName,
    nick: me.nickname || me.ringName,
    them: them.length ? sideName(universe, them) : "anybody",
    fin: me.finisher || "finisher",
    title: title ? title.shortName : "championship",
    series: series ? series[0].toUpperCase() + series.slice(1) : "",
    payoff,
  };
}

/** Picks a line not used in this exchange yet. */
function pickFresh(rng: Rng, pool: Pool, used: Set<string>) {
  const fresh = pool.filter((p) => !used.has(p));
  const t = rng.pick(fresh.length ? fresh : pool);
  used.add(t);
  return t;
}

/** The talker of a side: the best promo among its members. */
function mouthpiece(universe: Universe, ids: string[]) {
  return ids.map((id) => wrestler(universe, id)).sort((a, b) => b.attributes.promo - a.attributes.promo)[0];
}

export function generateDialogue(
  universe: Universe,
  input: { kind: "promo" | "interview" | "rivalry"; sideA: string[]; sideB: string[]; rivalry: Rivalry | null },
  rng: Rng,
): DialogueLine[] {
  const { sideA, sideB } = input;
  if (!sideA.length) return [];
  const used = new Set<string>();
  const lines: DialogueLine[] = [];
  const say = (w: Wrestler | null, pool: Pool, vars: Vars) => lines.push({ speakerId: w?.id ?? null, text: fill(pickFresh(rng, pool, used), vars) });

  // Face-to-face confrontation
  if (input.kind === "rivalry" && sideB.length) {
    const r = input.rivalry;
    const a = mouthpiece(universe, sideA);
    const b = mouthpiece(universe, sideB);
    // the face usually opens; heels interrupt
    const [first, firstSide, second, secondSide] = a.alignment === "heel" && b.alignment !== "heel" ? [b, sideB, a, sideA] : [a, sideA, b, sideB];
    const v1 = varsFor(universe, first, secondSide, r);
    const v2 = varsFor(universe, second, firstSide, r);
    const theme = r ? rivalryTheme(r) : "personal";
    const bucket = stageBucket(r);
    say(null, ENTRANCES, v1);
    say(first, OPENERS[theme][bucket], v1);
    if (bucket >= 1 && r && (r.aWins || r.bWins) && rng.chance(0.4)) lines.push({ speakerId: first.id, text: `${v1.series}. You know how this ends.` });
    say(null, INTERRUPTS, { ...v2, me: second.ringName });
    say(second, second.alignment === "heel" ? HEEL_RETORTS : FACE_RETORTS, v2);
    say(null, first.alignment === "heel" ? CROWD_HEAT : CROWD_POP, v1);
    say(first, THREATS, v1);
    say(second, second.alignment === "heel" ? HEEL_CLOSERS : FACE_CLOSERS, v2);
    const heel = [first, second].find((w) => w.alignment === "heel");
    const face = [first, second].find((w) => w.alignment !== "heel");
    const ending =
      r?.stage === 4 || (theme === "respect" && bucket === 2)
        ? "respect"
        : heel && face && rng.chance(0.45)
          ? "sneak"
          : bucket >= 1 || (r?.intensity ?? 0) > 60
            ? "brawl"
            : "stare";
    say(null, ENDINGS[ending], { a: first.ringName, b: second.ringName, heel: heel?.ringName ?? first.ringName, face: face?.ringName ?? second.ringName });
    return lines;
  }

  // Solo promo or interview: the speaker addresses their rival if they have one
  const me = mouthpiece(universe, [...sideA, ...sideB]);
  const rivalry = input.rivalry ?? activeRivalriesFor(universe, me.id).sort((x, y) => y.intensity - x.intensity)[0] ?? null;
  const foes = rivalry ? (rivalry.sideA.includes(me.id) ? rivalry.sideB : rivalry.sideA) : [];
  const v = varsFor(universe, me, foes, rivalry);
  if (input.kind === "interview") say(null, INTERVIEW_OPEN, v);
  else say(null, ENTRANCES, v);
  if (input.kind === "promo") say(null, me.alignment === "heel" ? CROWD_HEAT : CROWD_POP, v);
  if (rivalry) {
    say(me, OPENERS[rivalryTheme(rivalry)][stageBucket(rivalry)], v);
    say(me, THREATS, v);
  } else {
    say(me, championshipsHeldBy(universe, me.id).length ? CHAMP_BOASTS : SOLO_BOASTS, v);
    say(me, SOLO_BOASTS, v);
  }
  return lines;
}
