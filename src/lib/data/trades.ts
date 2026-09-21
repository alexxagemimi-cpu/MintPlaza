import { serverSupabase } from "@/lib/supabase/server";
import { FREE_WINDOW_HOURS } from "@/lib/level-up";
import { readInventory } from "@/lib/actions/inventory";
import { holdingsOf, type InventoryRow } from "@/lib/inventory";
import {
  suggestTrades,
  toBoardListing,
  type BoardListing,
  type ListingRow,
  type TradeSuggestion,
} from "@/lib/match";

/**
 * Reading the trade board.
 *
 * Every read goes through one of four database functions that return the same
 * row shape, so this file has one mapper and the four surfaces — the board, the
 * suggestions, a person's profile, your own listings — cannot drift apart.
 *
 * Nothing in here throws. A site with no database configured still renders the
 * whole of the interface with empty boards, which is what makes the screens
 * reviewable before Supabase is connected, and a read failure in production
 * degrades to "nothing here yet" rather than a crash on the tab a player uses
 * most.
 */

async function rpc(name: string, args: Record<string, unknown>): Promise<BoardListing[]> {
  const supabase = await serverSupabase();
  if (!supabase) return [];

  const { data, error } = await supabase.rpc(name, args);
  if (error || !data) return [];

  return (data as ListingRow[]).map(toBoardListing);
}

/**
 * The public board for one game, newest bump first.
 *
 * `before` is a bump timestamp from the last row of the previous page, which
 * is how the board pages without an offset. An offset would skip or repeat
 * rows every time somebody bumped a listing between two page loads — and on a
 * board ordered by exactly that, somebody does.
 */
export async function readTradeBoard(
  gameSlug: string,
  limit = 30,
  before?: string,
): Promise<BoardListing[]> {
  // Only a real timestamp is passed on. The value arrives from the query
  // string, so it is a stranger's input reaching an RPC argument: a bad one
  // becomes no cursor, never an error page on the busiest tab of the site.
  const cursor = before && !Number.isNaN(Date.parse(before)) ? before : null;
  return rpc("trade_feed", { p_game: gameSlug, p_limit: limit, p_cursor: cursor });
}

/** Your own active listings. */
export async function readMyListings(gameSlug: string): Promise<BoardListing[]> {
  return rpc("my_trade_listings", { p_game: gameSlug });
}

/** One person's active listings, for their profile. */
export async function readListingsOf(
  userId: string,
  gameSlug: string,
): Promise<BoardListing[]> {
  return rpc("trade_listings_of", { p_user: userId, p_game: gameSlug });
}

export interface Suggestions {
  /** Ranked, best fit first. */
  trades: TradeSuggestion[];
  /** Your lists, so a caller can render the empty states without re-reading. */
  inventory: InventoryRow[];
  haveCount: number;
  wantCount: number;
}

/**
 * The suggested trades for the signed-in player, in one game.
 *
 * Two reads and then pure computation: the candidate listings the prefilter
 * judged worth loading, and the player's own lists. The ranking itself is
 * suggestTrades(), which is pure and holds the values — see match.ts for why
 * that half cannot live in SQL.
 *
 * Signed out, or with nothing on either list, this returns nothing rather than
 * falling back to "here is the newest thing on the board". A suggestion means
 * "this fits you", and a site that quietly relabels recent listings as
 * suggestions is lying in the one place it promised not to.
 */
export async function readSuggestions(
  gameSlug: string,
  limit = 25,
): Promise<Suggestions> {
  const inventory = await readInventory(gameSlug);
  const have = holdingsOf(inventory, "have");
  const want = holdingsOf(inventory, "want");

  const empty: Suggestions = {
    trades: [],
    inventory,
    haveCount: have.length,
    wantCount: want.length,
  };
  if (have.length === 0 && want.length === 0) return empty;

  const candidates = await rpc("trade_match_candidates", {
    p_game: gameSlug,
    p_limit: 200,
  });
  if (candidates.length === 0) return empty;

  return { ...empty, trades: suggestTrades(candidates, have, want).slice(0, limit) };
}

export interface Allowance {
  used: number;
  remaining: number;
  nextSlotAt: string | null;
  activeInGame: number;
  activeCap: number;
  /**
   * The window this player is actually on, in hours — 24 free, 12 with Level
   * Up. Read rather than assumed for the same reason `used` is: the page used
   * to write the window as a constant, and a constant cannot know that the
   * person reading it pays for a shorter one.
   */
  windowHours: number;
}

/**
 * How many listings you may still post.
 *
 * Read rather than assumed. The dashboard used to draw this meter from a
 * hardcoded zero, so it told everybody all three slots were free however many
 * they had just used — the one number on the screen a player would plan around,
 * and it was never true.
 */
export async function readAllowance(gameSlug: string): Promise<Allowance | null> {
  const supabase = await serverSupabase();
  if (!supabase) return null;

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;

  const { data, error } = await supabase
    .rpc("listing_allowance", { p_game: gameSlug })
    .maybeSingle();

  if (error || !data) return null;

  const row = data as {
    used: number; remaining: number; next_slot_at: string | null;
    active_in_game: number; active_cap: number; window_hours: number | null;
  };
  return {
    used: row.used,
    remaining: row.remaining,
    nextSlotAt: row.next_slot_at,
    activeInGame: row.active_in_game,
    activeCap: row.active_cap,
    // Falls back to the free window only where the column is missing, which
    // means the database is older than this build. Quoting the free number to
    // somebody who pays is a smaller wrong than quoting a paid one to somebody
    // who does not.
    windowHours: row.window_hours ?? FREE_WINDOW_HOURS,
  };
}
