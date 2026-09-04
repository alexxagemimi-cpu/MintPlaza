/**
 * Raids, bosses and services — the middle Explore tab.
 *
 * Trading matches items. This matches *people to a moment*, and that difference
 * drives everything here.
 *
 * A trade listing is patient: it can sit for a week and still be true. A raid
 * forming is not. It has a fixed number of seats, it starts soon, and forty
 * minutes later it is noise. So a session carries slots and a start time, and
 * the interface is built to answer one question fast — can I join this, right
 * now, with the character I actually have?
 *
 * The requirements are the game's, not ours. Leviathan really does need five
 * players in one Sea Exploration Group before the Frozen Watcher opens the
 * gate; the Race V4 trial really does need three players of three different
 * races activating V3 together. Stating those up front is the whole value: it
 * stops four people gathering for something that needs five.
 */

/** What kind of thing people gather for. Named as the games name them. */
export type ActivityKind =
  | "Raid" | "Boss" | "Trial" | "Sea event" | "Grind" | "Event" | "Service";

export interface Activity {
  id: string;
  gameSlug: string;
  name: string;
  kind: ActivityKind;
  /**
   * What the game itself demands before this can start. Only stated where it
   * was confirmed — a wrong requirement here wastes a group's evening.
   */
  needs?: string;
  /** Party size the game enforces, where it enforces one. */
  minPlayers?: number;
  maxPlayers?: number;
  /** What you get, where it is the reason people run it. */
  reward?: string;
  verified?: boolean;
}

/**
 * Blox Fruits.
 *
 * Read off the wiki: the Leviathan's five-player gate, the V4 trial's three
 * races, the Mirror Fractal's guaranteed drop from Dough King, the raid chip
 * that hosting a raid needs, and the Sea Beast whose health scales with how
 * many players are nearby.
 */
const BLOX_FRUITS_ACTIVITIES: Activity[] = [
  {
    id: "bf-a-v4-trial", gameSlug: "blox-fruits", name: "Race V4 trial", kind: "Trial",
    needs: "3 players of 3 different races, all activating V3 at the same moment",
    minPlayers: 3, maxPlayers: 3,
    reward: "Race V4", verified: true,
  },
  {
    id: "bf-a-leviathan", gameSlug: "blox-fruits", name: "Leviathan hunt", kind: "Sea event",
    needs: "5+ players in one Sea Exploration Group, and a Frozen Dimension to open the gate",
    minPlayers: 5,
    reward: "Leviathan drops", verified: true,
  },
  {
    id: "bf-a-dough-king", gameSlug: "blox-fruits", name: "Dough King", kind: "Boss",
    reward: "Mirror Fractal, guaranteed", verified: true,
  },
  {
    id: "bf-a-rip-indra", gameSlug: "blox-fruits", name: "Rip Indra (True Form)", kind: "Boss",
    needs: "Castle on the Sea, Third Sea",
    reward: "A step on the Race Awakening puzzle", verified: true,
  },
  {
    id: "bf-a-raid", gameSlug: "blox-fruits", name: "Fruit raid", kind: "Raid",
    needs: "Someone in the party has to own the raid chip",
    reward: "Fragments toward awakening", verified: true,
  },
  {
    id: "bf-a-sea-beast", gameSlug: "blox-fruits", name: "Sea Beast hunt", kind: "Sea event",
    needs: "Sea Danger Level 1-6. The beast's health scales with players nearby",
    reward: "Sea Beast drops", verified: true,
  },
  {
    id: "bf-a-cake-prince", gameSlug: "blox-fruits", name: "Cake Prince", kind: "Boss",
    needs: "Cake Land, Third Sea", verified: true,
  },
  {
    id: "bf-a-terrorshark", gameSlug: "blox-fruits", name: "Terrorshark", kind: "Sea event",
    verified: true,
  },
  {
    id: "bf-a-awakening", gameSlug: "blox-fruits", name: "Awakening fragment grind", kind: "Grind",
    needs: "About 14,500 fragments for most fruits", verified: true,
  },
  {
    id: "bf-a-level", gameSlug: "blox-fruits", name: "Third Sea level grind", kind: "Grind",
    verified: true,
  },
  {
    id: "bf-a-bounty", gameSlug: "blox-fruits", name: "Bounty hunting", kind: "Grind",
    verified: true,
  },
];

/**
 * The other five games. Shorter, and honestly so — these carry the activities
 * their communities actually organise around, and the list grows through the
 * control panel rather than through code.
 */
