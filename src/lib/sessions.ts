/**
 * Raids & Services — help that takes one or two people, not a team.
 *
 * This tab is deliberately narrow. It is for the things a player cannot
 * comfortably do alone but does not need a squad for: a raid carry, a trial
 * that needs exactly three, a puzzle step that needs somebody to hit you, a
 * boss that is miserable solo. Anything that needs a crew — a Leviathan wanting
 * five in one Sea Exploration Group, a Dough King run — belongs in Help &
 * Recruitment instead, and is not listed here.
 *
 * The board has two sides, and they are the same shape:
 *
 *   OFFER    "I can do these for you" — one player, many services.
 *   REQUEST  "I need help with this" — one player, one thing they are stuck on.
 *
 * Either side can vote on the other. A player stuck on Yama votes on a helper's
 * offer; a helper votes on a request they could take. A vote is interest, not a
 * commitment, and the faces of everyone who voted are the fastest way to see
 * whether a listing is worth answering.
 *
 * Listings are short-lived on purpose. Two hours, or until the deal is taken.
 * A board of week-old "still need help?" posts is worse than an empty one.
 *
 * ---------------------------------------------------------------------------
 * Everything below is read off the Blox Fruits wiki, and where a requirement is
 * stated it is the game's, not ours. A wrong requirement here costs somebody an
 * evening, so anything that could not be confirmed is left out rather than
 * guessed at. Two things that were checked and deliberately excluded:
 *
 *   - Saber V3 does not exist. It is a fan concept; Saber stops at V2.
 *   - "Observation Haki V2" is now called Instinct V2 in game. Both names are
 *     kept so search finds it either way.
 * ---------------------------------------------------------------------------
 */

/** What kind of help this is. Named the way the game names things. */
export type ServiceKind =
  | "Raid" | "Trial" | "Puzzle" | "Boss" | "Unlock" | "Grind" | "Island";

export interface Service {
  id: string;
  gameSlug: string;
  name: string;
  kind: ServiceKind;
  /** The game's own requirement. Only stated where it was confirmed. */
  needs?: string;
  /**
   * Total players including the one being helped. Capped at 3 by the scope of
   * this tab — anything needing more is recruitment, not a service.
   */
  players?: number;
  /** What the person being helped walks away with. */
  gives?: string;
  /**
   * True where the entry is a category rather than one fixed thing, and the
   * poster fills in the specifics. Keeps one row from having to exist for every
   * boss in the game.
   */
  openEnded?: boolean;
  /** Other names people search for. */
  aliases?: readonly string[];
  verified?: boolean;
}

/**
 * Blox Fruits.
 *
 * Sourced from the wiki: the raid microchips and their level gate, the V4
 * trial's three races, the Cursed Dual Katana step that needs another player to
 * deal you damage, Yama's thirty Elite Hunter quests, Saber V2's player kill,
 * Instinct V2's prerequisites, and the island spawn conditions.
 */
