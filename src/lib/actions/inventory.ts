"use server";

import { revalidatePath } from "next/cache";
import { serverSupabase } from "@/lib/supabase/server";
import { findItem, isKnownVariant } from "@/lib/items";
import type { InventoryRow } from "@/lib/inventory";

/**
 * Inventory writes.
 *
 * Server actions rather than client-side inserts, so the session comes from an
 * httpOnly cookie the browser cannot script. Row-level security is still the
 * real boundary — `inventory_own` restricts every row to its owner — so even a
 * forged user_id here would be rejected by the database.
 *
 * ---------------------------------------------------------------------------
 * On item_id
 * ---------------------------------------------------------------------------
 * It holds a catalogue slug ('gag2-cosmetic-bookcase'), not a uuid. It used to
 * be `uuid references game_items(id)` and that combination could never work:
 * game_items is an override layer the admin Studio writes to and nothing
 * seeds, so getCatalog() falls back to the compiled-in catalogue, whose ids
 * are slugs — and every insert pushed a slug into a uuid column and came back
 * 22P02. Inventory had never once saved a row. See the schema section
 * "Item trading (September 2026)".
 */

export type ActionResult = { ok: true } | { ok: false; error: string };

/** Quantities a player can plausibly hold. Beyond this it is a typo. */
const MAX_QUANTITY = 9999;

export async function addInventoryItem(
  gameSlug: string,
  itemId: string,
  kind: "have" | "want",
  opts: { variant?: string; quantity?: number } = {},
): Promise<ActionResult> {
  const supabase = await serverSupabase();
  if (!supabase) return { ok: false, error: "Not connected to the database." };

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "Sign in first." };

  if (kind !== "have" && kind !== "want") {
    return { ok: false, error: "Unknown list." };
  }

  // The catalogue is the authority on what exists. Checking here rather than
  // trusting the client means a crafted request cannot put a row in somebody's
  // inventory that no screen can ever render or remove.
  const item = findItem(itemId);
  if (!item || item.gameSlug !== gameSlug) {
    return { ok: false, error: "That item is not in this game's catalogue." };
  }
  if (item.tradeable === false) {
    return { ok: false, error: `${item.name} cannot be traded in-game.` };
  }

  // A variant has to be one this game actually has, or matching would compare
  // it against a string nothing else will ever produce and it would sit in the
  // list matching nothing, forever, with no way to tell why.
  const variant = opts.variant?.trim() || undefined;
  if (variant && !isKnownVariant(item, variant)) {
    // Per-ITEM, not per-game: a mutation belongs to one fruit and offering it
    // on another would invite a listing for a thing that cannot exist.
    return { ok: false, error: `${item.name} has no "${variant}" variant.` };
  }

  const quantity = Math.max(1, Math.min(MAX_QUANTITY, Math.floor(opts.quantity ?? 1)));

  // Idempotent by (item, variant, list). Tapping Add twice on a flaky
  // connection must not quietly double a holding — every total downstream
  // would be wrong and nothing on screen would say so. The unique index
  // enforces the same thing at the database, so a race loses rather than
  // duplicating.
  const base = supabase
    .from("inventory_entries")
    .select("id, quantity")
    .eq("user_id", user.id)
    .eq("game_slug", gameSlug)
    .eq("item_id", itemId)
    .eq("kind", kind);

  // The no-variant case has to test for absence, not match loosely. A
  // `contains({})` is true of every row, so adding a plain rod would find the
  // Aether one already on the list and report success without writing
  // anything — and the player's list would be missing an item they watched
  // themselves add.
  const { data: existing } = await (variant
    ? base.eq("attributes->>variant", variant)
    : base.is("attributes->>variant", null)
  ).maybeSingle();

  if (existing) {
    revalidatePath(`/app/${gameSlug}/trades`);
    return { ok: true };
  }

  const { error } = await supabase.from("inventory_entries").insert({
    user_id: user.id,
    game_slug: gameSlug,
    item_id: itemId,
    kind,
    quantity,
    attributes: variant ? { variant } : {},
  });

  if (error) return { ok: false, error: error.message };

  revalidatePath(`/app/${gameSlug}/trades`);
  revalidatePath(`/app/${gameSlug}/profile`);
  revalidatePath(`/app/${gameSlug}`);
  return { ok: true };
}

export async function setInventoryQuantity(
  gameSlug: string,
  entryId: string,
  quantity: number,
): Promise<ActionResult> {
  const supabase = await serverSupabase();
  if (!supabase) return { ok: false, error: "Not connected to the database." };

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "Sign in first." };

  const n = Math.max(1, Math.min(MAX_QUANTITY, Math.floor(quantity)));

  const { error } = await supabase
    .from("inventory_entries")
    .update({ quantity: n, updated_at: new Date().toISOString() })
    .eq("id", entryId)
    .eq("user_id", user.id);

  if (error) return { ok: false, error: error.message };

  revalidatePath(`/app/${gameSlug}/trades`);
  revalidatePath(`/app/${gameSlug}`);
  return { ok: true };
}

export async function removeInventoryItem(
  gameSlug: string,
  entryId: string,
): Promise<ActionResult> {
  const supabase = await serverSupabase();
  if (!supabase) return { ok: false, error: "Not connected to the database." };

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "Sign in first." };

  // The user_id filter is belt to RLS's braces: the policy would reject this
  // anyway, but an explicit filter means a mistake here fails closed.
  const { error } = await supabase
    .from("inventory_entries")
    .delete()
    .eq("id", entryId)
    .eq("user_id", user.id);

  if (error) return { ok: false, error: error.message };

  revalidatePath(`/app/${gameSlug}/trades`);
  revalidatePath(`/app/${gameSlug}/profile`);
  revalidatePath(`/app/${gameSlug}`);
  return { ok: true };
}

/**
 * The signed-in player's lists for one game. Empty when signed out.
 *
 * Names come from the catalogue rather than from a join, because the catalogue
 * is where they are maintained — a rename in items.ts should show up on the
 * next load, not wait for a database backfill that nobody has scheduled. A row
 * whose slug no longer resolves keeps its custom name and stays visible, so a
 * retired item can be seen and removed instead of vanishing silently.
 */
export async function readInventory(gameSlug: string): Promise<InventoryRow[]> {
  const supabase = await serverSupabase();
  if (!supabase) return [];

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return [];

  const { data } = await supabase
    .from("inventory_entries")
    .select("id, kind, item_id, custom_name, quantity, attributes")
    .eq("user_id", user.id)
    .eq("game_slug", gameSlug)
    .order("kind");

  return (data ?? []).map((row) => {
    const item = row.item_id ? findItem(row.item_id) : undefined;
    const attrs = (row.attributes ?? {}) as { variant?: string };
    return {
      id: row.id,
      kind: row.kind as "have" | "want",
      itemId: row.item_id,
      name: item?.name ?? row.custom_name ?? row.item_id ?? "Unknown item",
      category: item?.category ?? "",
      rarity: item?.rarity,
      type: item?.type,
      variant: attrs.variant,
      quantity: Math.max(1, row.quantity || 1),
    };
  });
}
