/**
 * The matcher.
 *
 * This is the thing MintPlaza is for. Everything else — the catalogue, the
 * values, the rarity ladder, the variant model — exists so that this file can
 * answer one question honestly: given what I hold and what I am after, which
 * of the trades currently on the board should I look at, and in what order.
 *
 * ---------------------------------------------------------------------------
 * Why the ranking is not in SQL
 * ---------------------------------------------------------------------------
 * The obvious place for matching is a Postgres function, and the first version
 * of this system put it there. It could not work. A useful ranking has to know
 * what things are worth, values live in values.ts, and the only way SQL could
 * read them is if they were copied into the database — which would give the
 * site two sources of truth for the one number players actually argue about,
 * and guarantee they disagree.
 *
 * So the work is split along the line where each side is strong:
 *
 *   SQL narrows.  trade_match_candidates() uses the (item_id, side) index to
 *                 return only listings that touch your lists at all. That is a
 *                 cheap, indexed set intersection and it throws away most of
 *                 the board.
 *   TypeScript ranks.  This file, with the whole catalogue and value table in
 *                 memory, decides what those candidates are worth to you.
 *
 * The prefilter deliberately returns far more rows than are shown. Ranking
 * reorders heavily, so narrowing to twenty by recency and then sorting by fit
 * would mostly be sorting noise, and the one reciprocal match posted yesterday
 * would never be in the window to be found.
 *
 * ---------------------------------------------------------------------------
 * What a suggestion is
 * ---------------------------------------------------------------------------
 * Not "here is a listing that is 72% relevant". A suggestion names the actual
 * deal: everything you would hand over, everything you would receive, and
 * whether you can close it today or are short an item. A trader can act on
 * that without opening anything.
 *
 * Two details in here are easy to get wrong and matter a great deal:
 *
 *   1. You give their ENTIRE want side and receive their ENTIRE offer side.
 *      The intersection with your lists is why the listing surfaced; it is not
 *      what changes hands. If they offer a Dragon and a Leopard for a Kitsune
 *      and you only asked for the Dragon, you still get the Leopard, and the
 *      suggestion has to say so or it is flattering the deal.
 *
 *   2. Nothing here ranks on value, because MintPlaza does not keep values —
 *      see referrals.ts. It ranks on the things a trading board actually
 *      knows and that never go stale: whether they hold what you asked for,
 *      whether you hold what they asked for, how scarce the item on the table
 *      is, whether they are online, and how fresh the listing is. Whether the
 *      trade is a win is the player's call, with their game's own calculator
 *      one tap away on the listing.
 */

import { findItem, type CatalogItem, type Rarity } from "./items";
import type { ListingItem } from "./trade";

/* ------------------------------------------------------------------ */
/* Shapes                                                              */
/* ------------------------------------------------------------------ */

/** One side-entry of a listing, as the database hands it over. */
export interface RawSide {
  side: "offer" | "want";
  itemId: string | null;
  customName: string | null;
  quantity: number;
  attributes: { variant?: string } | null;
}

/** A listing from trade_feed / trade_match_candidates / trade_listings_of. */
export interface BoardListing {
  id: string;
  gameSlug: string;
  userId: string;
  username: string;
  displayName: string | null;
  avatarUrl: string | null;
  online: boolean;
  deals: number;
  note: string | null;
  createdAt: string;
  bumpedAt: string;
  expiresAt: string;
  bumpable: boolean;
  /**
   * How many people have put their hand up, and whether you are one of them.
   *
   * The services board has always had this. Trades did not, so the card showed
   * a Message button and nothing else — a listing with eleven interested
   * players looked exactly like one nobody had touched, and every conversation
   * happened in private where it told the board nothing.
   */
  voteCount: number;
  youVoted: boolean;
  offering: ListingItem[];
  wanting: ListingItem[];
  /**
   * Names from either side that are not in the catalogue.
   *
   * Kept rather than dropped. A listing whose items partly failed to resolve
   * still has to render every line, or a player reads a three-item offer as a
   * two-item one and the deal they agree to is not the deal on screen.
   */
  unresolved: string[];
}