const BLOX_FRUITS_SERVICES: Service[] = [
  // ---- Raids and awakening ----
  {
    id: "bf-s-basic-raid", gameSlug: "blox-fruits", name: "Fruit awakening raid carry",
    kind: "Raid",
    needs: "Level 1100+. Somebody needs a Basic Raid Microchip — 100,000 Beli, or any physical fruit, from the Mysterious Scientist",
    players: 2,
    gives: "Awakened moves and Fragments. Five islands, each harder than the last",
    aliases: ["awakening", "awaken", "raid carry", "fragments"], verified: true,
  },
  {
    id: "bf-s-advanced-raid", gameSlug: "blox-fruits", name: "Advanced raid — Phoenix or Dough",
    kind: "Raid",
    needs: "An Advanced Raid Microchip: 1,000 Robux, or a physical fruit worth over 1,000,000",
    players: 2,
    gives: "The only two Advanced Raids in the game",
    aliases: ["phoenix raid", "dough raid", "advanced"], verified: true,
  },
  {
    id: "bf-s-fragments", gameSlug: "blox-fruits", name: "Fragment farming",
    kind: "Grind",
    needs: "About 14,500 Fragments awakens most fruits",
    players: 2,
    aliases: ["frags"], verified: true,
  },

  // ---- Race awakening ----
  {
    id: "bf-s-v4", gameSlug: "blox-fruits", name: "Race V4 trial",
    kind: "Trial",
    needs: "Exactly 3 players of 3 different races, all activating V3 at the same moment",
    players: 3,
    gives: "Race V4",
    aliases: ["v4", "race v4", "race awakening"], verified: true,
  },
  {
    id: "bf-s-carnage", gameSlug: "blox-fruits", name: "Trial of Carnage (Ghoul)",
    kind: "Trial",
    needs: "Every wave of Ancient Zombies and Ancient Vampires down in under one minute. Two to four waves, five zombies each",
    players: 2,
    gives: "Ghoul race awakening",
    aliases: ["ghoul", "carnage"], verified: true,
  },
  {
    id: "bf-s-temple", gameSlug: "blox-fruits", name: "Temple of Time access",
    kind: "Unlock",
    needs: "The Blue Gear, then the Mysterious Force at the top of the Great Tree",
    players: 2,
    gives: "The Race Awakening trials",
    aliases: ["temple", "blue gear"], verified: true,
  },

  // ---- Puzzles and weapon unlocks ----
  {
    id: "bf-s-cdk", gameSlug: "blox-fruits", name: "Cursed Dual Katana puzzle",
    kind: "Puzzle",
    needs: "Level 2200+ and 350 mastery on both Yama and Tushita. One trial needs you to take 8,000–10,000 damage from another player while holding Yama — that is the part you need a helper for",
    players: 2,
    gives: "Cursed Dual Katana",
    aliases: ["cdk", "cursed dual katana", "alucard"], verified: true,
  },
  {
    id: "bf-s-yama", gameSlug: "blox-fruits", name: "Yama — Elite Hunter grind",
    kind: "Grind",
    needs: "Third Sea. 20 Elite Hunter quests for a chance at Yama, 30 to be guaranteed it",
    players: 2,
    gives: "Yama, and the Pretty Helmet at 5 Elite Pirates",
    aliases: ["yama", "elite", "elite pirates", "elite hunter"], verified: true,
  },
  {
    id: "bf-s-saber-v2", gameSlug: "blox-fruits", name: "Saber V2",
    kind: "Unlock",
    needs: "One million bounty or honour, and a kill on another player of similar level",
    players: 2,
    gives: "Saber V2",
    aliases: ["saber"], verified: true,
  },
  {
    // Naming one soloable boss was a mistake: Captain Elephant does not need a
    // second player, so a listing for it was noise. One open entry covers every
    // ordinary boss instead and the poster says which in their own words — this
    // list should not grow a row each time somebody finds a boss hard.
    id: "bf-s-boss-help", gameSlug: "blox-fruits", name: "Help beating a boss",
    kind: "Boss",
    needs: "Say which boss in your post — whichever one you are stuck on",
    players: 2,
    openEnded: true,
    aliases: ["boss", "carry", "boss carry", "captain elephant", "greybeard"],
    verified: true,
  },
  {
    id: "bf-s-hallow-scythe", gameSlug: "blox-fruits", name: "Hallow Scythe farming",
    kind: "Boss",
    needs: "A 5% drop from the Soul Reaper, so expect to go again",
    players: 2,
    gives: "Hallow Scythe",
    aliases: ["hallow scythe", "soul reaper", "scythe"], verified: true,
  },
  {
    id: "bf-s-shark-anchor", gameSlug: "blox-fruits", name: "Shark Anchor — Anchored Terrorshark",
    kind: "Boss",
    needs: "Only the player whose Monster Magnet was consumed can take the drop, so bring your own",
    players: 2,
    gives: "Shark Anchor",
    aliases: ["shark anchor", "terrorshark", "monster magnet"], verified: true,
  },

  // ---- Haki and styles ----
  {
    id: "bf-s-instinct-v2", gameSlug: "blox-fruits", name: "Instinct V2 (Observation V2)",
    kind: "Unlock",
    needs: "Level 1800+, 5,000 EXP on Instinct V1, and the Musketeer Hat from the Citizen's Quest. Then the Hungry Man quest",
    players: 2,
    gives: "Instinct V2",
    aliases: ["observation", "observation v2", "ken", "instinct"], verified: true,
  },
  {
    id: "bf-s-godhuman", gameSlug: "blox-fruits", name: "Godhuman mastery grind",
    kind: "Grind",
    needs: "400+ mastery on Death Step, Sharkman Karate and Electric Claw — each of which needs 400+ on its own base style first",
    players: 2,
    gives: "Godhuman",
    aliases: ["godhuman", "mastery"], verified: true,
  },
  {
    id: "bf-s-sanguine", gameSlug: "blox-fruits", name: "Sanguine Art unlock",
    kind: "Unlock",
    needs: "A Leviathan Heart handed to Shafi, then 5,000,000 Beli and 5,000 Fragments. The Leviathan itself needs a crew — that part belongs in Recruitment",
    players: 2,
    gives: "Sanguine Art",
    aliases: ["sanguine", "shafi"], verified: true,
  },

  // ---- Islands ----
  {
    id: "bf-s-kitsune-island", gameSlug: "blox-fruits", name: "Kitsune Island spawn help",
    kind: "Island",
    needs: "Sail into Sea Danger Level 6 in daytime and wait for the Full Moon, or sit at Level 5 and move up when it rises",
    players: 2,
    aliases: ["kitsune island", "full moon"], verified: true,
  },
  {
    id: "bf-s-mirage", gameSlug: "blox-fruits", name: "Mirage Island — Mirror Fractal",
    kind: "Island",
    needs: "Night-time only, since the Valentine's update — a full moon is no longer needed. Resonate the Mirror Fractal at the island's highest point",
    players: 2,
    gives: "The Blue Gear",
    aliases: ["mirage", "mirror fractal", "blue gear"], verified: true,
  },

  // ---- Boss carries ----
  {
    id: "bf-s-rip-indra", gameSlug: "blox-fruits", name: "Rip Indra (True Form)",
    kind: "Boss",
    needs: "Castle on the Sea, Third Sea. A step on the Race Awakening puzzle, which is why it is listed separately from the open boss entry",
    players: 3,
    aliases: ["indra", "rip indra"], verified: true,
  },
  {
    id: "bf-s-level", gameSlug: "blox-fruits", name: "Level grinding help",
    kind: "Grind",
    players: 2,
    aliases: ["level", "grind", "xp"], verified: true,
  },
  {
    id: "bf-s-bounty", gameSlug: "blox-fruits", name: "Bounty hunting partner",
    kind: "Grind",
    players: 2,
    aliases: ["bounty", "pvp"], verified: true,
  },
];

