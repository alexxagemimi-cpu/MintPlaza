"use server";

import { revalidatePath } from "next/cache";
import { serverSupabase } from "@/lib/supabase/server";
import { findItem, variantAxesFor } from "@/lib/items";

/**
 * Posting, cancelling and bumping trade listings.
 *
 * The database owns every rule that matters here. The three-per-three-hours
 * window and the per-game active cap are enforced by a trigger, not by this
 * file, and posting is one RPC rather than an insert plus a loop of inserts —
 * because two round trips leave a listing with no items on the board every time
 * the second one fails, and the board has no way to draw that except as an
 * empty card.
 *
 * What this file does own is refusing to send nonsense: an item that is not in
 * the catalogue, a variant the game does not have, a side with nothing on it.
 * Those are cheaper to reject here, with a sentence a player can act on, than
 * to let Postgres reject with a constraint name.
 */

export type ActionResult<T = void> =
  | { ok: true; value: T }
  | { ok: false; error: string };

export interface DraftSide {
  itemId: string;
  variant?: string;
  quantity?: number;
}

const MAX_PER_SIDE = 12;

function clean(
  gameSlug: string,
  entries: readonly DraftSide[],
): { rows: object[] } | { error: string } {
  const axes = variantAxesFor(gameSlug);
  const rows: object[] = [];
  const seen = new Set<string>();

  for (const e of entries) {
    const item = findItem(e.itemId);
    if (!item || item.gameSlug !== gameSlug) {
      return { error: "One of those items is not in this game's catalogue." };
    }
    if (item.tradeable === false) {
      return { error: `${item.name} cannot be traded in-game.` };
    }

    const variant = e.variant?.trim() || undefined;
    if (variant && !axes.some((a) => a.options.includes(variant))) {
      return { error: `${item.name} has no "${variant}" variant.` };
    }

    // The same item twice on one side is always a mistake — either a double tap
    // or a quantity somebody meant to set. Merging silently would change the
    // deal without saying so, so it is refused.
    const key = `${item.id}::${variant ?? ""}`;
    if (seen.has(key)) {
      return { error: `${item.name} is on that side twice.` };
    }
    seen.add(key);

    rows.push({
      itemId: item.id,
      quantity: Math.max(1, Math.min(9999, Math.floor(e.quantity ?? 1))),
      attributes: variant ? { variant } : {},
    });
  }

  return { rows };
}

/**
 * Turn a Postgres error into something worth reading.
 *
 * The listing-limit trigger raises P0001 with a message written to be shown to
 * a player as it is ("All 3 listing slots are in use for this window."), so
 * that one passes through. Anything else is a fault on our side and says so
 * rather than leaking a constraint name to somebody who cannot act on it.
 */
function readable(error: { code?: string; message: string }): string {
  if (error.code === "P0001") return error.message;
  if (error.code === "23505") return "You have already posted that listing.";
  return "That did not save. Try again in a moment.";
}

export async function postTradeListing(
  gameSlug: string,
  offering: readonly DraftSide[],
  wanting: readonly DraftSide[],
  note?: string,
): Promise<ActionResult<string>> {
  const supabase = await serverSupabase();
  if (!supabase) return { ok: false, error: "Not connected to the database." };

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "Sign in first." };

  if (offering.length === 0) {
    return { ok: false, error: "A listing has to offer something." };
  }
  if (offering.length > MAX_PER_SIDE || wanting.length > MAX_PER_SIDE) {
    return { ok: false, error: `${MAX_PER_SIDE} items a side is the most a listing can carry.` };
  }

  const offer = clean(gameSlug, offering);
  if ("error" in offer) return { ok: false, error: offer.error };
  const want = clean(gameSlug, wanting);
  if ("error" in want) return { ok: false, error: want.error };

  const { data, error } = await supabase.rpc("post_trade_listing", {
    p_game: gameSlug,
    p_offer: offer.rows,
    p_want: want.rows,
    p_note: note?.trim() || null,
  });

  if (error) return { ok: false, error: readable(error) };

  revalidatePath(`/app/${gameSlug}/trades`);
  revalidatePath(`/app/${gameSlug}`);
  return { ok: true, value: data as string };
}

export async function cancelTradeListing(
  gameSlug: string,
  listingId: string,
): Promise<ActionResult> {
  const supabase = await serverSupabase();
  if (!supabase) return { ok: false, error: "Not connected to the database." };

  const { error } = await supabase.rpc("cancel_trade_listing", { p_listing: listingId });
  if (error) return { ok: false, error: readable(error) };

  revalidatePath(`/app/${gameSlug}/trades`);
  revalidatePath(`/app/${gameSlug}`);
  return { ok: true, value: undefined };
}

/** One free lift a day, so nobody has to repost to stay visible. */
export async function bumpTradeListing(
  gameSlug: string,
  listingId: string,
): Promise<ActionResult> {
  const supabase = await serverSupabase();
  if (!supabase) return { ok: false, error: "Not connected to the database." };

  const { error } = await supabase.rpc("bump_listing", { p_listing: listingId });
  if (error) return { ok: false, error: readable(error) };

  revalidatePath(`/app/${gameSlug}/trades`);
  return { ok: true, value: undefined };
}