/** One entry on your have or want list. */
export interface InventoryHolding {
  itemId: string;
  variant?: string;
  quantity: number;
}

export type ReasonCode =
  | "RECIPROCAL_MATCH"
  | "PARTIAL_MATCH"
  | "HAS_WHAT_YOU_WANT"
  | "WANTS_WHAT_YOU_HAVE"
  | "OPEN_TO_OFFERS";

/**
 * One reason the score is what it is.
 *
 * Every component that moves a score emits one of these, and the interface can
 * show them. A ranking a player cannot interrogate is a ranking they will stop
 * trusting the first time it puts something odd at the top — and on a site
 * whose entire pitch is that it does not invent numbers, an unexplainable one
 * would be the loudest thing on the page.
 */
export interface MatchFactor {
  label: string;
  /** Points added. Negative for the ones that push a suggestion down. */
  points: number;
}

export interface TradeSuggestion {
  listing: BoardListing;
  reason: ReasonCode;
  /** Everything you hand over: their entire want side. */
  youGive: ListingItem[];
  /** Everything you receive: their entire offer side. */
  youGet: ListingItem[];
  /** Items on their offer that are on your want list. Why this surfaced. */
  wantedHits: ListingItem[];
  /** Items they want that you already hold, at the quantity they asked for. */
  haveHits: ListingItem[];
  /** Items they want that you cannot cover. Empty means you can close today. */
  missing: ListingItem[];
  /** True when nothing is missing and there is something to hand over. */
  canClose: boolean;
  /** 0–100. Only meaningful as an ordering, never shown as a percentage. */
  score: number;
  factors: MatchFactor[];
}

/* ------------------------------------------------------------------ */
/* Reading the database shape                                          */
/* ------------------------------------------------------------------ */

/** The row shape of mintplaza.listing_row, as PostgREST returns it. */
export interface ListingRow {
  listing_id: string;
  game_slug: string;
  user_id: string;
  username: string;
  display_name: string | null;
  avatar_url: string | null;
  online: boolean | null;
  deals: number | null;
  note: string | null;
  created_at: string;
  bumped_at: string;
  expires_at: string;
  bumpable: boolean | null;
  sides: RawSide[] | null;
  vote_count: number | null;
  you_voted: boolean | null;
}

export function toBoardListing(row: ListingRow): BoardListing {
  const offering: ListingItem[] = [];
  const wanting: ListingItem[] = [];
  const unresolved: string[] = [];

  for (const s of row.sides ?? []) {
    const item = s.itemId ? findItem(s.itemId) : undefined;
    if (!item) {
      unresolved.push(s.customName ?? s.itemId ?? "Unknown item");
      continue;
    }
    const entry: ListingItem = {
      item,
      variant: s.attributes?.variant,
      quantity: Math.max(1, s.quantity || 1),
    };
    (s.side === "offer" ? offering : wanting).push(entry);
  }

  return {
    id: row.listing_id,
    gameSlug: row.game_slug,
    userId: row.user_id,
    username: row.username,
    displayName: row.display_name,
    avatarUrl: row.avatar_url,
    online: row.online ?? false,
    deals: row.deals ?? 0,
    note: row.note,
    createdAt: row.created_at,
    bumpedAt: row.bumped_at,
    expiresAt: row.expires_at,
    bumpable: row.bumpable ?? false,
    voteCount: row.vote_count ?? 0,
    youVoted: row.you_voted ?? false,
    offering,
    wanting,
    unresolved,
  };
}

/* ------------------------------------------------------------------ */
/* Matching one side against a list                                    */
/* ------------------------------------------------------------------ */

/**
 * Total quantity held of an item, optionally of one specific variant.
 *
 * The asymmetry here is deliberate and is the whole of the variant rule. A
 * listing that asks for a "Midnight" rod is asking for that one; a plain rod
 * does not satisfy it. A listing that asks for a rod without naming a variant
 * is happy with any of them, so every variant you hold counts toward it.
 *
 * Getting this backwards in either direction is expensive: strict-when-it-
 * should-be-loose hides trades you could do, and loose-when-it-should-be-strict
 * tells you that you can close a deal you cannot, which is worse — you find out
 * in a DM with somebody who now thinks you wasted their time.
 */