/**
 * The other five games. Short, and flagged as such — these grow through the
 * control panel rather than through code.
 */
const OTHER_SERVICES: Service[] = [
  { id: "gg-s-mutation", gameSlug: "grow-a-garden", name: "Mutation run help", kind: "Grind", players: 2 },
  { id: "gg-s-restock", gameSlug: "grow-a-garden", name: "Restock watch", kind: "Grind", players: 2 },
  { id: "gg-s-event-set", gameSlug: "grow-a-garden", name: "Finishing an event set", kind: "Unlock", players: 2 },

  { id: "am-s-task", gameSlug: "adopt-me", name: "Task help", kind: "Grind", players: 2 },
  { id: "am-s-neon", gameSlug: "adopt-me", name: "Neon making", kind: "Unlock",
    needs: "Four full-grown pets of the same kind", players: 2 },

  { id: "ps-s-hatch", gameSlug: "pet-simulator-99", name: "Hatching help", kind: "Grind", players: 2 },
  { id: "ps-s-carry", gameSlug: "pet-simulator-99", name: "Zone carry", kind: "Grind", players: 2 },

  { id: "rh-s-story", gameSlug: "royale-high", name: "Story help", kind: "Unlock", players: 2 },
  { id: "rh-s-diamond", gameSlug: "royale-high", name: "Diamond run", kind: "Grind", players: 2 },

  { id: "cs-s-growth", gameSlug: "creatures-of-sonaria", name: "Growth help", kind: "Grind", players: 2 },
  { id: "cs-s-hunt", gameSlug: "creatures-of-sonaria", name: "Group hunt", kind: "Grind", players: 3 },
];

