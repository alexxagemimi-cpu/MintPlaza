/**
 * What one side of a trade is made of.
 *
 * ---------------------------------------------------------------------------
 * This file used to be the calculator
 * ---------------------------------------------------------------------------
 *
 * It held priceSide(), calculate(), a W/F/L verdict and a fair band, all
 * running on a value table MintPlaza maintained itself. All of it is gone, and
 * what is left is the one thing that was never about values: the shape of a
 * line on a listing.
 *
 * The reasoning is in referrals.ts and is worth reading before anybody puts a
 * verdict back. The short version: a W/F/L is only as good as the values under
 * it, values go stale in days, and a stale verdict is worse than none because a
 * player trusts it exactly as much as a fresh one. MintPlaza sends that
 * question to the site each community already quotes, and spends its effort on
 * the part those sites do not do — finding the person and talking to them
 * safely.
 *
 * So a listing here states what is on each side and leaves the judgement to the
 * two people making it, with a link to the calculator their game actually uses.
 * That is not a missing feature. It is the site declining to put a number in a
 * player's mouth that it cannot stand behind.
 */

import type { CatalogItem } from "./items";

/**
 * One line of a trade: an item, the form it is in, and how many.
 *
 * It lives here rather than beside the listings that carry it because three
 * unrelated things build trade sides — the example generator, the matcher and
 * the listing form — and defining it in any one of them would make the other
 * two import through a module they have no business knowing about.
 */
export interface ListingItem {
  item: CatalogItem;
  variant?: string;
  quantity: number;
}
