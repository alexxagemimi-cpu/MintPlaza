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

/**
 * Where each game's numbers come from, and what unit they are in.
 *
 * ---------------------------------------------------------------------------
 * Why this is a table and not a constant
 * ---------------------------------------------------------------------------
 *
 * There is no site that covers every game MintPlaza runs, and the ones that
 * exist do not agree with each other. Worse, they do not even use the same
 * unit: Blox Fruits prices in Beli-equivalent, Fisch in Shady Scrips, Sonaria
 * in Shooms, Grow a Garden 2 in Sheckle-points, Pet Simulator 99 in RAP, and
 * Adopt Me in a unitless community scale with no currency behind it at all.
 *
 * Two consequences, and both are enforced by code rather than by good
 * intentions:
 *
 *   1. One source per game, named and dated, shown wherever a number appears.
 *      A value with no date on it is indistinguishable from a fact.
 *
 *   2. Numbers from two games are NEVER compared. Not as a policy — the
 *      calculator physically refuses, because "3.4B" in Beli and "3.4K" in
 *      Shooms have nothing to do with each other and a site that adds them has
 *      invented a number nobody can check. This is also what makes
 *      cross-trading impossible to price here, which is the point: it is
 *      against the rules of every one of these games.
 */
export interface ValueSource {
  /** What the site calls itself. */
  name: string;
  url: string;
  /** The date the source itself said it was last updated. */
  checked: string;
  /** What the numbers are denominated in. Never mixed between games. */
  unit: string;
  /** Anything a player should know before trusting the column. */
  caveat?: string;
}

/**
 * Keyed by the REGISTRY slug, not the one the research used.
 *
 * Worth stating because it already went wrong once. The research files call
 * these games `ps99`, `adoptme` and `sonaria`; the registry and the database
 * call them `pet-simulator-99`, `adopt-me` and `creatures-of-sonaria`. Keying
 * this table by the research's names made `valueSourceFor` return null for
 * three of six games, so their listings quietly claimed there was no value
 * list at all — a failure that looks exactly like an honest one, which is the
 * worst kind. The proof script catches it now.
 */
export const VALUE_SOURCES: Record<string, ValueSource> = {
  "blox-fruits": {
    name: "Game.Guide Blox Fruits value list",
    url: "https://www.game.guide/blox-fruits-value-list",
    checked: "2 September 2026",
    unit: "Beli-equivalent",
    caveat: "Blox Fruits publishes no official values. This is one community site's read of the market.",
  },
  fisch: {
    name: "Game.Guide TrueVal list",
    url: "https://www.game.guide/fisch-value-list",
    checked: "8 September 2026",
    unit: "S$ (Shady Scrips)",
    caveat:
      "TrueVal is the S$ scale traders quote. It is not the NPC sell price in C$, and the two must never be mixed — a fish sells to a merchant for one number and trades for another.",
  },
  "pet-simulator-99": {
    name: "BIG Games public API (RAP and exists counts)",
    url: "https://ps99.biggamesapi.io/",
    checked: "12 September 2026",
    unit: "RAP (diamonds)",
    caveat:
      "RAP is computed by the game from real trades, which makes it the most honest anchor on the site — but it is not the same as what a pet is currently worth, and community lists differ from it. BIG Games' API terms require written consent before commercial use; until that consent exists this is a reference, not a feed.",
  },
  "adopt-me": {
    name: "adoptmevalues.gg (Cosmic Values)",
    url: "https://adoptmevalues.gg/",
    checked: "12 September 2026",
    unit: "community value points",
    caveat:
      "Adopt Me has no in-game currency for trading, so these are a unitless community scale. The same pet is priced separately for each Neon and potion combination.",
  },
  "creatures-of-sonaria": {
    name: "Game.Guide Creatures of Sonaria value list",
    url: "https://www.game.guide/creatures-of-sonaria-value-list",
    checked: "12 September 2026",
    unit: "Shooms",
    caveat:
      "The top of this market is genuinely unpriced — the single most valuable item on the list shows TBD — and 14 rows contradict the wiki on tier. Those are shown as unknown, not filled in.",
  },
  gag2: {
    name: "gag2.gg value list",
    url: "https://gag2.gg/values",
    checked: "11 September 2026",
    unit: "Sheckle-points",
    caveat:
      "Grow a Garden 2 launched in June 2026 and its value data is thin and moves with every patch. Lists disagree on the top item. Treat every figure here as provisional.",
  },
};

