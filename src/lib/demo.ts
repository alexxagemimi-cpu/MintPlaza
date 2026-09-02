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
 * When this is off, the interface shows its real empty states. That is the
 * correct look for a platform before it has users, and those empty states are
 * a designed surface rather than an afterthought (§46).
 */

export const DEMO_ENABLED =
  process.env.NEXT_PUBLIC_DEMO_MODE === "on" &&
  process.env.NODE_ENV !== "production";

export interface DemoListing {
  /** Always true. Nothing from this module renders without its badge. */
  isDemo: true;
  id: string;
  gameSlug: string;
  offering: readonly string[];
  wanting: readonly string[];
  note: string;
  /** Hours since posting, so the relative time never drifts as dates pass. */
  postedHoursAgo: number;
  /** Reason code from the matching engine's fixed set (§8). */
  reason: "RECIPROCAL_MATCH" | "HAS_WHAT_YOU_WANT" | "WANTS_WHAT_YOU_HAVE" | null;
}

const LISTINGS: readonly DemoListing[] = [
  {
    isDemo: true,
    id: "d1",
    gameSlug: "blox-fruits",
    offering: ["Permanent Dough"],
    wanting: ["Permanent Kitsune", "Permanent Leopard"],
    note: "Only after both are shown in-game. No middleman.",
    postedHoursAgo: 2,
    reason: "RECIPROCAL_MATCH",
  },
  {
    isDemo: true,
    id: "d2",
    gameSlug: "blox-fruits",
    offering: ["Physical Kitsune", "Godhuman"],
    wanting: ["Permanent Dragon"],
    note: "Happy to add materials on top to even it out.",
    postedHoursAgo: 5,
    reason: "HAS_WHAT_YOU_WANT",
  },
  {
    isDemo: true,
    id: "d3",
    gameSlug: "blox-fruits",
    offering: ["Permanent Spirit"],
    wanting: ["Permanent Portal", "Permanent Control"],
    note: "Third sea only. I can show proof before we start.",
    postedHoursAgo: 11,
    reason: "WANTS_WHAT_YOU_HAVE",
  },
  {
    isDemo: true,
    id: "d4",
    gameSlug: "adopt-me",
    offering: ["Mega Neon Frost Dragon"],
    wanting: ["Neon Shadow Dragon", "Bat Dragon"],
    note: "Looking for a fair trade, not overpay. Will decline lowballs.",
    postedHoursAgo: 1,
    reason: "RECIPROCAL_MATCH",
  },
  {
    isDemo: true,
    id: "d5",
    gameSlug: "adopt-me",
    offering: ["Neon Owl", "Fly & Ride Unicorn"],
    wanting: ["Mega Neon Crow"],
    note: "Can add pets to make up the difference.",
    postedHoursAgo: 7,
    reason: "HAS_WHAT_YOU_WANT",
  },
  {
    isDemo: true,
    id: "d6",
    gameSlug: "murder-mystery-2",
    offering: ["Chroma Luger"],
    wanting: ["Chroma Darkbringer"],
    note: "Straight swap, both godlies. Trading in-game only.",
    postedHoursAgo: 3,
    reason: "RECIPROCAL_MATCH",
  },
  {
    isDemo: true,
    id: "d7",
    gameSlug: "royale-high",
    offering: ["Winter Halo 2019"],
    wanting: ["Autumn Halo 2020"],
    note: "Open to hearing offers with sets added on.",
    postedHoursAgo: 9,
    reason: "HAS_WHAT_YOU_WANT",
  },
  {
    isDemo: true,
    id: "d8",
    gameSlug: "grow-a-garden",
    offering: ["Mutated Candy Blossom"],
    wanting: ["Mutated Beanstalk", "Ember Lily"],
    note: "Will trade during the next weather window.",
    postedHoursAgo: 4,
    reason: "WANTS_WHAT_YOU_HAVE",
  },
  {
    isDemo: true,
    id: "d9",
    gameSlug: "creatures-of-sonaria",
    offering: ["Adult Boreacal"],
    wanting: ["Adult Nyctosaurus"],
    note: "Also happy to just run pack missions if you would rather.",
    postedHoursAgo: 6,
    reason: "RECIPROCAL_MATCH",
  },
] as const;

/** Example listings for a game, or nothing at all when demo mode is off. */
export function demoListings(gameSlug: string): readonly DemoListing[] {
  if (!DEMO_ENABLED) return [];
  return LISTINGS.filter((l) => l.gameSlug === gameSlug);
}

/** Copy for each reason code. The engine explains itself; it never guesses. */
export const REASON_COPY: Record<NonNullable<DemoListing["reason"]>, string> = {
  RECIPROCAL_MATCH: "They want something you have, and have something you want",
  HAS_WHAT_YOU_WANT: "Has something on your wants list",
  WANTS_WHAT_YOU_HAVE: "Looking for something you have",
};