function heldQuantity(
  holdings: readonly InventoryHolding[],
  itemId: string,
  variant: string | undefined,
): number {
  return holdings
    .filter((h) => h.itemId === itemId && (variant === undefined || h.variant === variant))
    .reduce((n, h) => n + Math.max(1, h.quantity || 1), 0);
}

function wants(holdings: readonly InventoryHolding[], itemId: string): boolean {
  return holdings.some((h) => h.itemId === itemId);
}

/* ------------------------------------------------------------------ */
/* Scoring                                                             */
/* ------------------------------------------------------------------ */

/**
 * Where each class of match starts before anything else is weighed.
 *
 * The ordering is a claim about what closes. A reciprocal match — they have
 * what you are after and you already hold what they are asking for — is the
 * only kind that can be agreed in one message, so it starts far enough ahead
 * that nothing below can overtake it on flourishes. A listing that only wants
 * something of yours starts lowest, because acting on it means offering into
 * somebody else's judgement rather than answering an ask.
 */
const BASE: Record<ReasonCode, number> = {
  RECIPROCAL_MATCH: 50,
  PARTIAL_MATCH: 30,
  HAS_WHAT_YOU_WANT: 22,
  OPEN_TO_OFFERS: 18,
  WANTS_WHAT_YOU_HAVE: 14,
};

const RARITY_POINTS: Record<Rarity, number> = {
  Common: 0,
  Uncommon: 1,
  Rare: 3,
  "Ultra-Rare": 5,
  Legendary: 7,
  Mythical: 10,
  Premium: 7,
};

const DAY = 86_400_000;

function topRarity(entries: readonly ListingItem[]): { points: number; item?: CatalogItem } {
  let best = 0;
  let which: CatalogItem | undefined;
  for (const e of entries) {
    const p = e.item.rarity ? RARITY_POINTS[e.item.rarity] : 0;
    if (p > best) {
      best = p;
      which = e.item;
    }
  }
  return { points: best, item: which };
}

/* ------------------------------------------------------------------ */
/* The engine                                                          */
/* ------------------------------------------------------------------ */

export interface MatchOptions {
  /** Now, injectable so the proof script can test ageing deterministically. */
  now?: number;
  /**
   * Drop suggestions below this score. Zero keeps everything the prefilter
   * returned, which is what the Suggested tab wants — the prefilter has
   * already established that every candidate touches your lists somewhere.
   */
  minScore?: number;
}

/**
 * Rank one board against one player's lists.
 *
 * Pure. No database, no clock beyond what is passed in, no ordering that
 * depends on the order rows arrived in. That last one is what makes the result
 * stable: two loads of the same board produce the same list, so a suggestion
 * does not move under somebody's thumb between looking and tapping.
 */
