"use server";

import { revalidatePath } from "next/cache";
import { serverSupabase } from "@/lib/supabase/server";

/**
 * Inventory writes.
 *
 * Server actions rather than client-side inserts, so the session comes from an
 * httpOnly cookie the browser cannot script. Row-level security is still the
 * real boundary — `inventory_own` restricts every row to its owner — so even a
 * forged user_id here would be rejected by the database.
 */

export type ActionResult = { ok: true } | { ok: false; error: string };

export async function addInventoryItem(
  gameSlug: string,
  itemId: string,
  kind: "have" | "want",
): Promise<ActionResult> {
  const supabase = await serverSupabase();
  if (!supabase) return { ok: false, error: "Not connected to the database." };

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "Sign in first." };

  if (kind !== "have" && kind !== "want") {
    return { ok: false, error: "Unknown list." };
  }

  // Already on that list is a no-op, not an error — the button is idempotent.
  const { data: existing } = await supabase
    .from("inventory_entries")
    .select("id")
    .eq("user_id", user.id)
    .eq("game_slug", gameSlug)
    .eq("item_id", itemId)
    .eq("kind", kind)
    .maybeSingle();

  if (existing) {
    revalidatePath(`/app/${gameSlug}/inventory`);
    return { ok: true };
  }

  const { error } = await supabase.from("inventory_entries").insert({
    user_id: user.id,
    game_slug: gameSlug,
    item_id: itemId,
    kind,
  });

  if (error) return { ok: false, error: error.message };

  revalidatePath(`/app/${gameSlug}/inventory`);
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

  revalidatePath(`/app/${gameSlug}/inventory`);
  revalidatePath(`/app/${gameSlug}`);
  return { ok: true };
}

export interface InventoryRow {
  id: string;
  kind: "have" | "want";
  itemId: string | null;
  name: string;
  category: string;
  rarity?: string;
}

/** The signed-in player's lists for one game. Empty when signed out. */
export async function readInventory(gameSlug: string): Promise<InventoryRow[]> {
  const supabase = await serverSupabase();
  if (!supabase) return [];

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return [];

  const { data } = await supabase
    .from("inventory_entries")
    .select("id, kind, item_id, custom_name, game_items(name, category, attributes)")
    .eq("user_id", user.id)
    .eq("game_slug", gameSlug)
    .order("kind");

  return (data ?? []).map((row) => {
    const item = row.game_items as unknown as
      | { name: string; category: string; attributes: Record<string, unknown> }
      | null;
    return {
      id: row.id,
      kind: row.kind as "have" | "want",
      itemId: row.item_id,
      name: item?.name ?? row.custom_name ?? "Unknown item",
      category: item?.category ?? "",
      rarity: item?.attributes?.rarity as string | undefined,
    };
  });
}
