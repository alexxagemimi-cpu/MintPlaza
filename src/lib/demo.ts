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
 *  Sessions — the raids and services board
 * ==================================================================== */

import {
  activitiesFor, findActivity, type SessionPost, type Terms,
} from "./sessions";
import { tradableFor as tradableItems } from "./items";

const SESSION_NOTES = [
  "Mic not needed, I'll ping when we go.",
  "Please be actually at the level, we wiped twice yesterday.",
  "First timers welcome, I'll explain it.",
  "I've got the chip, just need bodies.",
  "Waiting in a private server, say the word.",
  "",
  "",
];

const HOST_ASKS = [
  "Level 2400+",
  "V3 awakened",
  "Third Sea only",
  "Bring your own fruit, no lending",
  "",
  "",
  "",
];

/**
 * Example sessions for a game.
 *
 * Built from the real activity list so the slot counts obey what the game
 * actually requires — a Leviathan never appears asking for four players, and a
 * V4 trial is always exactly three, because those are the game's own rules and
 * an example that broke them would teach the wrong thing.
 */
export function demoSessions(gameSlug: string, count = 7): readonly SessionPost[] {
  if (!DEMO_ENABLED) return [];

  const activities = activitiesFor(gameSlug);
  if (activities.length === 0) return [];

  // Something to offer in return, drawn from the same catalogue trades use.
  const items = tradableItems(gameSlug);

  return Array.from({ length: count }, (_, n) => {
    const rand = seededRandom(`${gameSlug}:session:${n}`);
    const activity = activities[n % activities.length];

    // The game's floor wins. Where it names an exact party size, use it.
    const min = activity.minPlayers ?? 2;
    const max = activity.maxPlayers ?? Math.max(min, 2 + Math.floor(rand() * 4));
    const slotsTotal = Math.max(min, Math.min(max, min + Math.floor(rand() * 2)));
    const slotsFilled = Math.min(slotsTotal, 1 + Math.floor(rand() * slotsTotal));

    const roll = rand();
    const terms: Terms =
      roll > 0.82 && items.length > 0
        ? { kind: "item", itemId: pick(rand, items).id }
        : roll > 0.5
          ? { kind: "split" }
          : { kind: "free" };

    return {
      isDemo: true as const,
      id: `${gameSlug}-session-${n}`,
      gameSlug,
      activityId: activity.id,
      host: USERNAMES[(n * 7 + gameSlug.length) % USERNAMES.length],
      hostSessions: Math.floor(rand() * 90),
      slotsTotal,
      slotsFilled,
      startsInMinutes: rand() > 0.55 ? 0 : 1 + Math.floor(rand() * 45),
      terms,
      asks: pick(rand, HOST_ASKS) || undefined,
      note: pick(rand, SESSION_NOTES) || undefined,
    };
  });
}

/** Named so the activity list can say what it is missing, like the catalogue. */
export function activityCount(gameSlug: string): number {
  return activitiesFor(gameSlug).length;
}

export { findActivity };