export function suggestTrades(
  listings: readonly BoardListing[],
  myHave: readonly InventoryHolding[],
  myWant: readonly InventoryHolding[],
  options: MatchOptions = {},
): TradeSuggestion[] {
  const now = options.now ?? Date.now();
  const minScore = options.minScore ?? 0;
  const out: TradeSuggestion[] = [];

  for (const listing of listings) {
    const youGet = listing.offering;
    const youGive = listing.wanting;

    // What made this surface, from each direction.
    const wantedHits = youGet.filter((e) => wants(myWant, e.item.id));

    const haveHits: ListingItem[] = [];
    const missing: ListingItem[] = [];
    for (const e of youGive) {
      const held = heldQuantity(myHave, e.item.id, e.variant);
      if (held >= e.quantity) haveHits.push(e);
      else missing.push(e);
    }

    // A listing with an entry the catalogue could not resolve is not a listing
    // this function has read in full, and "open to offers" means they named
    // nothing — not that everything they named failed to load. Getting this
    // wrong would turn a listing asking for three items into an invitation to
    // send whatever you like.
    const openToOffers = youGive.length === 0 && listing.unresolved.length === 0;

    // And it can never be closed today, whatever the resolved half says. The
    // loop above compared your have list against the entries it could see; an
    // unresolved entry is one it could not, so `missing.length === 0` means
    // "nothing I could check is missing", which is not the same claim.
    // RECIPROCAL_MATCH reads "you can close this today" on the card, and that
    // is the one sentence on the dashboard a player acts on without rechecking.
    const canClose =
      !openToOffers && missing.length === 0 && listing.unresolved.length === 0;

    // Nothing on either list. The prefilter should not have returned this, but
    // this function is also run over the plain board, where it will.
    if (wantedHits.length === 0 && haveHits.length === 0) continue;

    const reason: ReasonCode = openToOffers
      ? "OPEN_TO_OFFERS"
      : wantedHits.length > 0 && canClose
        ? "RECIPROCAL_MATCH"
        : wantedHits.length > 0 && haveHits.length > 0
          ? "PARTIAL_MATCH"
          : wantedHits.length > 0
            ? "HAS_WHAT_YOU_WANT"
            : "WANTS_WHAT_YOU_HAVE";

    const factors: MatchFactor[] = [
      { label: REASON_LABEL[reason], points: BASE[reason] },
    ];

    if (wantedHits.length > 0) {
      const points = Math.min(wantedHits.length * 4, 12);
      factors.push({
        label:
          wantedHits.length === 1
            ? `Has ${wantedHits[0].item.name}, on your want list`
            : `Has ${wantedHits.length} things on your want list`,
        points,
      });
    }

    // Scarcity, read off what you would receive. Lining up on a Common is
    // something any two players can do by accident; lining up on a Mythical is
    // the reason somebody opened the site.
    const rarity = topRarity(wantedHits.length > 0 ? wantedHits : youGet);
    if (rarity.points > 0 && rarity.item) {
      factors.push({
        label: `${rarity.item.rarity} on the table`,
        points: rarity.points,
      });
    }
    if (missing.length > 0) {
      factors.push({
        label:
          missing.length === 1
            ? `You do not have ${missing[0].item.name} yet`
            : `Short ${missing.length} of the items they asked for`,
        points: -Math.min(missing.length * 3, 12),
      });
    }

    if (listing.online) factors.push({ label: "Online now", points: 6 });

    const ageDays = (now - new Date(listing.bumpedAt).getTime()) / DAY;
    if (ageDays <= 1) factors.push({ label: "Posted today", points: 3 });
    else if (ageDays >= 5) factors.push({ label: "Going stale", points: -3 });

    if (listing.deals > 0) {
      factors.push({
        label: `${listing.deals} completed ${listing.deals === 1 ? "deal" : "deals"}`,
        points: Math.min(Math.round(listing.deals * 0.5), 5),
      });
    }

    const score = Math.max(
      0,
      Math.min(100, factors.reduce((n, f) => n + f.points, 0)),
    );
    if (score < minScore) continue;

    out.push({
      listing,
      reason,
      youGive,
      youGet,
      wantedHits,
      haveHits,
      missing,
      canClose,
      score,
      factors,
    });
  }

  // Score first. Ties break on what a player would break them on themselves:
  // a deal they can close now, then the fresher one, then the id — so the
  // ordering is total and two identical loads cannot disagree.
  return out.sort(
    (a, b) =>
      b.score - a.score ||
      Number(b.canClose) - Number(a.canClose) ||
      new Date(b.listing.bumpedAt).getTime() - new Date(a.listing.bumpedAt).getTime() ||
      a.listing.id.localeCompare(b.listing.id),
  );
}

export const REASON_LABEL: Record<ReasonCode, string> = {
  RECIPROCAL_MATCH: "You can close this today",
  PARTIAL_MATCH: "Part of what they are asking for",
  HAS_WHAT_YOU_WANT: "Has something you want",
  WANTS_WHAT_YOU_HAVE: "Wants something you have",
  OPEN_TO_OFFERS: "Open to offers",
};

