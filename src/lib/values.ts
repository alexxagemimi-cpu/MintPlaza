/**
 * Price and Value are two different numbers, and conflating them is the single
 * most expensive mistake a trading site can make.
 *
 *   PRICE  is what the game charges. Beli at the Blox Fruit Dealer, or Robux in
 *          the shop. It is official, exact, and changes only when the developers
 *          change it.
 *
 *   VALUE  is what the community will actually trade the item for. It is not
 *          official, nobody publishes it, and it is derived from observed
 *          trades by value-list sites. Portal costs 1,900,000 Beli and trades at
 *          around 10M — five times its price. At the bottom of the list the two
 *          nearly converge; at the top they diverge enormously.
 *
 *   DEMAND is how badly people want it right now. Two items at the same value
 *          are not equally easy to trade away, and a trader needs to see that.
 *
 * A calculator built on price would tell players Portal is worth 1.9M and lose
 * them the trade. So every calculation in this app runs on VALUE, and price is
 * shown beside it as context.
 *
 * ---------------------------------------------------------------------------
 * Where these numbers come from, and why they are not "live"
 * ---------------------------------------------------------------------------
 *
 * There is no official value API. Value lists are community sites that refresh
 * a few times a day, and they disagree with each other — sometimes by a factor
 * of two on the same fruit on the same day. Mixing sources would produce a
 * calculator whose two sides are measured on different rulers, which is worse
 * than no calculator.
 *
 * So this table comes from ONE source, kept internally consistent, and it is
 * stamped with the date it was read. It is a snapshot, not a feed, and the
 * interface says so wherever a number appears. Values are editable in the admin
 * panel, which is how they stay current until a real feed exists.
 *
 * Anything genuinely unknown is left out rather than guessed. A missing value
 * makes the calculator say "cannot price this side", which is honest; an
 * invented one makes it lie with confidence.
 */

/** Where the value column came from. Shown wherever a value is displayed. */
export const VALUE_SOURCE = {
  name: "Game.Guide Blox Fruits value list",
  url: "https://www.game.guide/blox-fruits-value-list",
  /** The date the source itself said it was last updated. */
  checked: "2 September 2026",
} as const;

/**
 * Demand — how badly people want it right now.
 *
 * Six named steps, not a score. Traders do not say "demand 4", they say "high
 * demand", so that is what the interface says. The number behind it exists only
 * so the levels can be sorted and compared; it is never shown to anybody.
 *
 * Extreme is deliberately its own step rather than the top of the same scale.
 * It marks the handful of things a whole server is chasing at once, and it is
 * drawn in red with a live glow so it reads differently at a glance — the point
 * of the level is that you should not have to read the word to notice it.
 */
export type Demand = 1 | 2 | 3 | 4 | 5 | 6;

export const DEMAND_LABEL: Record<Demand, string> = {
  1: "Very low",
  2: "Low",
  3: "Mid",
  4: "High",
  5: "Very high",
  6: "Extreme",
};

/** Every step in order, for the admin panel's picker. */
export const DEMAND_LEVELS: readonly Demand[] = [1, 2, 3, 4, 5, 6];

export const DEMAND_STYLE: Record<Demand, { fg: string; bg: string; glow?: boolean }> = {
  1: { fg: "#6B7A74", bg: "#EEF2F0" },
  2: { fg: "#2C6C9E", bg: "#E7F0F8" },
  3: { fg: "#8A5A12", bg: "#FBF1E0" },
  4: { fg: "#A8501E", bg: "#FBEDE3" },
  5: { fg: "#A93226", bg: "#FBEDEB" },
  6: { fg: "#FFFFFF", bg: "#D93025", glow: true },
};

export interface ItemValue {
  /** Trade value of the physical item, in Beli-equivalent units. */
  physical?: number;
  /**
   * Trade value of the Permanent form. Only fruits have one, and the gap is
   * large — a permanent never leaves your inventory, so it trades like a
   * gamepass rather than like a fruit.
   */
  permanent?: number;
  demand?: Demand;
}

const M = 1_000_000;
const B = 1_000_000_000;
const K = 1_000;

/**
 * Values keyed by catalogue id.
 *
 * Read tier by tier from the source above. Where a row has no permanent figure
 * the source did not publish one; the field is absent rather than zero, so the
 * calculator can tell "worth nothing" from "not known".
 */
