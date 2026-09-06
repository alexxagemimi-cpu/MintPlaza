/**
 * Example content, and the rules that keep it honest.
 *
 * Master spec §53 forbids fake listings, fake counts and fake activity without
 * exception. This module is the single place example content may come from, and
 * it obeys three rules:
 *
 *   1. It is off unless NEXT_PUBLIC_DEMO_MODE is explicitly "on".
 *   2. It refuses to run in a production build, so it cannot leak to real users.
 *   3. Every record it returns is flagged, and the interface badges it visibly.
 *
 * Listings are generated from the real item catalogue rather than typed out, so
 * the example content exercises the same shape a real listing will have —
 * catalogue ids, variants, quantities — instead of loose strings that would let
 * a rendering bug hide until the database arrives.
 *
 * Generation is seeded and deterministic: the server and the browser produce
 * identical output, so there is no hydration mismatch and no shuffling on every
 * refresh.
 */

import { tradableFor, ITEM_VARIANTS, type CatalogItem } from "./items";
import { VALUES, valueOf } from "./values";
import type { Contact, ContactSuggestion, DirectMessage } from "./contacts";

export const DEMO_ENABLED =
  process.env.NEXT_PUBLIC_DEMO_MODE === "on" &&
  process.env.NODE_ENV !== "production";

export type ReasonCode =
  | "RECIPROCAL_MATCH"
  | "HAS_WHAT_YOU_WANT"
  | "WANTS_WHAT_YOU_HAVE"
  | "NEW_IN_YOUR_GAME";

export interface ListingItem {
  item: CatalogItem;
  variant?: string;
  quantity: number;
}

export interface DemoListing {
  /** Always true. Nothing from this module renders without its badge. */
  isDemo: true;
  id: string;
  gameSlug: string;
  username: string;
  /** Completed interactions on MintPlaza. Zero for a new account. */
  trades: number;
  offering: ListingItem[];
  /** An empty array means the trader is open to offers. */
  wanting: ListingItem[];
  note?: string;
  postedHoursAgo: number;
  reason: ReasonCode;
}

/* ---- deterministic pseudo-randomness ------------------------------- */