export const SERVICES: readonly Service[] = [
  ...BLOX_FRUITS_SERVICES, ...OTHER_SERVICES,
];

export function servicesFor(gameSlug: string): readonly Service[] {
  return SERVICES.filter((s) => s.gameSlug === gameSlug);
}

export function findService(id: string): Service | undefined {
  return SERVICES.find((s) => s.id === id);
}

/** Games whose service list is knowingly short. Surfaced in the interface. */
export const PARTIAL_SERVICES: readonly string[] = [
  "adopt-me", "pet-simulator-99", "grow-a-garden", "royale-high", "creatures-of-sonaria",
];

/**
 * What a helper may ask in return.
 *
 * A closed list, and that is a safety decision rather than a modelling one. A
 * free-text box becomes a market for real money and for account access within a
 * week — both forbidden outright — and the cheapest way to enforce a rule is to
 * leave nowhere to type it.
 */
export type Terms =
  | { kind: "free" }
  | { kind: "split" }
  | { kind: "item"; itemId: string };

/**
 * Somebody who voted on a listing.
 *
 * A vote is not a like. It means "I want to be in on this", so a voter is a
 * candidate for the deal — which is why every voter carries a reply state.
 */
export interface Voter {
  /**
   * The profile id. Present on rows from the database; absent on generated
   * examples. Reporting needs it — usernames change, ids do not.
   */
  userId?: string;
  username: string;
  /** The Roblox avatar, once a real account is signed in. */
  avatarUrl?: string;
  online: boolean;
  /** Minutes since they voted, so the picker can show who is freshest. */
  votedMinutesAgo: number;
  /**
   * Where they stand once the poster has picked their team.
   *
   *   not-picked  voted, but the poster did not choose them
   *   waiting     picked, and the request is with them
   *   agreed      they said yes
   *   denied      they said no
   */
  reply: "not-picked" | "waiting" | "agreed" | "denied";
}

/**
 * A message under a listing.
 *
 * Deliberately spare: reply and report, nothing else. No likes, because a like
 * on "I'm ready, add me" means nothing and a popularity contest is not what
 * this thread is for. Only people who have voted can write here — it is a room
 * for the people actually doing the thing, not a comment section.
 */
export interface ListingComment {
  id: string;
  author: string;
  avatarUrl?: string;
  online: boolean;
  text: string;
  minutesAgo: number;
  /** The comment this answers, for a one-level thread. */
  replyTo?: string;
}

/**
 * How far along the deal is.
 *
 *   voting     open, collecting people who want in
 *   requested  the poster picked a team and asked them; replies are coming back
 *   locked     the poster locked it in. The listing closes to new votes and
 *              shows who is going
 *
 * There is no state after locked. The listing simply stops existing when its
 * two hours are up, whatever happened.
 */
export type DealStage = "voting" | "requested" | "locked";

/**
 * The most people one deal can involve.
 *
 * The board is for help that takes one or two others, so a team of eighteen is
 * far past what any listing here needs — it is a ceiling to stop a runaway
 * selection, not a target.
 */