const OTHER_ACTIVITIES: Activity[] = [
  { id: "gg-a-weather", gameSlug: "grow-a-garden", name: "Weather event window", kind: "Event",
    needs: "You have to be in the server when it starts" },
  { id: "gg-a-restock", gameSlug: "grow-a-garden", name: "Restock watch", kind: "Event" },
  { id: "gg-a-mutation", gameSlug: "grow-a-garden", name: "Mutation run", kind: "Grind" },
  { id: "gg-a-server", gameSlug: "grow-a-garden", name: "Sharing a server", kind: "Service" },

  { id: "am-a-task", gameSlug: "adopt-me", name: "Task help", kind: "Service" },
  { id: "am-a-neon", gameSlug: "adopt-me", name: "Neon making", kind: "Grind",
    needs: "Four full-grown pets of the same kind" },

  { id: "ps-a-hatch", gameSlug: "pet-simulator-99", name: "Hatching session", kind: "Grind" },
  { id: "ps-a-clan", gameSlug: "pet-simulator-99", name: "Clan battle", kind: "Event" },
  { id: "ps-a-carry", gameSlug: "pet-simulator-99", name: "Zone carry", kind: "Service" },

  { id: "rh-a-story", gameSlug: "royale-high", name: "Story help", kind: "Service" },
  { id: "rh-a-diamond", gameSlug: "royale-high", name: "Diamond run", kind: "Grind" },
  { id: "rh-a-set", gameSlug: "royale-high", name: "Finishing an event set", kind: "Event" },

  { id: "cs-a-growth", gameSlug: "creatures-of-sonaria", name: "Growth help", kind: "Service" },
  { id: "cs-a-hunt", gameSlug: "creatures-of-sonaria", name: "Group hunt", kind: "Grind" },
];

export const ACTIVITIES: readonly Activity[] = [
  ...BLOX_FRUITS_ACTIVITIES, ...OTHER_ACTIVITIES,
];

export function activitiesFor(gameSlug: string): readonly Activity[] {
  return ACTIVITIES.filter((a) => a.gameSlug === gameSlug);
}

export function findActivity(id: string): Activity | undefined {
  return ACTIVITIES.find((a) => a.id === id);
}

/** Games whose activity list is knowingly short. Surfaced in the interface. */
export const PARTIAL_ACTIVITIES: readonly string[] = [
  "adopt-me", "pet-simulator-99", "grow-a-garden", "royale-high", "creatures-of-sonaria",
];

/**
 * What a host may ask for in return.
 *
 * A closed list, and that is a safety decision rather than a modelling one.
 * Free text here would become a marketplace for real money and for account
 * access within a week — "$5 paypal", "give me your account and I'll do it".
 * The master specification forbids both outright, and the cheapest way to
 * enforce a rule is to leave no box to type it into.
 *
 * Everything below is either nothing, or something that exists inside the game
 * and can be handed over by the game's own trade window.
 */
export type Terms =
  | { kind: "free" }
  | { kind: "split" }
  | { kind: "item"; itemId: string };

export const TERMS_COPY: Record<Terms["kind"], string> = {
  free: "Free — just need the players",
  split: "Split whatever drops",
  item: "In return for an item",
};

export interface SessionPost {
  /** Always true for now. Nothing renders without its badge. */
  isDemo: true;
  id: string;
  gameSlug: string;
  activityId: string;
  host: string;
  /** Completed interactions on MintPlaza. Zero for a new account. */
  hostSessions: number;
  slotsFilled: number;
  slotsTotal: number;
  /** Minutes until it starts. Zero means they are waiting in a server now. */
  startsInMinutes: number;
  terms: Terms;
  /** The host's own extra ask, beyond what the game requires. */
  asks?: string;
  note?: string;
}

/** Seats left, floored at zero. */
export function seatsLeft(s: SessionPost): number {
  return Math.max(0, s.slotsTotal - s.slotsFilled);
}

/**
 * A session is stale once it has started and filled. Rather than delete it, the
 * interface says so — a group that already left is useful information, and
 * quietly vanishing posts make a board feel broken.
 */
export function sessionState(s: SessionPost): "open" | "full" | "starting" {
  if (seatsLeft(s) === 0) return "full";
  if (s.startsInMinutes <= 0) return "starting";
  return "open";
}

export function startsCopy(s: SessionPost): string {
  if (s.startsInMinutes <= 0) return "In a server now";
  if (s.startsInMinutes < 60) return `Starts in ${s.startsInMinutes} min`;
  const h = Math.round(s.startsInMinutes / 60);
  return `Starts in ${h} hour${h === 1 ? "" : "s"}`;
}

/**
 * Does this session have enough people to be possible at all?
 *
 * Worth its own function because it is the thing that wastes players' time:
 * four people gathering for a Leviathan that will not open for fewer than five.
 */
export function meetsGameMinimum(s: SessionPost): boolean {
  const min = findActivity(s.activityId)?.minPlayers;
  return min === undefined || s.slotsTotal >= min;
}