function seededRandom(seed: string) {
  let h = 2166136261;
  for (let i = 0; i < seed.length; i++) {
    h ^= seed.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return () => {
    h ^= h << 13; h >>>= 0;
    h ^= h >> 17;
    h ^= h << 5;  h >>>= 0;
    return h / 4294967296;
  };
}

const USERNAMES = [
  "frostbite_kai", "quietdough", "melonhead", "kitsunemain", "seabeast_ari",
  "nokoprince", "halolyra", "packmother", "titanic_bee", "mirage_wren",
  "sableclover", "rainmutation", "aged_owl", "voidtouched", "emberlily_",
];

const NOTES = [
  "Only after both are shown in-game. No middleman.",
  "Happy to add a bit on top to even it out.",
  "I can show proof before we start.",
  "Not in a rush, looking for a fair one.",
  "Will decline lowballs, no offence meant.",
  "Trading in-game only, nothing off-platform.",
  "",
  "",
];

const REASONS: ReasonCode[] = [
  "RECIPROCAL_MATCH", "RECIPROCAL_MATCH",
  "HAS_WHAT_YOU_WANT", "WANTS_WHAT_YOU_HAVE", "NEW_IN_YOUR_GAME",
];

function pick<T>(rand: () => number, list: readonly T[]): T {
  return list[Math.floor(rand() * list.length)];
}

/** Distinct picks, so a listing never offers the same item twice. */
function pickMany<T>(rand: () => number, list: readonly T[], count: number): T[] {
  const out: T[] = [];
  const pool = [...list];
  for (let i = 0; i < count && pool.length > 0; i++) {
    out.push(pool.splice(Math.floor(rand() * pool.length), 1)[0]);
  }
  return out;
}

function buildSide(
  rand: () => number,
  pool: readonly CatalogItem[],
  variants: readonly string[],
  count: number,
): ListingItem[] {
  return pickMany(rand, pool, count).map((item) => ({
    item,
    variant: variants.length > 0 ? pick(rand, variants) : undefined,
    quantity: rand() > 0.88 ? 2 : 1,
  }));
}

const sideValue = (side: readonly ListingItem[]): number =>
  side.reduce((sum, e) => sum + (valueOf(e.item, e.variant) ?? 0) * e.quantity, 0);

/**
 * Build a want side worth roughly what the offer side is worth.
 *
 * Pairing items at random produces trades that are eighty times lopsided, which
 * is not what a listing looks like and makes the calculator read as broken when
 * every row shouts 55×. Real traders ask for something near what they are
 * giving, so the example content does too: several candidate sides are drawn
 * and the one closest to the target is kept, with a deliberate skew so the
 * screen shows genuine wins, losses and fair trades rather than all one.
 */
function buildMatchedSide(
  rand: () => number,
  pool: readonly CatalogItem[],
  variants: readonly string[],
  count: number,
  target: number,
): ListingItem[] {
  const first = buildSide(rand, pool, variants, count);
  if (target <= 0) return first;

  // Aim a little above or below parity so the verdicts are not all FAIR.
  const skew = 0.75 + rand() * 0.6;
  const goal = target * skew;

  let best = first;
  let bestGap = Math.abs(Math.log((sideValue(first) || 1) / goal));
  for (let i = 0; i < 12; i++) {
    const candidate = buildSide(rand, pool, variants, count);
    const value = sideValue(candidate);
    if (value <= 0) continue;
    const gap = Math.abs(Math.log(value / goal));
    if (gap < bestGap) { best = candidate; bestGap = gap; }
  }
  return best;
}

/** Example listings for a game, or nothing at all when demo mode is off. */
export function demoListings(gameSlug: string, count = 8): readonly DemoListing[] {
  if (!DEMO_ENABLED) return [];

  // Only what the game will actually let two players swap.
  const catalog = tradableFor(gameSlug);
  if (catalog.length === 0) return [];

  // Weight toward the top end, which is what people actually post about.
  const desirable = catalog.filter(
    (i) => i.rarity === "Mythical" || i.rarity === "Legendary",
  );
  const wide = desirable.length >= 6 ? desirable : catalog;

  // Prefer items that have a published value. A demo listing exists to exercise
  // the real path, and a screen of "NO CALL" would exercise only the fallback —
  // but the fallback is real too, so unpriced items stay in the pool where the
  // priced ones are too few to fill a screen.
  const priced = wide.filter((i) => VALUES[i.id] !== undefined);
  const pool = priced.length >= 8 ? priced : wide;
  const variants = ITEM_VARIANTS[gameSlug] ?? [];

  return Array.from({ length: count }, (_, n) => {
    const rand = seededRandom(`${gameSlug}:${n}`);
    const openToOffers = rand() > 0.82;
    const offering = buildSide(rand, pool, variants, rand() > 0.6 ? 2 : 1);

    // A trader never wants back what they are already offering, so the want
    // side is drawn from what is left.
    const offeredIds = new Set(offering.map((o) => o.item.id));
    const wantPool = pool.filter((i) => !offeredIds.has(i.id));

    // Step through the name list rather than sampling it, or the same handle
    // turns up four times on one screen.
    const username = USERNAMES[(n * 5 + gameSlug.length) % USERNAMES.length];

    return {
      isDemo: true as const,
      id: `${gameSlug}-demo-${n}`,
      gameSlug,
      username,
      trades: Math.floor(rand() * 60),
      offering,
      wanting: openToOffers
        ? []
        : buildMatchedSide(rand, wantPool, variants, rand() > 0.7 ? 2 : 1, sideValue(offering)),
      note: pick(rand, NOTES) || undefined,
      postedHoursAgo: 1 + Math.floor(rand() * 20),
      reason: pick(rand, REASONS),
    };
  });
}

/** Copy for each reason code. The engine explains itself; it never guesses. */
export const REASON_COPY: Record<ReasonCode, string> = {
  RECIPROCAL_MATCH: "They want something you have, and have something you want",
  HAS_WHAT_YOU_WANT: "Has something on your wants list",
  WANTS_WHAT_YOU_HAVE: "Looking for something you have",
  NEW_IN_YOUR_GAME: "Recently posted in a game you follow",
};


/* ==================================================================== *
 *  Service listings — the Raids & Services board
 * ==================================================================== */

import {
  servicesFor, findService, LIVE_WINDOW_MINUTES, RECRUIT_WINDOW_MINUTES, MAX_TEAM,
  type ServiceListing, type Terms, type Voter, type ListingSide,
  type DealStage, type ListingComment,
} from "./sessions";
import { tradableFor as tradableItems } from "./items";

const OFFER_NOTES = [
  "Been doing these all week, quick and no messing about.",
  "Free for anyone under level 1000, I remember the grind.",
  "I have the chip already, just say when.",
  "Can do back to back if you need more than one.",
  "",
];

const REQUEST_NOTES = [
  "Tried this solo four times, I give up.",
  "Never done it before, happy to be told what to do.",
  "Only need the one run, won't take long.",
  "Can go right now if someone's free.",
  "",
];

/**
 * People who voted on a listing.
 *
 * Demo voters carry no avatar url, so the interface falls back to a lettered
 * circle. Inventing a Roblox avatar link would put a real stranger's face on
 * fake activity, which is exactly the kind of fake the specification forbids —
 * real avatars appear once real accounts sign in through Roblox.
 */
/**
 * How many voters the card is sent.
 *
 * Enough to draw the faces and to fill the picker in an example. A real
 * listing pages through them; a hundred voter records to draw three circles
 * would be absurd either way.
 */
const VOTERS_SENT = 12;

function buildVoters(
  rand: () => number, total: number, stage: DealStage,
): Voter[] {
  const out: Voter[] = [];
  const pool = [...USERNAMES];
  const n = Math.min(total, VOTERS_SENT);
  for (let i = 0; i < n && pool.length > 0; i++) {
    // Once the poster has picked a team, the first few carry replies. Before
    // that everybody is simply a candidate.
    const picked = stage !== "voting" && i < 3;
    const roll = rand();
    out.push({
      username: pool.splice(Math.floor(rand() * pool.length), 1)[0],
      online: rand() > 0.55,
      votedMinutesAgo: Math.floor(rand() * 90),
      reply: !picked
        ? "not-picked"
        : stage === "locked" || roll > 0.6
          ? "agreed"
          : roll > 0.35
            ? "waiting"
            : "denied",
    });
  }
  return out;
}

const COMMENT_LINES = [
  "I'm ready whenever, just say the word.",
  "I can go now, I'm already in Third Sea.",
  "Done this loads of times, happy to lead it.",
  "Give me ten minutes and I'm free.",
  "I have the chip if nobody else does.",
  "What level do you need us to be?",
  "Count me in for the second run too.",
];

function buildComments(rand: () => number, voters: Voter[]): ListingComment[] {
  if (voters.length === 0 || rand() > 0.75) return [];
  const howMany = 1 + Math.floor(rand() * Math.min(4, voters.length));
  return Array.from({ length: howMany }, (_, i) => ({
    id: `c${i}`,
    author: voters[i % voters.length].username,
    online: voters[i % voters.length].online,
    text: COMMENT_LINES[Math.floor(rand() * COMMENT_LINES.length)],
    minutesAgo: Math.floor(rand() * 80),
  }));
}

const DETAILS = [
  "Need someone with a different race to me, I'm Human.",
  "Just need the one run, I have everything else ready.",
  "Stuck on the last step, everything before it is done.",
  "Happy to do it twice if you need it back.",
  "",
];

/**
 * Example listings for a game.
 *
 * Offers carry several services because that is how a helper actually posts —
 * one person advertising everything they can run. Requests carry one, because
 * somebody stuck on Yama is stuck on Yama.
 */
export function demoServiceListings(gameSlug: string, count = 12): readonly ServiceListing[] {
  if (!DEMO_ENABLED) return [];

  // Both boards are drawn from one pool, because the explore page splits them
  // by template and an example set that only covered one would leave the other
  // looking broken rather than empty.
  const help = servicesFor(gameSlug);
  const crew = servicesFor(gameSlug, "recruit");
  const services = [...help, ...crew];
  if (services.length === 0) return [];

  const items = tradableItems(gameSlug);

  return Array.from({ length: count }, (_, n) => {
    const rand = seededRandom(`${gameSlug}:service:${n}`);
    const side: ListingSide = rand() > 0.45 ? "offer" : "request";

    // A helper advertises a handful; someone stuck names one thing.
    // Every third post is a crew call, so both boards have something on them.
    const recruiting = crew.length > 0 && n % 3 === 2;
    const pool = recruiting ? crew : help.length > 0 ? help : services;
    // A crew call names one thing — you are sailing for the Leviathan or you
    // are not — so it never advertises a handful the way a helper does.
    const howMany = !recruiting && side === "offer" ? 2 + Math.floor(rand() * 4) : 1;
    const chosen = pickMany(rand, pool, Math.min(howMany, pool.length));

    const roll = rand();
    const terms: Terms =
      roll > 0.78 && items.length > 0
        ? { kind: "item", itemId: pick(rand, items).id }
        : roll > 0.42
          ? { kind: "split" }
          : { kind: "free" };

    const taken = n !== 2 && rand() > 0.88;

    return {
      isDemo: true as const,
      id: `${gameSlug}-service-${n}`,
      gameSlug,
      side,
      author: USERNAMES[(n * 3 + gameSlug.length) % USERNAMES.length],
      authorOnline: rand() > 0.4,
      completed: Math.floor(rand() * 120),
      serviceIds: chosen.map((s) => s.id),
      terms,
      note: pick(rand, side === "offer" ? OFFER_NOTES : REQUEST_NOTES) || undefined,
      // Inside the two-hour window, so the board shows what a live board looks
      // like rather than a wall of expired posts.
      // Inside whichever window this board runs on, so nothing is born expired.
      postedMinutesAgo: Math.floor(
        rand() * ((recruiting ? RECRUIT_WINDOW_MINUTES : LIVE_WINDOW_MINUTES) - 4),
      ),
      taken,
      detail: pick(rand, DETAILS) || undefined,
      ...(() => {
        // A few listings are quiet and a few are busy, which is what a real
        // board looks like — a uniform spread would make every card identical.
        const voteCount = rand() > 0.75
          ? 20 + Math.floor(rand() * 180)
          : 1 + Math.floor(rand() * 11);
        // A board shows deals at every stage at once, which is the only way to
        // see that the flow reads correctly end to end.
        // One listing is always somebody else's, already voted on by the
        // reader, and waiting on their answer — otherwise the request flow is
        // invisible until the random seed happens to produce it, and a flow you
        // cannot see is a flow nobody reviews.
        const forcedRequest = n === 2;
        const stage: DealStage = forcedRequest
          ? "requested"
          : taken
            ? "locked"
            : rand() > 0.7
              ? "requested"
              : "voting";
        const voters = buildVoters(rand, voteCount, stage);
        return {
          voteCount,
          voters,
          votersOnline: Math.floor(voteCount * (0.15 + rand() * 0.4)),
          stage,
          comments: buildComments(rand, voters),
          youVoted: forcedRequest || rand() > 0.6,
          // A couple are the reader's own, so My lists has something in it.
          yours: !forcedRequest && n % 4 === 1,
        };
      })(),
    };
  });
}

export { findService, MAX_TEAM };

/* ------------------------------------------------------------------ */
/*  Contacts — example people, so the tab can be reviewed empty-handed */
/* ------------------------------------------------------------------ */

/**
 * Suggestions and contacts for one game.
 *
 * Built from the recruitment templates rather than invented, so the "you were
 * on this together" line on every card names something that genuinely exists
 * on the board next door. A suggestion that says "Leviathan hunt" when there is
 * no Leviathan hunt would make the whole feature read as decoration.
 */
export function demoSuggestions(gameSlug: string): readonly ContactSuggestion[] {
  if (!DEMO_ENABLED) return [];
  const crew = servicesFor(gameSlug, "recruit");
  if (crew.length === 0) return [];

  const rand = seededRandom(`${gameSlug}:suggest`);
  const names = [...USERNAMES];
  const service = crew[Math.floor(rand() * crew.length)];
  const team = names.slice(0, 4);

  return team.slice(0, 3).map((username, n) => ({
    id: `${gameSlug}-suggest-${n}`,
    person: { username, online: rand() > 0.45 },
    serviceId: service.id,
    alongside: team.filter((t) => t !== username),
    // Spread across the window so the countdown reads differently on each,
    // which is the only way to see that the "clears in" line works.
    metMinutesAgo: 6 + n * 27,
    isDemo: true as const,
  }));
}

export function demoContacts(gameSlug: string): readonly Contact[] {
  if (!DEMO_ENABLED) return [];
  const crew = servicesFor(gameSlug, "recruit");
  if (crew.length === 0) return [];

  const rand = seededRandom(`${gameSlug}:contacts`);
  return USERNAMES.slice(4, 9).map((username, n) => {
    const service = crew[(n * 3) % crew.length];
    const said = rand() > 0.35;
    return {
      id: `${gameSlug}-contact-${n}`,
      person: { username, online: rand() > 0.55 },
      metServiceId: service.id,
      metDaysAgo: n,
      lastMessage: said
        ? pick(rand, [
            "on now if you still need it",
            "that worked, thanks",
            "give me 10 and I'm free",
            "which server are you in?",
            "got the chip, ready when you are",
          ])
        : undefined,
      lastMessageMinutesAgo: said ? Math.floor(rand() * 900) : undefined,
      unread: rand() > 0.75 ? 1 + Math.floor(rand() * 3) : 0,
      isDemo: true as const,
    };
  });
}

export function demoThread(contactId: string): readonly DirectMessage[] {
  if (!DEMO_ENABLED) return [];
  const rand = seededRandom(`thread:${contactId}`);
  const lines: [boolean, string][] = [
    [false, "hey, that was a good run"],
    [true, "yeah it was. same time tomorrow?"],
    [false, "should be on after school"],
    [true, "cool, I'll post it again around then"],
    [false, "sounds good, ping me here"],
  ];
  const n = 2 + Math.floor(rand() * (lines.length - 1));
  return lines.slice(0, n).map(([them, text], i) => ({
    id: `${contactId}-m${i}`,
    mine: !them,
    text,
    minutesAgo: (n - i) * 7 + Math.floor(rand() * 5),
    isDemo: true as const,
  }));
}