export const VALUES: Record<string, ItemValue> = {
  // ---- Common ----
  "bf-rocket": { physical: 5 * K, permanent: 10 * M, demand: 1 },
  "bf-spin": { physical: 7.5 * K, permanent: 15 * M, demand: 1 },
  "bf-blade": { physical: 50 * K, demand: 1 },
  "bf-spring": { physical: 60 * K, demand: 1 },
  "bf-bomb": { physical: 80 * K, demand: 1 },
  "bf-smoke": { physical: 100 * K, demand: 1 },
  "bf-spike": { physical: 180 * K, demand: 1 },

  // ---- Uncommon ----
  "bf-flame": { physical: 257.5 * K, demand: 1 },
  "bf-ice": { physical: 550 * K, permanent: 626.7 * M, demand: 1 },
  "bf-sand": { physical: 420 * K, permanent: 340 * M, demand: 1 },
  "bf-dark": { physical: 400 * K, permanent: 380 * M, demand: 1 },
  "bf-eagle": { physical: 750 * K, permanent: 840 * M, demand: 1 },
  "bf-diamond": { physical: 866.7 * K, permanent: 980 * M, demand: 1 },

  // ---- Rare ----
  "bf-light": { physical: 800 * K, permanent: 890 * M, demand: 2 },
  "bf-rubber": { physical: 700 * K, permanent: 833.3 * M, demand: 1 },
  "bf-ghost": { physical: 812.5 * K, permanent: 1.1 * B, demand: 1 },
  "bf-magma": { physical: 1.1 * M, permanent: 1.1 * B, demand: 3 },

  // ---- Legendary ----
  "bf-quake": { physical: 1 * M, permanent: 1.4 * B, demand: 1 },
  "bf-buddha": { physical: 10 * M, permanent: 1.8 * B, demand: 5 },
  "bf-love": { physical: 1.4 * M, permanent: 1.7 * B, demand: 2 },
  "bf-creation": { physical: 2.5 * M, permanent: 1.7 * B, demand: 1 },
  "bf-spider": { physical: 1.5 * M, permanent: 1.5 * B, demand: 2 },
  "bf-sound": { physical: 2.2 * M, permanent: 2.0 * B, demand: 2 },
  "bf-phoenix": { physical: 2.4 * M, permanent: 2.2 * B, demand: 2 },
  "bf-portal": { physical: 10 * M, permanent: 2.5 * B, demand: 5 },
  "bf-lightning": { physical: 55 * M, permanent: 2.9 * B, demand: 3 },
  "bf-pain": { physical: 10 * M, permanent: 3.1 * B, demand: 3 },
  "bf-blizzard": { physical: 5 * M, permanent: 3.0 * B, demand: 3 },

  // ---- Mythical ----
  "bf-gravity": { physical: 10 * M, permanent: 3.0 * B, demand: 3 },
  "bf-mammoth": { physical: 9.8 * M, permanent: 3.4 * B, demand: 3 },
  "bf-t-rex": { physical: 20 * M, permanent: 3.5 * B, demand: 4 },
  "bf-dough": { physical: 30 * M, permanent: 3.6 * B, demand: 5 },
  "bf-shadow": { physical: 6.3 * M, permanent: 3.8 * B, demand: 3 },
  "bf-venom": { physical: 20 * M, permanent: 3.7 * B, demand: 4 },
  "bf-gas": { physical: 60 * M, permanent: 3.8 * B, demand: 4 },
  "bf-spirit": { physical: 10 * M, permanent: 3.8 * B, demand: 4 },
  "bf-tiger": { physical: 137.5 * M, permanent: 5.0 * B, demand: 4 },
  "bf-yeti": { physical: 127.5 * M, permanent: 5.0 * B, demand: 4 },
  "bf-kitsune": { physical: 622.5 * M, permanent: 6.5 * B, demand: 6 },
  "bf-control": { physical: 156.7 * M, permanent: 6.2 * B, demand: 5 },
  // West and East Dragon are two different fruits, and they trade apart: the
  // permanent forms are separate items too, which is why each carries its own
  // permanent figure rather than sharing one. The physical figures are the two
  // I could not read a consistent number for, so they are absent rather than
  // guessed — see CATALOG_GAPS.
  "bf-west-dragon": { permanent: 3.17 * B, demand: 5 },
  "bf-east-dragon": { permanent: 5.13 * B, demand: 6 },

  // ---- Gamepasses ----
  "bf-gp-dark-blade": { physical: 1.1 * B, demand: 5 },
  "bf-gp-fruit-notifier": { physical: 4.23 * B, demand: 6 },
  "bf-gp--1-fruit-storage": { physical: 420 * M, demand: 5 },
  "bf-gp-2x-money": { physical: 396.7 * M, demand: 3 },
  "bf-gp-fast-boats": { physical: 305 * M, demand: 3 },
  "bf-gp-2x-mastery": { physical: 280 * M, demand: 3 },
  "bf-gp-2x-boss-drops-chance": { physical: 225 * M, demand: 3 },

  // ---- Scrolls ----
  "bf-scroll-3x-mythical-scrolls": { physical: 975 * M, demand: 3 },
  "bf-scroll-5x-legendary-scrolls": { physical: 620 * M, demand: 3 },

  // ---- Skins ----
  // These trade far above the fruits they repaint, which is exactly why they
  // had to become catalogue items of their own.
  "bf-skin-galaxy-empyrean": { physical: 11.0 * B, demand: 6 },
  "bf-skin-crimson-empyrean": { physical: 6.91 * B, demand: 5 },
  "bf-skin-ember-dragon": { physical: 5.62 * B, demand: 5 },
  "bf-skin-divine-portal": { physical: 1.4 * B, demand: 5 },
  "bf-skin-green-lightning": { physical: 345 * M, demand: 4 },
  "bf-skin-rose-quartz-diamond": { physical: 280 * M, demand: 4 },
  "bf-skin-torment-pain": { physical: 130 * M, demand: 4 },
  "bf-skin-glacier-eagle": { physical: 18.3 * M, demand: 3 },
};