export const MAX_TEAM = 18;

export type ListingSide = "offer" | "request";

export interface ServiceListing {
  /**
   * True only for generated example content, which the interface badges. A row
   * that came from the database leaves this off — mislabelling a real listing
   * as an example would be as bad as the reverse.
   */
  isDemo?: boolean;
  id: string;
  gameSlug: string;
  side: ListingSide;
  author: string;
  authorAvatarUrl?: string;
  authorOnline: boolean;
  /** Completed helps on MintPlaza. Zero for a new account. */
  completed: number;
  /**
   * An offer can carry many services — a helper lists everything they can run.
   * A request carries the one thing they are stuck on.
   */
  serviceIds: readonly string[];
  terms: Terms;
  note?: string;
  /** Minutes since posting. Drives the two-hour window. */
  postedMinutesAgo: number;
  /** Set once somebody's offer is taken, which closes the listing early. */
  taken: boolean;
  /**
   * A handful of voters, for the faces. Never the whole list: a popular listing
   * can have hundreds, and sending hundreds of records to draw three circles
   * would be absurd. The stack shows these and counts the rest.
   */
  voters: readonly Voter[];
  /** Everyone who voted, including the ones not sent. */
  voteCount: number;
  /** How many of them are on MintPlaza right now. */
  votersOnline: number;
  /** What the poster wrote about what they need. */
  detail?: string;
  stage: DealStage;
  comments: readonly ListingComment[];
  /** Whether the person reading this has voted. Gates the thread. */
  youVoted: boolean;
  /** Whether the person reading this posted it. */
  yours: boolean;
}

/** Everyone the poster picked, whatever they have replied. */
export function pickedVoters(l: ServiceListing): readonly Voter[] {
  return l.voters.filter((v) => v.reply !== "not-picked");
}

/** Everyone who said yes. One is enough to lock a deal in. */
export function agreedVoters(l: ServiceListing): readonly Voter[] {
  return l.voters.filter((v) => v.reply === "agreed");
}

/**
 * Can the poster lock this in?
 *
 * One yes is enough. Waiting for everyone would leave a deal hostage to the one
 * person who wandered off, and the people who did say yes are sitting there
 * ready to go.
 */
export function canLockIn(l: ServiceListing): boolean {
  return l.stage === "requested" && agreedVoters(l).length > 0;
}

/**
 * A listing lives two hours. Not two hours of visibility and then an archive —
 * two hours, then it is gone from the database entirely, locked deals included.
 * Nobody benefits from a record of who helped whom last Tuesday, and not
 * keeping it is the simplest way to never leak it.
 */
export const LIVE_WINDOW_MINUTES = 120;

export function minutesLeft(l: ServiceListing): number {
  return Math.max(0, LIVE_WINDOW_MINUTES - l.postedMinutesAgo);
}

export function listingState(l: ServiceListing): "live" | "taken" | "expired" {
  if (l.taken) return "taken";
  return minutesLeft(l) > 0 ? "live" : "expired";
}

/**
 * "1h 12m", the way a countdown should read at a glance.
 *
 * Deliberately without the word "left": on a 390px row that word costs about
 * thirty pixels, and thirty pixels is the difference between reading
 * "Fruit awakening raid carry" and reading "Fruit awakening raid …".
 */
export function timeLeftCopy(l: ServiceListing): string {
  const m = minutesLeft(l);
  if (m <= 0) return "Expired";
  if (m < 60) return `${m}m`;
  const h = Math.floor(m / 60);
  return `${h}h ${m % 60}m`;
}

/**
 * When this listing expires, as a timestamp the browser can count down from.
 * Derived from the posting age so the server and the client agree.
 */
export function expiresAt(l: ServiceListing, now = Date.now()): number {
  return now + minutesLeft(l) * 60_000;
}