export const REASON_BLURB: Record<ReasonCode, string> = {
  RECIPROCAL_MATCH:
    "They have something on your want list and you already hold everything they asked for.",
  PARTIAL_MATCH:
    "They have something you want, and you hold some of what they asked for.",
  HAS_WHAT_YOU_WANT:
    "They are offering something on your want list, but asking for things you do not have.",
  WANTS_WHAT_YOU_HAVE:
    "They are asking for something you hold. Nothing they offer is on your want list.",
  OPEN_TO_OFFERS: "They have not named a price, and they hold something you want.",
};


/* ------------------------------------------------------------------ */
/* Rendering                                                           */
/* ------------------------------------------------------------------ */

/**
 * What the listing card draws.
 *
 * Structural on purpose. A real listing off the board and a generated example
 * are different records with different provenance, and the one thing that must
 * never happen is a card that cannot tell them apart — so `isDemo` is on the
 * shape itself rather than inferred, and the badge is driven by it. Everything
 * else the card needs is common to both, which is why one component can draw
 * either without knowing which it has.
 */
export interface CardListing {
  id: string;
  gameSlug: string;
  username: string;
  /** Completed deals on MintPlaza. Zero for a new account. */
  trades: number;
  offering: ListingItem[];
  wanting: ListingItem[];
  note?: string;
  postedHoursAgo: number;
  /**
   * Names on the listing that the catalogue could not resolve.
   *
   * toBoardListing has always collected these, and until now nothing rendered
   * them — so a listing with an item the registry no longer carries drew as a
   * two-item offer when it was a three-item offer, silently. On a site whose
   * whole job is two people agreeing on what changes hands, a card showing
   * fewer items than the listing holds is the most expensive bug available:
   * both sides read the same screen and agree to different trades.
   *
   * They cannot be drawn as tiles — there is no item to draw — so they are
   * named, and the card says plainly that it cannot show them properly.
   */
  unresolved?: string[];
  /**
   * Why this listing is in front of this player — and absent when it is not
   * in front of them for any reason at all.
   *
   * Every reason code is a statement about the viewer: they hold this, they
   * asked for that. On the public board there is no such statement to make.
   * The rows there are simply what is live, in bump order, and they are shown
   * to signed-out visitors who have no lists for a reason to be computed
   * against. Defaulting to OPEN_TO_OFFERS would put "they hold something you
   * want" under a card belonging to somebody who wants nothing, which is the
   * one thing this site does not do. So the line is drawn or it is not.
   */
  reason?: ReasonCode;
  /** Absent or false on anything real. Only the generator sets it. */
  isDemo?: boolean;
  /** How many have put their hand up, and whether the viewer is one of them. */
  voteCount?: number;
  youVoted?: boolean;
}

/**
 * A listing off the public board, with no claim about the viewer attached.
 *
 * The same card as a suggestion, minus the one thing the board cannot know.
 */
export function toBoardCard(
  listing: BoardListing,
  now: number = Date.now(),
): CardListing {
  // Built from toCardListing so the two can never drift: one mapper decides
  // what a card is made of, and this one drops the single field it may not
  // assert. Destructured rather than deleted, so adding a field to CardListing
  // brings it here automatically.
  const { reason: _omitted, ...card } = toCardListing(listing, "OPEN_TO_OFFERS", now);
  void _omitted;
  return card;
}

export function toCardListing(
  listing: BoardListing,
  reason: ReasonCode,
  now: number = Date.now(),
): CardListing {
  return {
    id: listing.id,
    gameSlug: listing.gameSlug,
    username: listing.username,
    trades: listing.deals,
    offering: listing.offering,
    wanting: listing.wanting,
    note: listing.note ?? undefined,
    postedHoursAgo: Math.max(
      0,
      Math.floor((now - new Date(listing.bumpedAt).getTime()) / 3_600_000),
    ),
    unresolved: listing.unresolved.length > 0 ? listing.unresolved : undefined,
    voteCount: listing.voteCount,
    youVoted: listing.youVoted,
    reason,
  };
}
