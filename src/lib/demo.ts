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

import { catalogFor, ITEM_VARIANTS, type CatalogItem } from "./items";

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

/** Example listings for a game, or nothing at all when demo mode is off. */
export function demoListings(gameSlug: string, count = 8): readonly DemoListing[] {
  if (!DEMO_ENABLED) return [];

  const catalog = catalogFor(gameSlug);
  if (catalog.length === 0) return [];

  // Weight toward the top end, which is what people actually post about.
  const desirable = catalog.filter(
    (i) => i.rarity === "Mythical" || i.rarity === "Legendary",
  );
  const pool = desirable.length >= 6 ? desirable : catalog;
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
      wanting: openToOffers ? [] : buildSide(rand, wantPool, variants, rand() > 0.7 ? 2 : 1),
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
