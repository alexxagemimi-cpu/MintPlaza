import type { InventoryHolding } from "./match";

/**
 * One line of a player's have or want list, as every screen reads it.
 *
 * Separate from the server actions that load it because a "use server" module
 * may only export async functions — anything pure that lives beside them stops
 * the build. This is where the pure half goes.
 */
export interface InventoryRow {
  id: string;
  kind: "have" | "want";
  itemId: string | null;
  name: string;
  category: string;
  rarity?: string;
  type?: string;
  variant?: string;
  quantity: number;
}

/** The same lists, in the shape the matcher reads. */
export function holdingsOf(
  rows: readonly InventoryRow[],
  kind: "have" | "want",
): InventoryHolding[] {
  return rows
    .filter((r) => r.kind === kind && r.itemId)
    .map((r) => ({ itemId: r.itemId!, variant: r.variant, quantity: r.quantity }));
}
