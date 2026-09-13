/**
 * The trade calculator.
 *
 * Every value-list site has one, and players trust the verdict more than they
 * trust their own arithmetic, so it has to be right about three things:
 *
 *   1. It runs on VALUE, never on price. See values.ts for why.
 *   2. It knows whose side it is on. The same listing is a win for one player
 *      and a loss for the other, so a verdict without a viewer is meaningless.
 *   3. It refuses to guess. If any item on either side has no published value,
 *      the totals are incomplete and it says so instead of quietly summing the
 *      items it happens to know.
 *
 * The answer is one of three words and nothing more. There is no percentage and
 * no "+1.33B", because a score implies the inputs are exact and they are not:
 * they are one community site's read of a market that moves every day. W, F or
 * L is the most a value estimate can honestly support.
 */

import type { CatalogItem } from "./items";
import { valueOf, demandOf, type Demand } from "./values";

/**
 * One line of a trade: an item, the form it is in, and how many.
 *
 * It lives here rather than beside the listings that carry it because it is
 * the calculator's input type, and both the example generator and the matcher
 * feed the calculator. Defining it in either of those would make the other
 * import it through a module it has no other business knowing about.
 */
export interface ListingItem {
  item: CatalogItem;
  variant?: string;
  quantity: number;
}

export interface LineItem {
  name: string;
  variant?: string;
  quantity: number;
  /** Undefined where the item has no published value. */
  unit?: number;
  subtotal?: number;
  demand?: Demand;
  /**
   * What the game charges, shown beside the value so the gap between the two is
   * visible. Beli for a physical fruit, Robux for anything bought in the shop.
   * Never summed into a total — price and value are different currencies of
   * meaning and adding them would be nonsense.
   */
  price?: { amount: number; unit: "Beli" | "Robux" };
}

export interface SideTotal {
  lines: LineItem[];
  total: number;
  /** Names of items with no published value. Non-empty means total is partial. */
  unpriced: string[];
}

export function priceSide(entries: readonly ListingItem[]): SideTotal {
  const lines: LineItem[] = [];
  const unpriced: string[] = [];
  let total = 0;

  for (const e of entries) {
    const unit = valueOf(e.item, e.variant);
    const subtotal = unit === undefined ? undefined : unit * e.quantity;
    if (unit === undefined) unpriced.push(e.item.name);
    else total += subtotal!;
    // A Permanent fruit is bought with Robux; a physical one is bought with
    // Beli at the Dealer. Anything from the shop only ever has a Robux price.
    const price =
      e.variant === "Permanent" || e.item.category !== "Fruit"
        ? e.item.robux !== undefined
          ? { amount: e.item.robux, unit: "Robux" as const }
          : undefined
        : e.item.beli !== undefined
          ? { amount: e.item.beli, unit: "Beli" as const }
          : undefined;

    lines.push({
      name: e.item.name,
      variant: e.variant,
      quantity: e.quantity,
      unit,
      subtotal,
      demand: demandOf(e.item),
      price,
    });
  }

  return { lines, total, unpriced };
}

export type Verdict = "W" | "L" | "F" | "?";

export const VERDICT_COPY: Record<Verdict, { short: string; long: string }> = {
  W: { short: "WIN", long: "the side you receive is worth more" },
  L: { short: "LOSS", long: "the side you give is worth more" },
  F: { short: "FAIR", long: "both sides come out about the same" },
  "?": { short: "NO CALL", long: "some items have no published value" },
};

export const VERDICT_STYLE: Record<Verdict, { fg: string; bg: string; ring: string }> = {
  W: { fg: "#1F7A54", bg: "#E6F4EC", ring: "#1F7A5433" },
  L: { fg: "#A93226", bg: "#FBEDEB", ring: "#A9322633" },
  F: { fg: "#465650", bg: "#EEF2F0", ring: "#0D161322" },
  "?": { fg: "#8A5A12", bg: "#FBF1E0", ring: "#8A5A1233" },
};

export interface Calculation {
  /** What the viewer would receive. */
  incoming: SideTotal;
  /** What the viewer would hand over. */
  outgoing: SideTotal;
  verdict: Verdict;
  /** True when the listing asks for nothing specific. */
  openToOffers: boolean;
  /**
   * True where the two sides name items from different games.
   *
   * Cross-trading is against the rules of every game MintPlaza runs, and it is
   * also arithmetically meaningless here: Blox Fruits values are Beli-equivalent,
   * Fisch prices in Shady Scrips, Sonaria in Shooms. "3.4B" and "3.4K" have
   * nothing to do with each other, and a calculator that adds them has invented
   * a number nobody can check. So this is not a policy the interface enforces
   * politely — the maths refuses.
   */
  crossGame: boolean;
}

/**
 * Anything inside this band is a fair trade — 15% either way.
 *
 * Wide on purpose. These values are one site's read of a market that moves
 * daily, and two of them are routinely a few percent apart on the same fruit,
 * so a narrow band would spend its time calling coin-flips. A band this size
 * says "close enough to shake on", which is the question a trader is actually
 * asking, and leaves W and L for gaps big enough to be real.
 */
const FAIR_BAND_PERCENT = 15;

/**
 * Whose eyes this is calculated through.
 *
 *   "owner"  — the player who posted it. They hand over what they are offering
 *              and receive what they asked for.
 *   "viewer" — anybody else. The sides are exactly reversed: they receive what
 *              is offered and hand over what is wanted.
 *
 * This is the whole reason one listing shows two different verdicts.
 */
export type Perspective = "owner" | "viewer";

export function calculate(
  offering: readonly ListingItem[],
  wanting: readonly ListingItem[],
  perspective: Perspective,
): Calculation {
  const offered = priceSide(offering);
  const wanted = priceSide(wanting);

  const incoming = perspective === "owner" ? wanted : offered;
  const outgoing = perspective === "owner" ? offered : wanted;

  const openToOffers = wanting.length === 0;

  // Every item on both sides, and whether they agree about which game this is.
  const slugs = new Set(
    [...offering, ...wanting].map((e) => e.item.gameSlug).filter(Boolean),
  );
  const crossGame = slugs.size > 1;

  // The gap decides which of the three words it is, and then it is thrown
  // away. A percentage or a "+1.33B" reads as precision the underlying numbers
  // do not have — they are one site's estimate of a market that moves daily —
  // and a trader who is told "W" and shown both totals has everything the
  // arithmetic can honestly give them.
  const percent =
    outgoing.total > 0 ? ((incoming.total - outgoing.total) / outgoing.total) * 100 : 0;

  // A listing open to offers has nothing to weigh against, and an incomplete
  // side makes any verdict a guess. Both get "?" rather than a confident lie.
  const verdict: Verdict =
    crossGame ||
    openToOffers ||
    incoming.unpriced.length > 0 ||
    outgoing.unpriced.length > 0 ||
    outgoing.total === 0
      ? "?"
      : Math.abs(percent) <= FAIR_BAND_PERCENT
        ? "F"
        : percent > 0
          ? "W"
          : "L";

  return { incoming, outgoing, verdict, openToOffers, crossGame };
}