/**
 * Known holes, stated rather than hidden. Surfaced in admin so the gaps get
 * filled deliberately instead of being discovered by a player mid-trade.
 */
export const CATALOG_GAPS: readonly string[] = [
  "West Dragon and East Dragon have no physical value yet — only the Permanent figures are known. A physical Dragon on either side of a trade will not get a verdict until those are filled in.",
  "Most skins have no published value yet — only the eight best-known ones do. Eclipse, Blood Moon, Violet Night, Phoenix Sky and Parrot are in the catalogue and tradeable, but carry no value or rarity yet.",
  "Spirit's value is wrong — reported by the owner, not yet re-read. Treat every figure in this table the same way: it is one site's snapshot, and the panel is the place to correct it.",
  "The cheapest fruits have no Permanent value published.",
];

/**
 * The value of one catalogue entry in a given form.
 *
 * A value carried on the item wins over the seeded table. Rows loaded from
 * Supabase carry one, which is how an edit in the admin panel changes what the
 * calculator says without a deploy; rows from the static catalogue do not, and
 * fall through to the table below.
 */
export function valueOf(
  item: { id: string; value?: ItemValue },
  variant?: string,
): number | undefined {
  const v = item.value ?? VALUES[item.id];
  if (!v) return undefined;
  return variant === "Permanent" ? v.permanent : v.physical;
}

export function demandOf(item: { id: string; demand?: Demand }): Demand | undefined {
  return item.demand ?? VALUES[item.id]?.demand;
}

/**
 * Compact money, the way trading communities write it: 622.5M, 3.4B, 80K.
 * Trailing ".0" is dropped because "3.0B" reads like a measurement.
 */
/**
 * "checked today" / "checked 3 days ago" / "checked 2 weeks ago".
 *
 * Shown wherever a value is. A number with no date on it is indistinguishable
 * from a fact, and these are a snapshot of a market that moves daily — the age
 * is the part that tells a trader how much to trust it.
 */
export function checkedLabel(iso?: string): string {
  if (!iso) return `checked ${VALUE_SOURCE.checked}`;
  const days = Math.floor((Date.now() - new Date(iso).getTime()) / 86_400_000);
  if (!Number.isFinite(days) || days < 0) return `checked ${VALUE_SOURCE.checked}`;
  if (days === 0) return "checked today";
  if (days === 1) return "checked yesterday";
  if (days < 14) return `checked ${days} days ago`;
  const weeks = Math.floor(days / 7);
  if (weeks < 9) return `checked ${weeks} weeks ago`;
  return `checked ${Math.floor(days / 30)} months ago`;
}

/** True once a value is old enough that the interface should say so loudly. */
export function isStale(iso?: string): boolean {
  if (!iso) return false;
  return Date.now() - new Date(iso).getTime() > 14 * 86_400_000;
}

export function formatValue(n: number): string {
  const [div, suffix] =
    n >= B ? [B, "B"] : n >= M ? [M, "M"] : n >= K ? [K, "K"] : [1, ""];
  const scaled = n / div;
  // 622.5M has to keep its half, 6.91B has to keep both digits, and nothing
  // needs three. Trailing zeros are stripped below, so 11.00 prints as 11.
  const digits = scaled >= 100 ? 1 : 2;
  return scaled.toFixed(digits).replace(/\.?0+$/, "") + suffix;
}