/**
 * Blox Fruits' source, kept under its old name so nothing that already reads it
 * has to change. New code should ask `valueSourceFor(gameSlug)`.
 */
export const VALUE_SOURCE = VALUE_SOURCES["blox-fruits"];

/**
 * The source for one game, or null.
 *
 * Null is a real answer and the interface has to handle it: a game can be on
 * MintPlaza with a working board and no value list at all, and inventing a
 * column for it would be worse than admitting there is none.
 */
export function valueSourceFor(gameSlug: string): ValueSource | null {
  return VALUE_SOURCES[gameSlug] ?? null;
}

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
  /**
   * Where the community quotes a spread rather than a number.
   *
   * A newly released item is the normal case: for the first weeks nobody knows
   * what it is worth, trackers publish a band, and the band is the honest
   * answer. Shown as "1.32B – 1.63B" so a trader can see the uncertainty
   * instead of reading the midpoint as a fact.
   */
  range?: { low: number; high: number };
  /**
   * True where the source itself flags the figure as moving. New releases,
   * items mid-rework, anything the list marks "unstable". The tile says so; it
   * does not change the arithmetic, because a wide fair band already absorbs
   * this and a second adjustment on top would be double-counting.
   */
  unstable?: boolean;
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
  // Update 30, September 2026. Trackers checked 7 September quote a BAND, not a
  // number — 1.32B to 1.63B — and flag it "New / Unstable", which is exactly
  // what a fruit nobody has had for a month is worth: not yet decided. The
  // headline is the top of the band because that is what the lists print, and
  // the band is carried alongside it so nobody reads it as settled. No
  // Permanent figure is recorded: none was published, and a guessed one on a
  // fruit this hyped would cost somebody a trade.
  "bf-magnet": {
    physical: 1.63 * B,
    range: { low: 1.32 * B, high: 1.63 * B },
    unstable: true,
    demand: 6,
  },
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

  /* ---------------------------------------------------------------- */
  /* Creatures of Sonaria — in SHOOMS, not Beli.                       */
  /* ---------------------------------------------------------------- */
  //
  // A different unit entirely, which is why valueSourceFor() exists and why the
  // calculator refuses to weigh a Sonaria item against a Blox Fruits one. A
  // single Sonaria trade is capped by the game at 500,000 Shooms, so several of
  // these cannot legally be bought outright with Shooms at all — they change
  // hands creature-for-creature.
  //
  // Every figure is a band, because that is how the community publishes them.
  // The headline is the MIDPOINT rather than either end, and deliberately: the
  // low end would quietly undervalue whatever a player is holding, the high end
  // would quietly overvalue it, and only the middle is even-handed about which
  // side of a trade it flatters. The band is carried alongside and shown, so
  // nobody reads the headline as settled.
  //
  // Demand is absent on every row. MintPlaza's six demand levels are our own
  // idea and the Sonaria sources do not publish anything that maps onto them.
  // An invented demand badge on the most expensive items in the game would be
  // the single most persuasive lie on the site.
  "cs-keruku":        { physical: 550 * K, range: { low: 500 * K, high: 600 * K }, unstable: true },
  "cs-somnia-elus":   { physical: 450 * K, range: { low: 400 * K, high: 500 * K }, unstable: true },
  "cs-corvurax":      { physical: 340 * K, range: { low: 300 * K, high: 380 * K }, unstable: true },
  "cs-mijusuima":     { physical: 325 * K, range: { low: 300 * K, high: 350 * K }, unstable: true },
  "cs-etheralotus":   { physical: 275 * K, range: { low: 200 * K, high: 350 * K }, unstable: true },

  "cs-lunar-qilin":   { physical: 2 * M, range: { low: 1 * M, high: 3 * M }, unstable: true },
  "cs-kaiju-material":    { physical: 1 * M, range: { low: 800 * K, high: 1.2 * M }, unstable: true },
  "cs-glaring-material":  { physical: 1 * M, range: { low: 800 * K, high: 1.2 * M }, unstable: true },
  "cs-sonarian-material": { physical: 1 * M, range: { low: 800 * K, high: 1.2 * M }, unstable: true },
  "cs-shining-material":  { physical: 1 * M, range: { low: 800 * K, high: 1.2 * M }, unstable: true },

  "cs-super-korathos-palette": { physical: 750 * K, range: { low: 500 * K, high: 1 * M }, unstable: true },
  "cs-starlit-palette":        { physical: 750 * K, range: { low: 500 * K, high: 1 * M }, unstable: true },
  "cs-ikoran-palette":         { physical: 750 * K, range: { low: 500 * K, high: 1 * M }, unstable: true },
  "cs-hygos-palette":          { physical: 750 * K, range: { low: 500 * K, high: 1 * M }, unstable: true },

  // cs-explosive-stars-material is deliberately, permanently absent. It is the
  // most valuable item in Creatures of Sonaria and the community list has
  // published it as TBD for months. Any trade naming it gets no verdict, which
  // is the correct answer and the whole reason the "no call" state exists.

  // ---- Grow a Garden 2 ----
  //
  // Four rows. That is not an oversight, it is the whole of what gag2.gg
  // publishes a number for: every other cosmetic on that tab reads N/A, and
  // most of the crops, pets and gear have never had a figure at all. The
  // numbers are small because this list is denominated in Sheckle-POINTS, a
  // relative index the site keeps, not in Sheckles — 165 is the most valuable
  // cosmetic in the game, not 165 coins. Nothing here is multiplied up to look
  // more like the Blox Fruits column.
  //
  // No demand on any of them, for the same reason Sonaria carries none: our
  // six demand levels are our own invention and gag2.gg publishes nothing that
  // maps onto them.
  "gag2-cosmetic-mega-picture-frame": { physical: 165, unstable: true },
  "gag2-cosmetic-big-picture-frame":  { physical: 2.5, unstable: true },
  "gag2-cosmetic-bookcase":           { physical: 2.4, unstable: true },
  "gag2-cosmetic-wood-floor":         { physical: 1.5, unstable: true },
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
  "Fisch: 13 of the 67 Exotic fish are missing by name. The wiki's rarity page counts 67; the Exotic category page has not been edited since December 2024 and lists 59. Both numbers are real and neither is complete \u2014 a person has to open the category and reconcile them.",
  "Fisch: around 200 mutations exist and only four multipliers are confirmed (Aether 15\u00d7, Prism 8\u00d7, Prismize 6.5\u00d7, Prismatic 6.5\u00d7). Tryhard, Galaxy, Glowy, Chaotic, Plagued and Darkness are named but unpriced, because the lists circulating for them disagree with each other and with the wiki.",
  "Grow a Garden 2: every Mythic and Super seed price except Venus Fly Trap (7,000,000 Sheckles) is unconfirmed, and the third-party figures differ by a factor of three. The pet and egg tables are absent entirely \u2014 sources cannot agree whether the game has 22, 30, 35 or 36 pets.",
  "Creatures of Sonaria: the single most valuable item on the community list, Explosive Stars Material, is published as TBD. It is in no catalogue here rather than being given an invented number, and 14 rows where the value list contradicts the wiki on tier are unresolved.",
  "Pet Simulator 99: pet, egg and enchant data should come from BIG Games' own API rather than any snapshot \u2014 the roster grows most weeks (2,720 in May 2026, about 3,080 by September). Their terms allow non-commercial use only, so live use needs written consent first.",
  "Magnet (Update 30) has no Permanent value yet, and its physical figure is a community band (1.32B\u20131.63B) flagged unstable rather than a settled number. Re-read it once the launch hype has worn off \u2014 new fruits always fall.",
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
