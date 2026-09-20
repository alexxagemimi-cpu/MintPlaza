/**
 * Item catalogues.
 *
 * This is what makes a trade listing structured rather than a sentence. A
 * listing points at catalogue entries, so the same fruit means the same thing
 * to everyone and matching can be an indexed lookup instead of text search.
 *
 * `art` is intentionally optional. Until real artwork exists an item renders
 * as a typographic tile keyed to its rarity, which reads cleanly and never
 * pretends to be something it is not. Dropping images into /public/items and
 * filling the field in is the only change needed.
 *
 * Everything here is mutable game data and is wrong the moment a game updates,
 * so it carries a verification note and moves to the admin surface later.
 */

/**
 * Five drop tiers plus Premium for what is bought rather than dropped —
 * gamepasses and scroll bundles. Permanent fruits are Premium too, but they are
 * recorded as a variant on the fruit rather than as 41 duplicate rows.
 *
 * CHROMATIC is deliberately not in here. The wiki shows it beside a tier, not
 * instead of one — "Common / CHROMATIC", "Rare / CHROMATIC" — so it is a
 * separate flag on the item and the tile prints both.
 */
import { ART_MANIFEST, PULLED_CATALOG } from "./data/catalog";

export type Rarity =
  | "Common" | "Uncommon" | "Rare" | "Ultra-Rare"
  | "Legendary" | "Mythical" | "Premium";

export interface CatalogItem {
  id: string;
  gameSlug: string;
  name: string;
  category: string;
  rarity?: Rarity;
  /** Game-specific secondary classification, e.g. Blox Fruits fruit type. */
  type?: string;
  art?: string;
  /**
   * Names this item used to have. These games rework and rename things, and
   * players keep using the old name for years, so search has to match on them
   * or half the community cannot find what they are looking for. Shown on the
   * tile, because "was Leopard" is the fact that makes the row recognisable.
   */
  formerly?: readonly string[];
  /**
   * Other things players call this — "Yoru" for Dark Blade, "glacier" for
   * Glacier Eagle. Search matches on them but they are not displayed: they are
   * shorthand, not history, and labelling them "was" would be a lie.
   */
  aliases?: readonly string[];
  /**
   * The catalogue item this one is a variation of — a skin points at the fruit
   * it repaints. Lets the interface group a fruit with its skins without
   * parsing names.
   */
  parentId?: string;
  /**
   * False where the game itself will not let this move between players. Such
   * rows still belong in the catalogue — a player browsing skins expects to see
   * all of them — but they must never appear in a listing picker, or the site
   * would be inviting trades that cannot complete.
   *
   * Absent means tradeable.
   */
  tradeable?: boolean;
  /**
   * CHROMATIC. Sits beside the rarity rather than replacing it, because that is
   * how the game presents it.
   */
  chromatic?: boolean;
  /**
   * Robux price where the item is sold for Robux — Permanent fruits, gamepasses
   * and scroll bundles. Read off the wiki's own tables. Prices move with
   * updates, so this is presented as "last checked", never as current.
   */
  robux?: number;
  /**
   * Beli price at the Blox Fruit Dealer, for the physical fruit.
   *
   * This is PRICE, not value, and the two are different numbers: Portal costs
   * 1,900,000 Beli and trades at around 10M. Showing price where value belongs
   * would cost a player five times their fruit, so the interface always labels
   * which one it is showing.
   *
   * Only the fruits whose Beli price could be confirmed carry one. The rest are
   * absent rather than estimated.
   */
  beli?: number;
  /** Shown on the tile where the item carries a condition worth stating. */
  note?: string;
  /**
   * Creatures of Sonaria's size tier, Tier 1 through Tier 5.
   *
   * Kept as its own field rather than folded into `rarity` because it is not a
   * rarity: it describes how big the creature is, and a Tier 5 is not rarer
   * than a Tier 3, only larger. It is mapped onto the rarity ladder for colour
   * because it is the only ladder that wiki maintains consistently, but the
   * real word is preserved here so the tile can say what it actually means.
   */
  sizeTier?: string;
  /**
   * Orthogonal classifications — Limited, Event, Special, Extinct, Relic.
   *
   * These are not power levels and must never be mapped onto the rarity ladder:
   * a Limited Common is still Common. They ride alongside the tier the way
   * CHROMATIC does.
   */
  classes?: readonly string[];
  /**
   * False where the rarity or existence could not be confirmed. Shown in admin
   * so the uncertain rows can be corrected first, rather than quietly
   * presented as fact.
   */
  verified?: boolean;
  /**
   * True where the row came out of a machine pull from the game's own API or
   * its wiki, rather than being typed by hand.
   *
   * Deliberately NOT the same field as `verified`, and the distinction is the
   * whole point. `verified` means a human confirmed this row's NUMBERS;
   * `sourced` means a scraper confirmed the row EXISTS. The bulk pull arrived
   * with `verified: true` on all 10,053 rows, which would have marked every
   * unpriced row as price-checked — a claim nothing in the pull supports,
   * since the pull carries no values at all. Keeping them apart is what stops
   * the catalogue from laundering "we scraped it" into "we checked it".
   */
  sourced?: boolean;
  /**
   * Roblox asset id, where the game's own API publishes one. Pet Simulator 99
   * is currently the only game that does.
   *
   * Stored as the id, never as image bytes and never as a copied file: the
   * thumbnail URL is built from this at render time, so the picture stays
   * whatever Roblox currently serves and the database stays a database. See
   * `thumbnailFor` below.
   */
  assetId?: string;
  /**
   * When this row was last edited in the control panel, ISO. Present only on
   * rows loaded from Supabase.
   *
   * It no longer dates a value — MintPlaza keeps none. It dates the row: a
   * name, a rarity or a picture that an admin corrected, so the panel can show
   * what has been touched recently.
   */
  checkedAt?: string;
}

/**
 * Tile colours by rarity, and how heavy the ring around the tile is.
 *
 * ---------------------------------------------------------------------------
 * Why the ring carries real weight now
 * ---------------------------------------------------------------------------
 *
 * For most games the tile is a stand-in until artwork exists. For Fisch it is
 * permanent — 2,133 rows, no asset ids anywhere, and a deliberate decision not
 * to store pictures — so the tile has to do the job a picture would have done:
 * say at a glance how rare this thing is, from across a grid, on a phone.
 *
 * Hence the ring escalates rather than staying a hairline. `weight` is the ring
 * in pixels and `glow` adds an outer halo, which only the top two tiers get.
 * Restraint still applies: seven tiers, one visual axis, no rainbow. A grid
 * where everything glows says exactly as much as a grid where nothing does.
 */
export const RARITY_STYLE: Record<
  Rarity,
  { fg: string; bg: string; ring: string; weight: number; glow?: string }
> = {
  Common:    { fg: "#5A6B65", bg: "#EEF2F0", ring: "#0D161324", weight: 1 },
  Uncommon:  { fg: "#2F7D57", bg: "#E6F4EC", ring: "#2F7D5759", weight: 1.5 },
  Rare:      { fg: "#2C6C9E", bg: "#E7F0F8", ring: "#2C6C9E66", weight: 1.5 },
  "Ultra-Rare": { fg: "#2F5FA8", bg: "#E6ECF9", ring: "#2F5FA87A", weight: 2 },
  Legendary: { fg: "#8A5A12", bg: "#FBF1E0", ring: "#C98A1FCC", weight: 2 },
  // Red, and the brightest thing in the grid. This is the tier a Fisch player
  // is scanning for.
  Mythical:  { fg: "#A8253F", bg: "#FBEAEE", ring: "#D42A46", weight: 2.5, glow: "#D42A4640" },
  Premium:   { fg: "#6B4CA8", bg: "#F0ECFA", ring: "#7B5BC4", weight: 2.5, glow: "#7B5BC438" },
};

/**
 * The game's OWN tier word, which is not the same thing as `rarity`.
 *
 * `rarity` is MintPlaza's seven-tier ladder, shared across eight games so that
 * a grid reads consistently. `type` is what the game itself calls the tier, and
 * for Fisch that distinction is the whole market: the ladder above collapses
 * Exotic, Secret, Apex and Divine Secret all into "Mythical", because there is
 * nowhere above Mythical to put them — but a Divine Secret is not an Exotic,
 * and a player who cannot tell them apart cannot trade.
 *
 * So the native word gets its own badge with its own treatment. Only tiers that
 * genuinely sit above the normal ladder are given a glow; the ordinary ones are
 * quiet labels, because making every badge shout removes the signal from the
 * four that matter.
 *
 * Anything not in this table falls back to a plain badge, which is correct for
 * the game-specific words other games use (Blox Fruits' Natural / Elemental /
 * Beast are types of a different kind, and are not a ladder at all).
 */
export const TYPE_STYLE: Record<string, { fg: string; bg: string; ring: string; glow?: string }> = {
  // ---- Fisch, above the normal ladder ----
  "Divine Secret": { fg: "#8A6A10", bg: "#FDF6E0", ring: "#D4A62A", glow: "#D4A62A4D" },
  Apex:            { fg: "#9B1C2E", bg: "#FBE9EC", ring: "#C42337", glow: "#C423374D" },
  Secret:          { fg: "#5B3A9E", bg: "#F0EBFB", ring: "#7A52C9", glow: "#7A52C93D" },
  Exotic:          { fg: "#0F6E74", bg: "#E3F5F5", ring: "#17939B", glow: "#17939B33" },
  // ---- the normal ladder, quiet ----
  Mythical:  { fg: "#A8253F", bg: "#FBEAEE", ring: "#D42A4659" },
  Legendary: { fg: "#8A5A12", bg: "#FBF1E0", ring: "#C98A1F59" },
  Rare:      { fg: "#2C6C9E", bg: "#E7F0F8", ring: "#2C6C9E4D" },
  Unusual:   { fg: "#2F7D57", bg: "#E6F4EC", ring: "#2F7D574D" },
  Uncommon:  { fg: "#2F7D57", bg: "#E6F4EC", ring: "#2F7D574D" },
  Common:    { fg: "#5A6B65", bg: "#EEF2F0", ring: "#0D16131F" },
  Trash:     { fg: "#6B6257", bg: "#F2F0EC", ring: "#0D16131F" },
};

/**
 * Orthogonal classifications — Limited, Extinct, Relic and friends.
 *
 * These are not power levels and deliberately do not look like tiers: outlined
 * rather than filled, so a Limited Common still reads as Common at a glance.
 * The research is explicit that treating them as rarity is a mistake, and the
 * pull carries 252 Limited rows in Fisch alone, so getting this wrong would
 * have mis-tiered an eighth of the game.
 */
export const CLASS_STYLE: Record<string, { fg: string; ring: string }> = {
  Limited:  { fg: "#9B3B1E", ring: "#9B3B1E4D" },
  Special:  { fg: "#5B3A9E", ring: "#5B3A9E4D" },
  Extinct:  { fg: "#6B4A2A", ring: "#6B4A2A4D" },
  Gemstone: { fg: "#0F6E74", ring: "#0F6E744D" },
  Fragment: { fg: "#5A6B65", ring: "#5A6B654D" },
  Relic:    { fg: "#8A5A12", ring: "#8A5A124D" },
  Seed:     { fg: "#2F7D57", ring: "#2F7D574D" },
  Event:    { fg: "#2C6C9E", ring: "#2C6C9E4D" },
};

/** CHROMATIC reads as a second label beside the tier, never as the tier. */
export const CHROMATIC_STYLE = { fg: "#0E7C86", bg: "#E4F5F5", ring: "#0E7C8626" };

const f = (
  name: string,
  rarity: Rarity,
  type: "Natural" | "Elemental" | "Beast",
  /** Robux price of this fruit's Permanent form, from the wiki's own table. */
  robux: number,
  formerly?: readonly string[],
  /** Beli price of the physical fruit at the Dealer, where confirmed. */
  beli?: number,
): CatalogItem => ({
  id: `bf-${name.toLowerCase().replace(/[^a-z0-9]+/g, "-")}`,
  gameSlug: "blox-fruits",
  name,
  category: "Fruit",
  rarity,
  type,
  robux,
  beli,
  formerly,
  verified: true,
});

/**
 * Blox Fruits — 43 fruits, read off the in-game wiki list.
 *
 * Order and rarity follow the wiki's own grid, where the tile border is the
 * rarity: grey Common, cyan Uncommon, purple Rare, magenta Legendary, red
 * Mythical. That gives 7 / 6 / 4 / 11 / 15, totalling 43 — 15 Mythical because
 * West Dragon and East Dragon are two fruits, not one with two forms, and
 * because Update 30 (September 2026) added Magnet.
 *
 * Four entries are renames rather than separate fruits, and each keeps its old
 * name as a searchable alias because players go on using them for years:
 *
 *   Barrier -> Creation
 *   Revive  -> Ghost
 *   Leopard -> Tiger
 *   Rumble  -> Lightning
 *
 * Removed after checking against the real list: Shark, which never existed and
 * came from a bad search result, and Chop, which is not in the game's list.
 */
const BLOX_FRUITS: CatalogItem[] = [
  // ---- Common (7) ----
  f("Rocket", "Common", "Natural", 50),
  f("Spin", "Common", "Natural", 75),
  f("Blade", "Common", "Natural", 100, undefined, 30_000),
  f("Spring", "Common", "Natural", 180, undefined, 60_000),
  f("Bomb", "Common", "Natural", 220, undefined, 80_000),
  f("Smoke", "Common", "Elemental", 250, undefined, 100_000),
  f("Spike", "Common", "Natural", 380, undefined, 180_000),

  // ---- Uncommon (6) ----
  f("Flame", "Uncommon", "Elemental", 550, undefined, 250_000),
  f("Ice", "Uncommon", "Elemental", 750, undefined, 350_000),
  f("Sand", "Uncommon", "Elemental", 850, undefined, 420_000),
  f("Dark", "Uncommon", "Elemental", 950, undefined, 500_000),
  f("Eagle", "Uncommon", "Beast", 975, undefined, 550_000),
  f("Diamond", "Uncommon", "Natural", 1000, undefined, 600_000),

  // ---- Rare (4) ----
  f("Light", "Rare", "Elemental", 1100, undefined, 650_000),
  f("Rubber", "Rare", "Natural", 1200, undefined, 750_000),
  f("Ghost", "Rare", "Natural", 1275, ["Revive"], 940_000),
  f("Magma", "Rare", "Elemental", 1300, undefined, 960_000),

  // ---- Legendary (11) ----
  f("Quake", "Legendary", "Natural", 1500, undefined, 1_000_000),
  f("Buddha", "Legendary", "Beast", 1650, undefined, 1_200_000),
  f("Love", "Legendary", "Natural", 1700),
  f("Creation", "Legendary", "Natural", 1750, ["Barrier"]),
  f("Spider", "Legendary", "Natural", 1800),
  f("Sound", "Legendary", "Natural", 1900),
  f("Phoenix", "Legendary", "Beast", 2000),
  f("Portal", "Legendary", "Natural", 2000, undefined, 1_900_000),
  f("Lightning", "Legendary", "Elemental", 2100, ["Rumble"]),
  f("Pain", "Legendary", "Natural", 2200),
  f("Blizzard", "Legendary", "Elemental", 2250, undefined, 2_400_000),

  // ---- Mythical (15, including Magnet from Update 30) ----
  f("Gravity", "Mythical", "Natural", 2300),
  f("Mammoth", "Mythical", "Beast", 2350),
  f("T-Rex", "Mythical", "Beast", 2350),
  f("Dough", "Mythical", "Natural", 2400),
  f("Shadow", "Mythical", "Elemental", 2425),
  f("Venom", "Mythical", "Natural", 2450),
  f("Gas", "Mythical", "Elemental", 2500),
  f("Spirit", "Mythical", "Natural", 2550, undefined, 3_400_000),
  f("Tiger", "Mythical", "Beast", 3000, ["Leopard"]),
  f("Yeti", "Mythical", "Beast", 3000),
  f("Kitsune", "Mythical", "Beast", 4000),
  f("Control", "Mythical", "Natural", 4000),
  // Update 30, September 2026. Natural type, Mythical, 6,000,000 Beli at the
  // Dealer or 3,500 Robux permanent (2,800 with Plus). Its trade value is a
  // band rather than a number — see values.ts — because it is a month old and
  // the market has not decided yet. Art is the in-game fruit model.
  {
    ...f("Magnet", "Mythical", "Natural", 3500, undefined, 6_000_000),
    art: "/items/bf-magnet.jpg",
    aliases: ["magnet", "magnetism", "update 30"],
    note: "Added in Update 30. Value is still settling \u2014 new fruits fall once everyone has one.",
  },
  // West and East are two separate fruits with separate moves, separate values
  // and separate Permanent forms — a Permanent West is not a Permanent East.
  // Listing them as one "Dragon" would silently price one as the other.
  // "Dragon" on its own is an alias for both, so searching it finds the pair
  // and the player picks — better than guessing which one they meant.
  { ...f("West Dragon", "Mythical", "Beast", 5000), aliases: ["Dragon", "West", "Dragon West"] },
  { ...f("East Dragon", "Mythical", "Beast", 5000), aliases: ["Dragon", "East", "Dragon East"] },
];

/**
 * Shop products — gamepasses and the two scroll bundles.
 *
 * These trade alongside fruits in every Blox Fruits trading community, so a
 * catalogue without them is only half a catalogue. Names and Robux prices are
 * the wiki's own, not rounded or paraphrased: "2x Boss Drops Chance", not
 * "2x Drop Chance".
 *
 * Rarity is Premium across the board because that is what these are: bought,
 * not dropped. Guessing a drop tier for a gamepass would be inventing data —
 * Dark Blade grants a Mythical sword, but the pass itself has no tier.
 */
const shopProduct = (
  name: string,
  robux: number,
  category: "Gamepass" | "Scroll",
  note: string,
  aliases?: readonly string[],
): CatalogItem => ({
  id: `bf-${category === "Scroll" ? "scroll" : "gp"}-${
    name.toLowerCase().replace(/[^a-z0-9]+/g, "-")
  }`,
  gameSlug: "blox-fruits",
  name,
  category,
  rarity: "Premium",
  robux,
  aliases,
  note,
  verified: true,
});

const BLOX_GAMEPASSES: CatalogItem[] = [
  shopProduct("2x Boss Drops Chance", 350, "Gamepass",
    "Doubles the chance a boss drops a sword or accessory.",
    ["2x Drop Chance", "2x Boss Drops", "Double Boss Drops"]),
  shopProduct("Fast Boats", 350, "Gamepass",
    "Unlocks the Miracle and The Sentinel boats."),
  shopProduct("2x Money", 450, "Gamepass",
    "Doubles Beli from NPCs and quests. Chests are unaffected.",
    ["Double Money"]),
  shopProduct("2x Mastery", 450, "Gamepass",
    "Doubles mastery EXP from NPCs. Does not affect levels.",
    ["Double Mastery"]),
  shopProduct("Dark Blade", 1200, "Gamepass",
    "Grants the Mythical Dark Blade, upgradable through The Son Quest.",
    ["Yoru", "DB"]),
  shopProduct("Fruit Notifier", 2700, "Gamepass",
    "Reports the distance to a fruit the moment it spawns in your server.",
    ["Notifier"]),
  shopProduct("+1 Fruit Storage", 400, "Gamepass",
    "One extra inventory slot. Stacks — buy and trade it many times over.",
    ["Fruit Storage", "Storage", "+1 Storage"]),
];

/**
 * Scrolls. Two bundles, and the count is part of the name because the bundle is
 * the unit that changes hands.
 */
const BLOX_SCROLLS: CatalogItem[] = [
  shopProduct("5x Legendary Scrolls", 800, "Scroll",
    "Rerolls a stat to a Legendary roll. Five per purchase.",
    ["Legendary Scroll", "Leg Scrolls", "Stat Reroll"]),
  shopProduct("3x Mythical Scrolls", 1500, "Scroll",
    "Rerolls a stat to a Mythical roll. Three per purchase.",
    ["Mythical Scroll", "Myth Scrolls", "Stat Reroll"]),
];

/**
 * Skins.
 *
 * Eight fruits have them: Dragon, Empyrean, Pain, Lightning, Portal, Diamond,
 * Eagle and Bomb. Each fruit's own default look heads its table and is kept
 * here for completeness, but it is not a separate item — it arrives with the
 * fruit — so it is marked untradeable and never reaches a listing picker.
 *
 * Rarity and CHROMATIC are recorded exactly as the wiki prints them, side by
 * side. They do not move together: Ruby Diamond is Rare while every other
 * Diamond skin is Uncommon, Blue Lightning is Common while its four reskins are
 * Legendary, and Crimson Empyrean is Mythical with no CHROMATIC at all.
 *
 * Players say these as "<skin> <fruit>" — "glacier eagle", "torment pain" — so
 * that is the name, with the bare skin word kept as a search alias.
 *
 * One correction worth recording: Crimson and Galaxy belong to *Empyrean*, the
 * Mythical mutation of Kitsune, not to Kitsune itself, and Ember is a Dragon
 * skin. They get mixed up constantly.
 */
const skin = (
  fruit: string,
  parentId: string,
  name: string,
  rarity: Rarity | undefined,
  chromatic: boolean,
  opts: { base?: boolean; note?: string; unverified?: boolean } = {},
): CatalogItem => ({
  id: `bf-skin-${(name === fruit ? fruit + "-base" : name + "-" + fruit)
    .toLowerCase().replace(/[^a-z0-9]+/g, "-")}`,
  gameSlug: "blox-fruits",
  // A default skin often shares the fruit's own name, which would read as
  // "Bomb Bomb"; say Base instead.
  name: name === fruit ? `${fruit} (Base)` : `${name} ${fruit}`,
  category: "Skin",
  rarity,
  chromatic: chromatic || undefined,
  type: fruit,
  parentId,
  aliases: name === fruit ? undefined : [name],
  tradeable: opts.base ? false : undefined,
  note: opts.base
    ? "The fruit's default look — comes with the fruit, not traded separately."
    : opts.note,
  // A skin that is definitely in the game but whose tier I have not read is
  // still a real, tradeable item — it just gets flagged in admin so the gap
  // gets filled deliberately rather than discovered by a player mid-trade.
  verified: opts.unverified ? false : true,
});

const BLOX_SKINS: CatalogItem[] = [
  // ---- Bomb — default plus four CHROMATIC, all Common ----
  skin("Bomb", "bf-bomb", "Bomb", "Common", false, { base: true }),
  skin("Bomb", "bf-bomb", "Nuclear", "Common", true),
  skin("Bomb", "bf-bomb", "Thermite", "Common", true),
  skin("Bomb", "bf-bomb", "Azura", "Common", true),
  skin("Bomb", "bf-bomb", "Celebration", "Common", true),

  // ---- Diamond — Ruby is Rare, the rest Uncommon ----
  skin("Diamond", "bf-diamond", "Diamond", "Uncommon", false, { base: true }),
  skin("Diamond", "bf-diamond", "Emerald", "Uncommon", true),
  skin("Diamond", "bf-diamond", "Rose Quartz", "Uncommon", true),
  skin("Diamond", "bf-diamond", "Topaz", "Uncommon", true),
  skin("Diamond", "bf-diamond", "Ruby", "Rare", true),

  // ---- Eagle — three CHROMATIC, all Uncommon ----
  skin("Eagle", "bf-eagle", "Eagle", "Uncommon", false, { base: true }),
  skin("Eagle", "bf-eagle", "Glacier", "Uncommon", true),
  skin("Eagle", "bf-eagle", "Requiem", "Uncommon", true),
  skin("Eagle", "bf-eagle", "Matrix", "Uncommon", true),

  // ---- Lightning — the default is Common, the four reskins Legendary ----
  skin("Lightning", "bf-lightning", "Blue", "Common", false, { base: true }),
  skin("Lightning", "bf-lightning", "Purple", "Legendary", true),
  skin("Lightning", "bf-lightning", "Yellow", "Legendary", true),
  skin("Lightning", "bf-lightning", "Green", "Legendary", true),
  skin("Lightning", "bf-lightning", "Red", "Legendary", true),

  // ---- Pain — Agony is the default and is Common, not CHROMATIC ----
  skin("Pain", "bf-pain", "Agony", "Common", false, { base: true }),
  skin("Pain", "bf-pain", "Sadness", "Legendary", true),
  skin("Pain", "bf-pain", "Torment", "Legendary", true),
  skin("Pain", "bf-pain", "Frustration", "Legendary", true),
  skin("Pain", "bf-pain", "Celestial", "Legendary", true),
  skin("Pain", "bf-pain", "Super Spirit", "Legendary", true),

  // ---- Portal ----
  skin("Portal", "bf-portal", "Portal", "Legendary", false, { base: true }),
  skin("Portal", "bf-portal", "Divine", "Legendary", true),

  // ---- Empyrean — Kitsune's mutation. Crimson carries no CHROMATIC ----
  skin("Empyrean", "bf-kitsune", "Crimson", "Mythical", false),
  skin("Empyrean", "bf-kitsune", "Galaxy", "Mythical", true),

  // ---- Dragon ----
  // These hang off West Dragon, which is the fruit the skins were released for.
  // Rarity is left blank on the ones I could not read a tier for rather than
  // guessed — blank shows as "not set" in admin and is one tap to fill in.
  skin("Dragon", "bf-west-dragon", "Ember", undefined, true, {
    note: "Winter 2025 Fruit Box, 1% chance.",
  }),
  skin("Dragon", "bf-west-dragon", "Eclipse", undefined, true, { unverified: true }),
  skin("Dragon", "bf-west-dragon", "Blood Moon", undefined, true, { unverified: true }),
  skin("Dragon", "bf-west-dragon", "Violet Night", undefined, true, { unverified: true }),
  skin("Dragon", "bf-west-dragon", "Phoenix Sky", undefined, true, { unverified: true }),

  // ---- Eagle, continued ----
  skin("Eagle", "bf-eagle", "Parrot", undefined, true, { unverified: true }),
];

const make = (
  gameSlug: string,
  prefix: string,
  category: string,
  names: readonly [string, Rarity][],
): CatalogItem[] =>
  names.map(([name, rarity]) => ({
    id: `${prefix}-${name.toLowerCase().replace(/[^a-z0-9]+/g, "-")}`,
    gameSlug,
    name,
    category,
    rarity,
  }));

/**
 * The other five games.
 *
 * Less complete than Blox Fruits, and honestly so. Royale High's halos are
 * well documented and close to exhaustive; the rest carry the items their
 * communities trade most, which is what a listing flow actually needs to be
 * usable. `PARTIAL_CATALOGUES` names the ones still short so the interface can
 * say it rather than implying completeness.
 *
 * These grow through the admin surface, not through code edits.
 */


/**
 * Adopt Me. The wiki counts over thirty obtainable legendaries and far more
 * retired ones, so this is the trading core rather than the full list.
 */
const ADOPT_ME = [
  ...make("adopt-me", "am", "Pet", [
    ["Shadow Dragon", "Mythical"], ["Bat Dragon", "Mythical"],
    ["Frost Dragon", "Mythical"], ["Giraffe", "Mythical"],
    ["Parrot", "Legendary"], ["Crow", "Legendary"],
    ["Owl", "Legendary"], ["Evil Unicorn", "Legendary"],
    ["Turtle", "Legendary"], ["Kangaroo", "Legendary"],
    ["Unicorn", "Legendary"], ["Dragon", "Legendary"],
    ["Griffin", "Legendary"], ["Arctic Reindeer", "Legendary"],
    ["Golden Dragon", "Legendary"], ["Diamond Dragon", "Legendary"],
    ["Cerberus", "Legendary"], ["Shark", "Ultra-Rare"],
  ] as [string, Rarity][]),
  ...make("adopt-me", "am", "Egg", [
    ["Royal Egg", "Legendary"], ["Cracked Egg", "Common"],
    ["Pet Egg", "Uncommon"], ["Fairytale Egg", "Rare"],
  ] as [string, Rarity][]),
  ...make("adopt-me", "am", "Vehicle", [
    ["Rainbow Bicycle", "Rare"], ["Golden Scooter", "Rare"],
  ] as [string, Rarity][]),
];

/**
 * Pet Simulator 99. Huge, Titanic and Gargantuan are subgroups of the
 * Exclusive rarity rather than rarities in their own right, so they are
 * recorded as the category and the rarity stays Exclusive-equivalent.
 */
const PS99 = [
  ...make("pet-simulator-99", "ps", "Huge", [
    ["Huge Cat", "Mythical"], ["Huge Pixel Cat", "Mythical"],
    ["Huge Dragon", "Mythical"], ["Huge Hacked Cat", "Mythical"],
    ["Huge Balloon Cat", "Mythical"], ["Huge Storm Agony", "Mythical"],
    ["Huge Festive Cat", "Mythical"], ["Huge Lucky Cat", "Mythical"],
  ] as [string, Rarity][]),
  ...make("pet-simulator-99", "ps", "Titanic", [
    ["Titanic Pegasus", "Mythical"], ["Titanic Jolly Penguin", "Mythical"],
    ["Titanic Bunny", "Mythical"],
  ] as [string, Rarity][]),
  ...make("pet-simulator-99", "ps", "Enchant", [
    ["Ultra Lucky", "Legendary"], ["Team Up", "Legendary"],
    ["Coins Master", "Legendary"], ["Treasure Hunter", "Legendary"],
  ] as [string, Rarity][]),
];


/**
 * Creatures of Sonaria. Value here comes from species, mutation, age, gender
 * and palette together, so the catalogue names the species and the listing
 * carries the rest.
 */
const SONARIA = [
  ...make("creatures-of-sonaria", "cs", "Creature", [
    ["Kavouradis", "Mythical"], ["Boreacal", "Legendary"],
    ["Nyctosaurus", "Legendary"], ["Aurelvis", "Legendary"],
    ["Sarco", "Rare"], ["Vithura", "Rare"],
    ["Eigion", "Legendary"], ["Menace", "Mythical"],
    ["Hyaenire", "Rare"], ["Vahid", "Legendary"],
  ] as [string, Rarity][]),
  ...make("creatures-of-sonaria", "cs", "Plushie", [
    ["Plushie Token", "Rare"],
  ] as [string, Rarity][]),
];

/**
 * Games whose catalogue is knowingly incomplete. Surfaced in the interface.
 *
 * Pet Simulator 99 and Creatures of Sonaria came off this list when the
 * machine pull landed: PS99 now carries its developer's entire published
 * roster, and Sonaria's 482 creatures match the wiki's own stated 481. Fisch
 * joined it — 1,426 fish is effectively complete, but its cosmetics are not,
 * and a player browsing rod skins is seeing 96 of roughly 531.
 */
export const PARTIAL_CATALOGUES: readonly string[] = [
  "adopt-me", "fisch",
];

/* ------------------------------------------------------------------ */
/* Fisch                                                              */
/* ------------------------------------------------------------------ */

/**
 * Fisch is far too big to hand-type, so this is the part worth hand-typing.
 *
 * The wiki holds somewhere between 1,254 and 1,619 fish depending on which
 * question you are asking — 1,254 is what the in-game Bestiary tracks toward
 * completion, 1,619 is every rarity subcategory added up including limited and
 * extinct, and 1,585 is the master category page. All three are correct and
 * they measure different things, which is why no single number appears in the
 * interface as "the" count.
 *
 * What IS here is every fish in the four tiers players actually chase and
 * trade: Divine Secret, Apex, Secret and Exotic. Those are the rows a trade
 * listing will name. Everything below them — the thousand-odd Common through
 * Mythical fish — is bulk that belongs in a machine pull from the wiki's own
 * Lua modules, not in a file a person maintains by hand.
 *
 * All four tiers map to Mythical on MintPlaza's seven-step scale. That is not
 * laziness: Fisch has eighteen tiers and we have seven, and every one of these
 * four is endgame chase content. Flattening them into one bucket and keeping
 * the real tier in `type` is more honest than inventing three new steps to
 * preserve a ranking players do not agree on either.
 */
const fisch = (
  name: string,
  tier: "Divine Secret" | "Apex" | "Secret" | "Exotic",
  aliases?: readonly string[],
): CatalogItem => ({
  id: `fisch-${name.toLowerCase().replace(/[^a-z0-9]+/g, "-") || "emoji"}`,
  gameSlug: "fisch",
  name,
  category: "Fish",
  rarity: "Mythical",
  type: tier,
  aliases,
  verified: true,
});

/** 11 of 11. Category:Divine_Secret_Fish, edited 9 March 2026. */
const FISCH_DIVINE: CatalogItem[] = [
  fisch("Aetherfin", "Divine Secret"),
  fisch("Boulder", "Divine Secret"),
  fisch("Cataclysm Carp", "Divine Secret", ["carp"]),
  fisch("Crustal Colossus", "Divine Secret", ["crustal"]),
  fisch("Forbidden Plesiosaur", "Divine Secret", ["forbidden plesio"]),
  { ...fisch("Him", "Divine Secret"), formerly: ["Secret Him"] },
  fisch("Lumilotl", "Divine Secret", ["axolotl"]),
  fisch("Paradox Piranha", "Divine Secret", ["paradox"]),
  fisch("Razorfin", "Divine Secret"),
  fisch("Seraphfin", "Divine Secret", ["seraph"]),
  fisch("Tuskmaw", "Divine Secret"),
];

/** 11 of 11. Category:Apex_Fish, edited 24 March 2026. */
const FISCH_APEX: CatalogItem[] = [
  fisch("Akkorokamui", "Apex", ["akko"]),
  fisch("Ashclaw", "Apex"),
  fisch("Beluga", "Apex"),
  fisch("Bloop Fish", "Apex", ["bloop"]),
  fisch("Charybdis", "Apex"),
  fisch("Dreadfin", "Apex"),
  fisch("Lusca", "Apex"),
  fisch("Magician Narwhal", "Apex", ["magician"]),
  fisch("Mosslurker", "Apex"),
  fisch("Narwhal", "Apex"),
  fisch("Skeletal Serpent", "Apex"),
];

/** 40 of 40. Category:Secret_Fish, edited 24 March 2026. */
const FISCH_SECRET: CatalogItem[] = [
  fisch("Abyssborn Monstrosity", "Secret", ["abyssborn"]),
  fisch("Ancestral Pliosaur", "Secret"),
  fisch("Ancient Goldwraith", "Secret"),
  fisch("Ancient Kraken", "Secret"),
  fisch("Ancient Orca", "Secret"),
  fisch("Awakened Omnithal", "Secret", ["omnithal"]),
  fisch("Banana", "Secret"),
  fisch("Blight Idol", "Secret"),
  fisch("Bloop Cosmetic Crate", "Secret"),
  fisch("Blue Sea Slug", "Secret", ["sea slug"]),
  fisch("Caustic Starwyrm", "Secret", ["starwyrm"]),
  fisch("Colossal Ethereal Dragon", "Secret"),
  fisch("Colossus Reef Titan", "Secret"),
  fisch("Crag-Crab", "Secret", ["crag crab"]),
  fisch("Elder Mossjaw", "Secret"),
  { ...fisch("Friend Fish", "Secret"), formerly: ["Legendary Friend Fish"] },
  fisch("Gem Blobfish", "Secret"),
  fisch("Grandpa Horseshoe Crab", "Secret", ["horseshoe crab"]),
  fisch("Great Goldcursed Shark", "Secret", ["goldcursed shark"]),
  fisch("Long Pike", "Secret"),
  fisch("Manatee", "Secret"),
  fisch("Moby", "Secret"),
  fisch("Molten Ripple", "Secret"),
  fisch("Moon Idol", "Secret"),
  fisch("Mustard", "Secret"),
  fisch("Oakling", "Secret"),
  fisch("Olympian Devil", "Secret"),
  fisch("Photic Terrosunder", "Secret"),
  fisch("Pirate Captain's Goldfish", "Secret", ["captains goldfish"]),
  fisch("Profane Leviathan", "Secret"),
  fisch("Resin", "Secret"),
  fisch("Scylla", "Secret"),
  fisch("Toxic Guardian", "Secret"),
  fisch("Witherbloom", "Secret"),
  // Six fish whose names are a single emoji. They are real entries in the
  // Secret category and players trade them, so the name is kept exactly as the
  // game prints it and the alias carries the word — otherwise nobody could
  // search for them, because nobody types an emoji into a search box.
  { ...fisch("\u{1F40B}", "Secret", ["whale emoji", "emoji whale"]), id: "fisch-emoji-whale" },
  { ...fisch("\u{1F41F}", "Secret", ["fish emoji", "emoji fish"]), id: "fisch-emoji-fish" },
  { ...fisch("\u{1F421}", "Secret", ["pufferfish emoji"]), id: "fisch-emoji-pufferfish" },
  { ...fisch("\u{1F988}", "Secret", ["shark emoji"]), id: "fisch-emoji-shark" },
  { ...fisch("\u{1F98B}", "Secret", ["butterfly emoji"]), id: "fisch-emoji-butterfly" },
  { ...fisch("\u{1F991}", "Secret", ["squid emoji"]), id: "fisch-emoji-squid" },
];

/**
 * 54 of 67. Category:Fish_by_Rarity counts 67 Exotic fish; the dedicated
 * Category:Exotic_Fish page has not been edited since December 2024 and lists
 * 59. The thirteen missing names are missing on purpose rather than padded out.
 */
const FISCH_EXOTIC: CatalogItem[] = [
  "Abaia", "Blobfish", "Blue Whale", "Boots", "Brine Sovereign", "Carrot Shark",
  "Cathulid", "Cathulith", "Cave Angel Fish", "Colossal Ancient Dragon",
  "Colossal Blue Dragon", "Crowned Anglerfish", "Crystallized Seadragon",
  "Dreaming Aberration", "Flower Guardian", "Frostwyrm", "Frozen Leviathan",
  "Golden Sea Pearl", "Goldfin Octopus", "Goldwraith", "Helios Sunray",
  "Humpback Whale", "Igneous Pearl", "Kerauno Wyrm", "Key of Oaths",
  "Key of Whispers", "Legionnaire Lamprey", "Leviathan", "Lithodes Megacantha",
  "Livyatan", "Magma Leviathan", "Megalodon", "Molten Banshee", "Mossjaw",
  "Omnithal", "Orca", "Plesiosaur", "Pliosaur", "Queen Bee Serpent",
  "Reef Titan", "RocketFuel", "Rotbloom", "Scalloped Hammerhead",
  "Skeletal Leviathan", "Speed Core", "Styx Angler", "Tartaruga", "Terrosunder",
  "The Depths Key", "The Kraken", "Tidecrasher Archon", "Treble Bass",
  "White Sturgeon", "Wyvern",
].map((n) => fisch(n, "Exotic"));

/**
 * The four things in Fisch that are NOT tradeable, as catalogue rows.
 *
 * They are here rather than omitted because a player browsing rods expects to
 * see rods, and finding nothing reads as a broken page. `tradeable: false`
 * keeps every one of them out of the listing picker, which is the difference
 * between a reference and an invitation to a trade that cannot complete.
 *
 * This is the single most expensive confusion in the game: there are 261
 * fishing ROD pages and 531 rod SKIN pages, the names overlap constantly, and
 * the skin trades while the rod it dresses never does.
 */
const FISCH_UNTRADEABLE: CatalogItem[] = [
  { id: "fisch-rods", gameSlug: "fisch", name: "Fishing rods", category: "Relics",
    note: "261 rods. None of them trade — only the SKIN that dresses a rod does. Listed so the difference is visible.",
    tradeable: false, verified: true },
  { id: "fisch-totems", gameSlug: "fisch", name: "Totems", category: "Relics",
    note: "28 totems, 2 of them unobtainable. The wiki is explicit: a player cannot trade totems.",
    tradeable: false, verified: true },
  { id: "fisch-bait", gameSlug: "fisch", name: "Bait", category: "Relics",
    note: "25 kinds. Not in the trade menu.",
    tradeable: false, verified: true },
  { id: "fisch-enchant-relic", gameSlug: "fisch", name: "Enchant Relic", category: "Relics",
    rarity: "Ultra-Rare",
    note: "A Relic-rarity fish, so the loose one trades like any other fish — sells for 3,500 C$, buys from Merlin for 11,000 past Level 30. Applied to a rod it stops being an item and stops being tradeable.",
    aliases: ["relic", "enchant", "relics"], verified: true },
];

const FISCH_CATALOG: CatalogItem[] = [
  ...FISCH_DIVINE, ...FISCH_APEX, ...FISCH_SECRET, ...FISCH_EXOTIC,
  ...FISCH_UNTRADEABLE,
];

/* ------------------------------------------------------------------ */
/* Grow a Garden 2                                                    */
/* ------------------------------------------------------------------ */

/**
 * All 33 seeds and crops, cross-checked between two sources.
 *
 * The rarity column needed a decision. GAG2's native ladder has an Epic tier
 * where MintPlaza has Ultra-Rare, and a Super tier above Mythic where we stop
 * at Premium — so Epic maps to Ultra-Rare and Super maps to Premium. Secret
 * (Kitsune) is not a power level at all, it is a classification, so it gets no
 * rarity rather than a wrong one.
 *
 * `verified: false` on nine rows is doing real work: those are the seeds whose
 * cost or rarity the sources genuinely disagree about. Venus Fly Trap is the
 * only Mythic whose price is confirmed (7,000,000 Sheckles, or 799 Robux);
 * every other Mythic and Super price circulating online comes from third-party
 * lists that contradict each other by a factor of three, so none of them is
 * written down here.
 */
const gag2 = (
  name: string,
  category: string,
  rarity: Rarity | undefined,
  note: string,
  verified = true,
): CatalogItem => ({
  id: `gag2-${name.toLowerCase().replace(/[^a-z0-9]+/g, "-")}`,
  gameSlug: "gag2",
  name,
  category,
  rarity,
  note,
  verified,
});

const GAG2_CATALOG: CatalogItem[] = [
  gag2("Carrot", "Seed", "Common", "1 Sheckle, multi-harvest, always in stock"),
  gag2("Strawberry", "Seed", "Common", "5 Sheckles, multi-harvest, always in stock"),
  gag2("Blueberry", "Seed", "Common", "10 Sheckles, multi-harvest, always in stock"),
  gag2("Tomato", "Seed", "Common", "25 Sheckles, multi-harvest, always in stock"),
  gag2("Apple", "Seed", "Common", "50 Sheckles, multi-harvest"),
  gag2("Tulip", "Seed", "Common", "50 Sheckles, single harvest"),
  gag2("Green Bean", "Seed", "Rare", "Free from the starter code. Sources split on the tier — older lists say Rare, current ones say Epic. Unresolved.", false),
  gag2("Corn", "Seed", "Uncommon", "100 Sheckles, single harvest"),
  gag2("Grape", "Seed", "Uncommon", "100 Sheckles, multi-harvest"),
  gag2("Banana", "Seed", "Uncommon", "150 Sheckles, multi-harvest"),
  gag2("Coconut", "Seed", "Uncommon", "150 Sheckles, multi-harvest"),
  gag2("Pineapple", "Seed", "Uncommon", "200 Sheckles, multi-harvest"),
  gag2("Cactus", "Seed", "Uncommon", "250 Sheckles, multi-harvest. Defensive — slows a thief down."),
  gag2("Bamboo", "Seed", "Rare", "700 Sheckles, single harvest. Cannot be stolen at night."),
  gag2("Watermelon", "Seed", "Rare", "900 Sheckles, multi-harvest"),
  gag2("Sunflower", "Seed", "Rare", "1,150 Sheckles, multi-harvest"),
  gag2("Poison Ivy", "Seed", "Rare", "Pack only, multi-harvest"),
  gag2("Horned Melon", "Seed", "Rare", "Pack only, multi-harvest"),
  gag2("Baby Cactus", "Seed", "Uncommon", "Pack only, defensive"),
  gag2("Mushroom", "Seed", "Ultra-Rare", "15,000 Sheckles, single harvest. Native Epic tier, and the best early return in the game."),
  gag2("Glow Mushroom", "Seed", "Ultra-Rare", "Ghost Pepper Pack, 15% pull. Native Epic. Same stats as Mushroom, different look — easy to mix up."),
  gag2("Mango", "Seed", "Ultra-Rare", "300,000 Sheckles, multi-harvest. Native Epic tier."),
  gag2("Dragon Fruit", "Seed", "Legendary", "120,000 Sheckles, single harvest"),
  gag2("Acorn", "Seed", "Legendary", "250 Sheckles, multi-harvest"),
  gag2("Cherry", "Seed", "Legendary", "1,150 Sheckles, multi-harvest"),
  gag2("Venus Fly Trap", "Seed", "Mythical", "7,000,000 Sheckles or 799 Robux, 1.43% stock chance. Defensive. The only Mythic whose price is confirmed on the official wiki."),
  gag2("Ghost Pepper", "Seed", "Mythical", "Ghost Pepper Pack, 1% pull. Defensive."),
  gag2("Dragon's Breath", "Seed", "Mythical", "Fires at thieves. Cost unconfirmed — circulating figures range from 90M to 225M Sheckles and the sources contradict each other.", false),
  gag2("Venom Spitter", "Seed", "Mythical", "Added in v1.01.0, the strongest defence in the game. Cost unconfirmed.", false),
  gag2("Pomegranate", "Seed", "Mythical", "Cost unconfirmed.", false),
  gag2("Poison Apple", "Seed", "Mythical", "Defensive. Cost unconfirmed.", false),
  gag2("Moon Bloom", "Crop", "Premium", "Native Super tier, above Mythic. Around 9,000 Sheckles average per harvest. Cost unconfirmed.", false),
  gag2("Beanstalk", "Crop", "Premium", "Native Super tier, rare restock. No source found a price at all.", false),
  gag2("Gold Seed", "Mutation Item", undefined, "Free during the Midas Moon night event. Guarantees a Gold mutation — which is not the same thing as the Gold mutation itself."),
  gag2("Rainbow Seed", "Mutation Item", undefined, "Free during the Rainbow Moon night event. Guarantees a Rainbow mutation."),
];


/* ------------------------------------------------------------------ */
/* Grow a Garden 2 — pets, eggs and the two things that never move     */
/* ------------------------------------------------------------------ */

/**
 * The pets, and an honest word about their rarities.
 *
 * Four sources count the roster at 22, 30, 35 and 36. That disagreement is
 * real and it is not resolvable from outside the game — but it is a fact about
 * the TOTAL, not about the individual pets, and the named ones below are
 * confirmed by name and by what they do. Leaving twenty-four confirmed pets
 * out of a trading catalogue because nobody agrees how many there are in total
 * would be a worse kind of dishonesty than shipping them and saying the list is
 * incomplete.
 *
 * So: names and abilities are confirmed and carry `verified: true`. Rarities
 * mostly are not, and those rows carry no rarity at all rather than a guessed
 * one — the tile falls back to type, which reads fine and claims nothing.
 *
 * The rarity mapping where it IS known follows the game's own ladder onto
 * MintPlaza's seven: Epic sits between Rare and Legendary so it becomes
 * Ultra-Rare, and Super is the top power tier so it becomes Premium. Secret is
 * not a power level at all — it is a classification — so Kitsune gets `type`
 * and no rarity.
 */
const gag2pet = (
  name: string,
  note: string,
  rarity?: Rarity,
  opts: { type?: string; verified?: boolean; aliases?: readonly string[] } = {},
): CatalogItem => ({
  id: `gag2-pet-${name.toLowerCase().replace(/[^a-z0-9]+/g, "-")}`,
  gameSlug: "gag2",
  name,
  category: "Pet",
  rarity,
  type: opts.type,
  note,
  aliases: opts.aliases,
  verified: opts.verified ?? true,
});

const GAG2_PETS: CatalogItem[] = [
  // ---- the ones everybody is chasing ----
  gag2pet("Kitsune", "Secret. Multiplies Chakra by 60 on fruit stolen at night. Secret is a classification, not a power tier, which is why this row carries no rarity.", undefined, { type: "Secret" }),
  gag2pet("Shadow Dragon", "Super tier, from the Fall Harvest world. Chance of a Veil x50 when sowing. Spawn rate reported at 0.00464%.", "Premium"),
  gag2pet("Ice Serpent", "Super tier, guild leaderboard reward, and a defender. It trades — but as a rare-and-above pet it cannot be sent through the Mailbox, so it has to be dropped or moved inside a guild.", "Premium"),
  gag2pet("Black Dragon", "Super tier, guild leaderboard reward, and a defender. Same as Ice Serpent: tradeable, but not mailable.", "Premium"),
  gag2pet("Golden Dragonfly", "Mythic mutator. Doubles the chance of a Gold mutation.", "Mythical"),
  gag2pet("Unicorn", "Doubles the chance of a Rainbow mutation. Sources disagree on its tier: one calls it a Mythic mutator, another a pull from the Epic Egg. The egg a pet comes out of is not its rarity, so this is unresolved.", "Mythical", { verified: false }),
  gag2pet("Big Jandel Monkey", "Event pet. One value list puts it at the very top of the game at around 50,000 Sheckle-points while another puts Mega Ice Serpent there instead. Unresolved.", undefined, { verified: false, aliases: ["jandel monkey", "jandel"] }),

  // ---- the working pets ----
  gag2pet("Raccoon", "Steals from other gardens at night. Roughly a 0.2% pull from the Common Egg, which makes it the rarest thing in a cheap egg.", undefined, { verified: false }),
  gag2pet("Monkey", "Auto-harvests while you are away. The AFK pet.", undefined, { verified: false }),
  gag2pet("Deer", "Speeds up crop growth.", undefined, { verified: false }),
  gag2pet("Owl", "Night vision — you can see raiders coming.", undefined, { verified: false }),
  gag2pet("Capybara", "Stops your pets losing XP.", undefined, { verified: false }),
  gag2pet("Bee", "Defender. Goes after anyone in your garden at night.", undefined, { verified: false }),
  gag2pet("Bear", "Defender.", undefined, { verified: false }),
  gag2pet("Frog", "Early-game movement speed.", undefined, { verified: false }),
  gag2pet("Bunny", "Early-game movement speed.", undefined, { verified: false }),
  gag2pet("Robin", "Egg pet.", undefined, { verified: false }),

  // ---- Muffin Bake update, 22 August 2026 ----
  gag2pet("Sugar Bunny", "Added in the Muffin Bake update, 22 August 2026.", undefined, { verified: false }),
  gag2pet("Chocolate Lab", "Added in the Muffin Bake update, 22 August 2026.", undefined, { verified: false }),
  gag2pet("Fat Cat", "Added in the Muffin Bake update, 22 August 2026.", undefined, { verified: false }),
  gag2pet("Chicken", "Added in the Muffin Bake update, 22 August 2026.", undefined, { verified: false }),
  gag2pet("Muffin Man", "Added in the Muffin Bake update, 22 August 2026.", undefined, { verified: false }),

  // ---- Fall Harvest ----
  gag2pet("Dog", "Added with the Fall Harvest world, 2 August 2026.", undefined, { verified: false }),
  gag2pet("Hedgehog", "Added with the Fall Harvest world, 2 August 2026.", undefined, { verified: false }),
];

/**
 * All ten eggs. The roster is confirmed; the pull odds are not.
 *
 * Nobody publishes the odds for the guild-reward eggs — the figures circulating
 * are extrapolated by third-party calculators from small samples — so this says
 * what each egg is for and stops there.
 */
const gag2egg = (name: string, note: string, verified = true): CatalogItem => ({
  id: `gag2-egg-${name.toLowerCase().replace(/[^a-z0-9]+/g, "-")}`,
  gameSlug: "gag2", name, category: "Egg", note, verified,
});

const GAG2_EGGS: CatalogItem[] = [
  gag2egg("Common Egg", "The cheap one. Pulls Frogs, Bunnies, Golden Dragonfly, and Raccoon at roughly 0.2%."),
  gag2egg("Epic Egg", "Pulls Unicorn at roughly 30%."),
  gag2egg("Big Egg", "Guild reward. Produces Big-variant pets.", false),
  gag2egg("Mega Egg", "Guild reward, Super tier. Around a dozen Mega pets come out of it.", false),
  gag2egg("Rainbow Egg", "Guild reward. Produces Rainbow-variant pets.", false),
  gag2egg("Exclusive Harvest Egg", "Limited.", false),
  gag2egg("Fall Common Egg", "Fall Harvest variant.", false),
  gag2egg("Fall Big Egg", "Fall Harvest variant.", false),
  gag2egg("Fall Mega Egg", "Fall Harvest variant.", false),
  gag2egg("Fall Rainbow Egg", "Fall Harvest variant.", false),
];

/**
 * The two things in GAG2 that cannot move between players at all.
 *
 * Here for the same reason Fisch's rods are here: a player looking for a way to
 * send somebody Sheckles should find the answer on the page rather than by
 * trying it. `tradeable: false` keeps both out of every listing picker.
 */
const GAG2_UNTRADEABLE: CatalogItem[] = [
  { id: "gag2-sheckles", gameSlug: "gag2", name: "Sheckles", category: "Crate",
    note: "The main currency. Cannot be gifted, mailed or dropped. There is no way to send another player money in this game.",
    tradeable: false, verified: true, aliases: ["money", "currency", "cash"] },
  { id: "gag2-leaves", gameSlug: "gag2", name: "Leaves", category: "Crate",
    note: "The Fall Harvest world's own currency. Also cannot be transferred.",
    tradeable: false, verified: true },
];

/* ------------------------------------------------------------------ */
/* Grow a Garden 2 — cosmetics                                         */
/* ------------------------------------------------------------------ */

/**
 * The category the catalogue was missing entirely.
 *
 * Before this block GAG2 had 296 rows across Crop, Pet, Egg, Gear, Crate,
 * Chest and Pack — and not one cosmetic. The machine pull carried "Boombox
 * Crate", "Bench Crate" and "Conveyor Crate" but none of the boomboxes,
 * benches or conveyors that come out of them, so a player who opened a crate
 * could not list what they got. That is the whole decorative economy of the
 * game, and it is the half that actually trades: the crate is consumed, the
 * cosmetic is the thing you keep.
 *
 * Source is gag2.gg's own Cosmetics tab, read in September 2026. Four rows
 * carry a published number and are priced in values.ts; the rest show N/A
 * there, which means nobody has a figure, not that the figure is zero. They
 * are listable and unpriced, which is exactly the state the verdict path
 * already refuses to guess at.
 *
 * `type` carries the group — Fence, Bench, Bridge — because "Small Arch",
 * "Wood Arch" and "White Arch" are otherwise three names with no shared
 * handle, and the group is what a player searching for a set actually wants.
 *
 * Two names the site files here are deliberately NOT repeated: Sign and
 * Weather Machine already exist in the pull as Gear. A curated row wins its
 * name outright, so adding them would silently re-file two existing rows on
 * the strength of one screenshot. They stay where they are, findable.
 */
const gag2cos = (
  name: string,
  group: string,
  rarity?: Rarity,
  opts: { aliases?: readonly string[]; verified?: boolean; note?: string } = {},
): CatalogItem => ({
  id: `gag2-cosmetic-${name.toLowerCase().replace(/[^a-z0-9]+/g, "-")}`,
  gameSlug: "gag2",
  name,
  category: "Cosmetic",
  rarity,
  type: group,
  note: opts.note ?? `${group}. Listed on gag2.gg's cosmetics tab; no value published there.`,
  aliases: opts.aliases,
  verified: opts.verified ?? true,
});

/**
 * The fences are the one place this list renames what the source shows.
 *
 * gag2.gg lists them by their bare variant word — "Wood", "Stone", "Star",
 * "White", "Light" — because on that site they sit under a Fence heading that
 * supplies the noun. Pulled out of that context those are not item names, they
 * are adjectives: a row called "Light" would surface above Moss Light and Star
 * Lights for the query "light", and a row called "Wood" would outrank Wood
 * Floor, Wood Wall, Wood Arch and Wood Barrel for "wood". So each gets the
 * noun back, and keeps the site's bare label as an alias so a player who reads
 * the value list still finds it by the word they saw.
 *
 * Marked unverified because the grouping is read off the tile art and the
 * site's own section, not off a wiki page naming them.
 */
const fence = (variant: string): CatalogItem =>
  gag2cos(`${variant} Fence`, "Fence", undefined, {
    aliases: [variant.toLowerCase()],
    verified: false,
    note: `Fence. gag2.gg lists this as just "${variant}" under its fence heading; the noun is added back here so the name survives being searched for on its own.`,
  });

/**
 * One crate the pull missed.
 *
 * It matters because the picture frames are the only cosmetic line in this
 * game with a real market — the Mega is worth 165 against 2.5 for the Big —
 * and this is the crate they come out of. A catalogue that prices the drop but
 * cannot name the crate is missing the half of that trade a player actually
 * opens.
 */
const GAG2_CRATES: CatalogItem[] = [
  { id: "gag2-picture-frame-crate", gameSlug: "gag2", name: "Picture Frame Crate",
    category: "Crate", rarity: "Rare",
    note: "Drops the picture frames, including the Mega — the most valuable cosmetic on gag2.gg. Listed there as Rare.",
    verified: false },
];

const GAG2_COSMETICS: CatalogItem[] = [
  // ---- the only four with a published number ----
  gag2cos("Mega Picture Frame", "Picture Frame", undefined, {
    note: "The most valuable cosmetic on gag2.gg by a wide margin — 165 against 2.5 for the Big. Picture frames are the one cosmetic line with a real market.",
  }),
  gag2cos("Big Picture Frame", "Picture Frame"),
  gag2cos("Bookcase", "Prop"),
  gag2cos("Wood Floor", "Floor"),

  // ---- picture frames and wall decor ----
  gag2cos("Small Picture Frame", "Picture Frame"),

  // ---- floors and ground cover ----
  gag2cos("Carpet", "Floor"),
  gag2cos("Beach Towel", "Floor"),
  gag2cos("Large Spruce Floor", "Floor"),
  gag2cos("Medium Spruce Floor", "Floor"),
  gag2cos("Small Spruce Floor", "Floor"),

  // ---- signs ----
  gag2cos("Big Sign", "Sign"),
  gag2cos("Gold Sign", "Sign"),
  gag2cos("Rainbow Sign", "Sign"),

  // ---- fences, renamed. See `fence` above. ----
  fence("Default"),
  fence("Wood"),
  fence("Stone"),
  fence("White"),
  fence("Stick"),
  fence("Pole"),
  fence("Spike"),
  fence("Star"),
  fence("Flower"),
  fence("Light"),
  fence("Futuristic"),
  fence("Cupid"),

  // ---- conveyors: the one cosmetic line that runs the full rarity ladder ----
  gag2cos("Common Conveyor", "Conveyor", "Common"),
  gag2cos("Uncommon Conveyor", "Conveyor", "Uncommon"),
  gag2cos("Rare Conveyor", "Conveyor", "Rare"),
  gag2cos("Epic Conveyor", "Conveyor", "Ultra-Rare", {
    note: "Conveyor. GAG2's native Epic tier, which maps onto Ultra-Rare here — the same mapping the seeds and pets use.",
  }),
  gag2cos("Super Conveyor", "Conveyor", "Premium", {
    note: "Conveyor. Native Super tier, the top of GAG2's ladder, which maps onto Premium here.",
  }),

  // ---- walls ----
  gag2cos("Wood Wall", "Wall"),
  gag2cos("Strong Wall", "Wall"),
  gag2cos("Line Pattern Wall", "Wall"),
  gag2cos("Cross Pattern Wall", "Wall"),
  gag2cos("Cross Over Wall", "Wall"),
  gag2cos("Cobblestone Wall", "Wall"),
  gag2cos("Mossy Cobblestone Wall", "Wall"),
  gag2cos("Cobblestone Wall Corner", "Wall"),

  // ---- owner doors ----
  gag2cos("Oak Owner Door", "Door"),
  gag2cos("Dark Oak Owner Door", "Door"),
  gag2cos("Gold Owner Door", "Door"),
  gag2cos("Rainbow Owner Door", "Door"),

  // ---- teleport pads ----
  gag2cos("Teleport Pad", "Teleport Pad", undefined, {
    // The crate that drops this is called "Teleporter Pad Crate" and the
    // cosmetic is called "Teleport Pad". A player who just opened the crate
    // searches for the word on the crate, so that word has to resolve.
    aliases: ["teleporter pad"],
    note: "Teleport pad. Dropped by the Teleporter Pad Crate, which spells it with the extra -er. Not the Teleporter gear, which is a separate row under Gear and not interchangeable with this.",
  }),
  gag2cos("Big Teleport Pad", "Teleport Pad"),
  gag2cos("Huge Teleport Pad", "Teleport Pad"),

  // ---- ladders ----
  gag2cos("Ladder", "Ladder"),
  gag2cos("Dark Oak Ladder", "Ladder"),
  gag2cos("Gold Ladder", "Ladder"),
  gag2cos("Rainbow Ladder", "Ladder"),

  // ---- benches ----
  gag2cos("Normal Bench", "Bench"),
  gag2cos("White Bench", "Bench"),
  gag2cos("Dark Bench", "Bench"),
  gag2cos("Corner Bench", "Bench"),
  gag2cos("Flower Bench", "Bench"),
  gag2cos("Log Bench", "Bench"),

  // ---- seesaws ----
  gag2cos("Wood Seesaw", "Seesaw"),
  gag2cos("Gold Seesaw", "Seesaw"),
  gag2cos("Rainbow Seesaw", "Seesaw"),

  // ---- bridges ----
  gag2cos("Small Bridge", "Bridge"),
  gag2cos("Big Bridge", "Bridge"),
  gag2cos("White Bridge", "Bridge"),
  gag2cos("Red Bridge", "Bridge"),
  gag2cos("Fall Bridge", "Bridge"),

  // ---- arches ----
  gag2cos("Small Arch", "Arch"),
  gag2cos("Wood Arch", "Arch"),
  gag2cos("White Arch", "Arch"),
  gag2cos("Circle Arch", "Arch"),
  gag2cos("Pergola Arch", "Arch"),
  gag2cos("Fall Arch", "Arch"),

  // ---- bear traps ----
  gag2cos("Common Bear Trap", "Bear Trap", "Common"),
  gag2cos("Gold Bear Trap", "Bear Trap"),
  gag2cos("Rainbow Bear Trap", "Bear Trap"),

  // ---- springs ----
  gag2cos("Uncommon Spring", "Spring", "Uncommon"),
  gag2cos("Rare Spring", "Spring", "Rare"),
  gag2cos("Mythic Spring", "Spring", "Mythical", {
    note: "Spring. The site's Mythic badge; MintPlaza's ladder spells it Mythical.",
  }),
  gag2cos("Super Spring", "Spring", "Premium", {
    note: "Spring. Native Super tier, the top of GAG2's ladder, which maps onto Premium here.",
  }),

  // ---- lights, lamps and fire ----
  gag2cos("Star Lights", "Light"),
  gag2cos("Rope Lights", "Light"),
  gag2cos("Small Hanging Rope Light", "Light"),
  gag2cos("Moss Light", "Light"),
  gag2cos("Black Street Lamp", "Light"),
  gag2cos("Hanging Lamp Post", "Light"),
  gag2cos("Warm Lamp Post", "Light"),
  gag2cos("Candle Cluster", "Light"),
  gag2cos("Bonfire", "Light"),
  gag2cos("Fire Pit", "Light"),

  // ---- boomboxes ----
  gag2cos("Boombox", "Boombox"),
  gag2cos("Big Boombox", "Boombox"),
  gag2cos("Mega Boombox", "Boombox"),

  // ---- medals ----
  gag2cos("Bronze Medal", "Medal"),
  gag2cos("Emerald Medal", "Medal"),
  gag2cos("Opal Medal", "Medal"),
  gag2cos("Gold Medal", "Medal"),

  // ---- the Fourth of July set ----
  gag2cos("American Flag", "Patriotic"),
  gag2cos("Patriotic Drums", "Patriotic"),
  gag2cos("Patriotic Archway", "Patriotic"),
  gag2cos("Patriotic Stars", "Patriotic"),
  gag2cos("Patriotic Pinwheel", "Patriotic"),
  gag2cos("Patriotic Balloons", "Patriotic"),
  gag2cos("Patriotic Rope Lights", "Patriotic"),

  // ---- the cobblestone set ----
  gag2cos("Cobblestone Hero Statue", "Statue"),
  gag2cos("Cobblestone Wolf Statue", "Statue"),
  gag2cos("Cobblestone Pillar", "Prop"),
  gag2cos("Cobblestone Stepping Stones", "Prop"),

  // ---- farm props ----
  gag2cos("Haystack", "Prop"),
  gag2cos("Hay Bale", "Prop"),
  gag2cos("Picnic Table", "Prop"),
  gag2cos("Wood Wagon", "Prop"),
  gag2cos("Windmill", "Prop"),
  gag2cos("Wood Pile", "Prop"),
  gag2cos("Wood Barrel", "Prop"),
  gag2cos("Wood Crate", "Prop", undefined, {
    note: "Prop. A decorative crate, not an openable one — every openable crate in this game is filed under Crate and this is not one of them.",
  }),
  gag2cos("Small Rock", "Prop"),

  // ---- the big set pieces ----
  gag2cos("Clock", "Prop"),
  gag2cos("Water Fountain", "Prop"),
  gag2cos("Swimming Pool", "Prop"),
  gag2cos("Spruce Window", "Prop"),
];

/* ------------------------------------------------------------------ */
/* Fisch — gliders                                                     */
/* ------------------------------------------------------------------ */

/**
 * Nineteen gliders, and a correction worth reading.
 *
 * The Gliders page's own opening line still says there are 9, and it is right
 * — about what you can get TODAY (7 traditional plus 2 hang gliders). Its
 * change history names about twenty, because event and seasonal gliders were
 * added and then made unobtainable. Both numbers are true and they answer
 * different questions, so all nineteen are here and the note says which is
 * which.
 *
 * They also trade, which took a correction to establish. The direct trade menu
 * only names fish, bobbers, boats and rod skins — but the Gliders page states
 * plainly that gliders can be traded, and the route is a Trade Plaza Sales
 * Booth rather than the face-to-face swap. Two live value lists carry glider
 * prices, which is the market agreeing.
 */
const glider = (name: string, standing: "Available" | "Limited"): CatalogItem => ({
  id: `fisch-glider-${name.toLowerCase().replace(/[^a-z0-9]+/g, "-")}`,
  gameSlug: "fisch",
  name,
  category: "Gliders",
  type: "Glider",
  note:
    standing === "Available"
      ? "One of the nine gliders you can still get."
      : "Event or seasonal. Named in the wiki's change history; not currently obtainable, so it moves by trade only.",
  verified: standing === "Available",
});

const FISCH_GLIDERS: CatalogItem[] = [
  glider("Glider", "Available"),
  glider("Advanced Glider", "Available"),
  glider("Elite Glider", "Available"),
  glider("Cloud Glider", "Available"),
  glider("Hang Glider", "Available"),
  glider("Clover Glider", "Limited"),
  glider("Sweet Picnic Glider", "Limited"),
  glider("Jingle Wings", "Limited"),
  glider("Bat Glider", "Limited"),
  glider("Wings of Wrath", "Limited"),
  glider("Wings of Lament", "Limited"),
  glider("Jelly Cascade", "Limited"),
  glider("Speakerwings", "Limited"),
  glider("Citrus Sail", "Limited"),
  glider("Crested Dragon Wings", "Limited"),
  glider("Silkwings", "Limited"),
  glider("Poyastar", "Limited"),
  glider("Polarastar", "Limited"),
  glider("Joyous Hat", "Limited"),
];

/* ------------------------------------------------------------------ */
/* Fisch — rod skins the pull did not reach                            */
/* ------------------------------------------------------------------ */

/**
 * Fourteen skins read off the wiki's own Rod Skins page.
 *
 * The pull carries 96 rod skins and the page says there are 264, so this is
 * not the missing 168 — it is the fourteen that were legible on the areas the
 * page was open to, added because a skin missing from the catalogue cannot be
 * listed at all, and rod skins are the one Fisch cosmetic the in-game trade
 * menu names directly.
 *
 * Each row records the rod it dresses. That is not decoration: the research is
 * blunt that confusing a rod SKIN, which trades, with the ROD it dresses,
 * which never does, is the most expensive mistake available in this game, and
 * five things called Nessie already sit across both categories. A skin whose
 * note names its rod can be told apart from the rod by reading one line.
 *
 * Drop chance is recorded where the page showed it. Rarity is recorded only
 * for the two rows where the page's rarity row was actually on screen —
 * everywhere else the column was below the fold, and a guessed tier on a
 * cosmetic that trades would be worse than a blank.
 */
const rodSkin = (
  name: string,
  rod: string,
  source: string,
  drop: string,
  rarity?: Rarity,
  type?: string,
): CatalogItem => ({
  id: `fisch-skin-${name.toLowerCase().replace(/[^a-z0-9]+/g, "-")}`,
  gameSlug: "fisch",
  name,
  category: "Rod Skin",
  rarity,
  type,
  note:
    `Skin for the ${rod}, from ${source}. ${drop} drop chance. ` +
    `It dresses that rod and is not the rod — the skin trades, the rod does not.`,
  verified: false,
});

const FISCH_ROD_SKINS: CatalogItem[] = [
  // The only two whose rarity row was on screen.
  rodSkin("Neptune's Demand", "Poseidon Rod", "Atlantis", "7.04%", "Rare", "Rare"),
  rodSkin("Stormbringer", "Zeus Rod", "Atlantis", "1.41%", "Legendary", "Legendary"),

  rodSkin("Celestial Ghoul", "Celestial Rod", "the Ghosts crate", "9.09%"),
  rodSkin("Spirit of the Eclipse", "Fang of the Eclipse", "the Ghosts crate", "1.01%"),
  rodSkin("Rod of the Gemmer", "Great Dreamer Rod", "Midas' Mates", "8%"),
  rodSkin("Midas Spirit", "Free Spirit Rod", "Midas' Mates", "1%"),
  rodSkin("Arctic Coral", "Arctic Rod", "the Coral crate", "45%"),
  rodSkin("Coral Specter", "Abyssal Specter Rod", "the Coral crate", "35%"),
  rodSkin("Violet Kraken", "Kraken Rod", "the Friendly crate", "8%"),
  rodSkin("No Violet Rod", "No-Life Rod", "the Friendly crate", "1%"),
  rodSkin("Flame Shears", "Verdant Shear Rod", "the Cursed Cosmetic Case", "5.5%"),
  rodSkin("Cthulu's Revenge", "Great Dreamer Rod", "the Cursed Cosmetic Case", "0.5%"),
  rodSkin("Whispering Tentacles", "Flimsy Rod", "the Cultist crate", "40%"),
  rodSkin("Anchor of the Sleeper", "Steady Rod", "the Cultist crate", "34%"),
];

/* ------------------------------------------------------------------ */
/* Pet Simulator 99 — enchants                                         */
/* ------------------------------------------------------------------ */

/**
 * Twenty-four enchants, from two market lists that overlap.
 *
 * BIG Games' own API reports 65 enchants and charms. One market tracker
 * follows 52 — the ones that actually change hands. The names below are the
 * union of every one I could read, which lands at 24 and is explicitly not the
 * whole set.
 *
 * This is the one game on MintPlaza where the full list should never be typed
 * by a person: the developer publishes it. `GET /api/collection/Enchants` on
 * biggamesapi.io returns all of them with their images, and the right move at
 * deploy time is to hydrate from there and let these rows fall away. They exist
 * so the board is usable before that happens.
 */
const enchant = (name: string): CatalogItem => ({
  id: `ps99-enchant-${name.toLowerCase().replace(/[^a-z0-9]+/g, "-")}`,
  gameSlug: "pet-simulator-99",
  name,
  category: "Enchant",
  note: "Named on a live market list. The authoritative roster is BIG Games' own API.",
  verified: true,
});

const PS99_ENCHANTS: CatalogItem[] = [
  "Massive Comet", "Diamond Mimic", "Chest Mimic", "Lucky Block", "Huge Hunter",
  "Fortune", "Shiny Hunter", "Boss Chest Mimic", "Super Shiny Hunter",
  "Super Magnet", "Boss Lucky Block", "Shiny Supercharge", "Mini Chest Fortune",
  "Magic Orb", "Chest Breaker", "Super Lightning", "Starfall", "Nightmare Orb",
  "Mega Chest Breaker", "Double Coins", "Active Huge Overload",
  "Diamond Gift Hunter", "Lightning Orb", "Rainbow Eggs",
].map(enchant);

/* ------------------------------------------------------------------ */
/* Creatures of Sonaria — the top of the market                        */
/* ------------------------------------------------------------------ */

/**
 * The fifteen rows the whole Sonaria market runs on, and the one it cannot
 * price.
 *
 * Five trade-only creatures and ten palettes and materials. All five creatures
 * are badge- or role-limited and are not obtainable in game right now — 311 of
 * 475 creatures are, and these are not among them — so the only way anyone gets
 * one is from another player, which is exactly why they sit at the top.
 *
 * Palettes and Materials get their own rows rather than being tags on a
 * creature, because in this game they are genuinely separate tradeable items
 * and several of them are worth more than the creatures they go on. Getting
 * that wrong would have hidden the most valuable half of the market inside a
 * dropdown.
 *
 * And then there is Explosive Stars Material, which is the single most valuable
 * item in the game and has no price at all. The community list has published it
 * as TBD for months. It is here, unpriced, saying so — that row is the whole
 * argument for having a "we do not know" state in the first place.
 */
const sonaria = (
  name: string,
  category: "Creature" | "Palette" | "Material",
  note: string,
  verified = true,
): CatalogItem => ({
  id: `cs-${name.toLowerCase().replace(/[^a-z0-9]+/g, "-")}`,
  gameSlug: "creatures-of-sonaria",
  name,
  category,
  rarity: "Premium",
  note,
  verified,
});

const SONARIA_TOP: CatalogItem[] = [
  sonaria("Keruku", "Creature", "Trade-only. Badge or role limited, not obtainable in game."),
  sonaria("Somnia Elus", "Creature", "Trade-only. Badge or role limited, not obtainable in game."),
  sonaria("Corvurax", "Creature", "Trade-only. Badge or role limited, not obtainable in game."),
  sonaria("Mijusuima", "Creature", "Trade-only. Badge or role limited, not obtainable in game."),
  sonaria("Etheralotus", "Creature", "Trade-only. Badge or role limited, not obtainable in game."),

  sonaria("Explosive Stars Material", "Material",
    "The most valuable item in the game, and nobody has a number for it. The community list has shown TBD here for months. MintPlaza will not price it, and no trade containing it gets a verdict.",
    false),

  sonaria("Lunar Qilin", "Palette", "The highest priced thing on the list that actually has a price."),
  sonaria("Kaiju Material", "Material", "Top-tier material."),
  sonaria("Glaring Material", "Material", "Top-tier material."),
  sonaria("Sonarian Material", "Material", "Top-tier material."),
  sonaria("Shining Material", "Material", "Top-tier material."),
  sonaria("Super Korathos Palette", "Palette", "Super palette."),
  sonaria("Starlit Palette", "Palette", "Super palette."),
  sonaria("Ikoran Palette", "Palette", "Super palette."),
  sonaria("Hygos Palette", "Palette", "Super palette."),
];

/* ------------------------------------------------------------------ */
/* Adopt Me — the last two of the eight old limiteds                   */
/* ------------------------------------------------------------------ */

const ADOPT_ME_LIMITEDS: CatalogItem[] = [
  { id: "adoptme-blue-dog", gameSlug: "adopt-me", name: "Blue Dog", category: "Pet",
    rarity: "Legendary",
    note: "One of the eight old limiteds the whole Adopt Me market is anchored on. Long retired; trade only.",
    verified: true },
  { id: "adoptme-pink-cat", gameSlug: "adopt-me", name: "Pink Cat", category: "Pet",
    rarity: "Legendary",
    note: "One of the eight old limiteds the whole Adopt Me market is anchored on. Long retired; trade only.",
    verified: true },
];

/**
 * Rows written by hand, from research, with values attached.
 *
 * These are the authority. Every priced row on the site is in here, and
 * values.ts is keyed by these ids.
 */
const CURATED: readonly CatalogItem[] = [
  ...BLOX_FRUITS, ...BLOX_GAMEPASSES, ...BLOX_SCROLLS, ...BLOX_SKINS,
  ...ADOPT_ME, ...PS99, ...SONARIA,
  ...FISCH_CATALOG, ...GAG2_CATALOG,
  ...GAG2_PETS, ...GAG2_EGGS, ...GAG2_UNTRADEABLE, ...GAG2_COSMETICS, ...GAG2_CRATES,
  ...FISCH_GLIDERS, ...FISCH_ROD_SKINS, ...PS99_ENCHANTS, ...SONARIA_TOP, ...ADOPT_ME_LIMITEDS,
];

/** Names compare case- and punctuation-insensitively when deduping. */
function normName(name: string): string {
  return name.toLowerCase().replace(/[^a-z0-9]+/g, "");
}

/**
 * Curated rows plus everything the machine pull adds that is genuinely new.
 *
 * ---------------------------------------------------------------------------
 * Why this merges on NAME and not on id
 * ---------------------------------------------------------------------------
 *
 * The two sources generate ids differently. A hand-curated Keruku is
 * `cs-keruku`; the pull calls the same creature `creatures-of-sonaria-keruku`.
 * Merging on id would have kept both, which is worse than either mistake it
 * could have made instead: the board would show one creature twice, once with
 * a Shoom band and once unpriced, and a trader comparing the two rows would
 * have no way to tell which is real. The same applies to 19 Fisch gliders,
 * every GAG2 pet and egg, and all 28 PS99 enchants — every one of which the
 * pull also carries under a different id.
 *
 * So the key is (gameSlug, normalised name) and the curated row wins outright.
 * It keeps its id, so values.ts stays attached; it keeps its note, its
 * rarity and its tradeable flag, because those were judgement calls made
 * against research rather than whatever category a wiki happened to file the
 * page under.
 *
 * The one thing flowing the other way is fields the curated row simply does
 * not have: a Roblox asset id, a size tier, an orthogonal class. Those are
 * free additions — a curated row with no picture gains a picture — and they
 * cannot contradict a judgement because there was no judgement there to
 * contradict.
 */
/**
 * Names the pull carries that a curated row already covers. Reported by the
 * proof script so a suppression can be eyeballed rather than trusted.
 */
const SUPPRESSED: { gameSlug: string; name: string; category: string }[] = [];

function mergeCatalog(): readonly CatalogItem[] {
  const curatedByName = new Map<string, CatalogItem>();
  const out: CatalogItem[] = [];

  for (const row of CURATED) {
    curatedByName.set(`${row.gameSlug}:${normName(row.name)}`, row);
    out.push(row);
  }

  const seen = new Set<string>();
  for (const row of PULLED_CATALOG) {
    const nameKey = `${row.gameSlug}:${normName(row.name)}`;

    // Against CURATED the key is the name alone, deliberately ignoring
    // category. The two sources do not share a category vocabulary — the
    // curated Fisch gliders sit under "Gliders" and the pull files them under
    // "Glider" — so keying on category here would have re-admitted every row
    // the curated list already covers, under a near-identical label, and the
    // board would show each glider twice.
    const curated = curatedByName.get(nameKey);
    if (curated) {
      SUPPRESSED.push({ gameSlug: row.gameSlug, name: row.name, category: row.category });
      // Curated row wins. Absorb only what it is missing.
      if (row.assetId && !curated.assetId) curated.assetId = row.assetId;
      if (row.sizeTier && !curated.sizeTier) curated.sizeTier = row.sizeTier;
      if (row.classes?.length && !curated.classes?.length) curated.classes = row.classes;
      continue;
    }

    // Among pulled rows the category is part of the key, because within one
    // game the pull legitimately carries the same name for different things:
    // Pet Simulator 99 has a Dragon pet and a Dragon booth, a Ducky pet and a
    // Ducky hoverboard — 154 such names. Collapsing those on name alone threw
    // away 195 real rows.
    const slotKey = `${nameKey}:${row.category}`;
    if (seen.has(slotKey)) continue;
    seen.add(slotKey);
    out.push(row);
  }

  return out;
}

export const CATALOG: readonly CatalogItem[] = mergeCatalog();

/**
 * How many rows the pull contributed to a game, versus how many were already
 * curated. Shown on the catalogue so the provenance of a 10,000-row list is
 * visible rather than implied.
 */
export function catalogProvenance(gameSlug: string): {
  curated: number;
  pulled: number;
  total: number;
} {
  const rows = catalogFor(gameSlug);
  const pulled = rows.filter((i) => i.sourced).length;
  return { curated: rows.length - pulled, pulled, total: rows.length };
}

/** Pulled rows a curated row already covered. For the proof script. */
export function suppressedByCuration(): readonly {
  gameSlug: string;
  name: string;
  category: string;
}[] {
  void CATALOG;
  return SUPPRESSED;
}

/** Catalogue rows the game will not let players trade. Never offer these. */
export function tradableFor(gameSlug: string): readonly CatalogItem[] {
  return catalogFor(gameSlug).filter((i) => i.tradeable !== false);
}

/** A fruit and its skins, for the grouped view. */
export function variationsOf(itemId: string): readonly CatalogItem[] {
  return CATALOG.filter((i) => i.parentId === itemId);
}

export function catalogFor(gameSlug: string): readonly CatalogItem[] {
  return CATALOG.filter((i) => i.gameSlug === gameSlug);
}

/** Every string this item can be found by. */
export function searchTerms(item: CatalogItem): readonly string[] {
  return [item.name, ...(item.formerly ?? []), ...(item.aliases ?? [])];
}

/**
 * Indexed rather than scanned, because matching asks this thousands of times.
 * Turning one board of listings into suggestions resolves every item on every
 * side of every listing, and a linear scan of a four-figure catalogue for each
 * one is the difference between a page that renders and one that hangs.
 */
const BY_ID = new Map(CATALOG.map((i) => [i.id, i]));

export function findItem(id: string): CatalogItem | undefined {
  return BY_ID.get(id);
}

/**
 * Where an item's picture comes from — resolved at render time, never stored.
 *
 * ---------------------------------------------------------------------------
 * Why no images live in the database
 * ---------------------------------------------------------------------------
 *
 * Ten thousand catalogue rows would be ten thousand image blobs, and a blob in
 * Postgres is the worst of every world: it bloats backups, it cannot be served
 * from a CDN, and it goes stale the moment a game re-skins an item. So nothing
 * here stores bytes. There are three resolution paths and they are tried in
 * order:
 *
 *   1. `art` — an explicit path a human set. Always wins.
 *   2. `assetId` — Roblox's own thumbnail service. Pet Simulator 99's API
 *      publishes an asset id for 3,108 of its rows, so those pictures are
 *      free, always current, and served by Roblox rather than by us.
 *   3. A file dropped at /public/items/<gameSlug>/<id>.png. This is the
 *      convention for the four games whose wikis publish no asset ids: drop
 *      the file in, it appears. No code change, no migration, no upload table.
 *
 * When none of the three resolves, the interface falls back to the typographic
 * rarity tile, which is a real design rather than a broken-image icon.
 */
export const ITEM_IMAGE_BASE = "/items";

/**
 * Games that never show pictures, whatever data exists for them.
 *
 * Fisch is here by decision, not by omission. It is 2,133 rows, almost all of
 * them fish, and the wiki publishes no asset ids for any of them — so every
 * picture would have to be a file somebody sourced, stored and served, for a
 * catalogue that turns over weekly. The typographic tile is not a placeholder
 * standing in for that: for this game it IS the design, which is why the ring
 * and badge system below carries the rarity and tier that a picture would
 * otherwise have carried.
 *
 * Checked before any art path is considered, so a stray `art` value or a
 * dropped-in file cannot reintroduce images by accident.
 */
export const TEXT_ONLY_GAMES: readonly string[] = ["fisch"];

export function isTextOnly(gameSlug: string): boolean {
  return TEXT_ONLY_GAMES.includes(gameSlug);
}

/**
 * NOT the Roblox thumbnails URL, and the difference matters.
 *
 * `thumbnails.roblox.com/v1/assets?assetIds=…` is a JSON API. It answers with
 * `{ data: [{ state, imageUrl }] }`, not with a PNG, so putting it in an
 * `<img src>` — which is what the pull's README suggests — renders a broken
 * image on all 3,108 rows that carry an asset id. The JSON has to be resolved
 * to the CDN url it names before anything can display it.
 *
 * That resolution happens server-side in /api/item-image/[assetId], which
 * caches the hop, so this returns a path into our own origin. The tile treats
 * a failure there as "no picture" and falls back to the rarity tile.
 */
export function thumbnailFor(item: CatalogItem): string | undefined {
  if (isTextOnly(item.gameSlug)) return undefined;
  if (item.art) return item.art;
  if (item.assetId) return `/api/item-image/${encodeURIComponent(item.assetId)}`;
  return localArtPath(item);
}

/**
 * The conventional local path for an item's picture, or undefined when no such
 * file exists.
 *
 * Consulting a manifest rather than just returning the path is what keeps the
 * convention cheap. Optimistically pointing every tile at a file that is
 * usually absent would mean roughly ten thousand 404s per catalogue page — the
 * fallback would still render correctly, so nothing would look broken, and the
 * cost would sit invisibly in the network tab and the server log forever.
 *
 * The manifest is generated by `npm run ingest`, which enumerates
 * public/items/<gameSlug>/. Dropping a file in and re-running is the entire
 * workflow for adding artwork — there is no upload table and no migration.
 */
const ART_FILES = new Map<string, string>(
  ART_MANIFEST.map((file) => [file.replace(/\.[^./]+$/, ""), file]),
);

export function localArtPath(item: CatalogItem): string | undefined {
  const file = ART_FILES.get(`${item.gameSlug}/${item.id}`);
  return file ? `${ITEM_IMAGE_BASE}/${file}` : undefined;
}

/** How current this catalogue is. Shown wherever it could mislead. */
export const CATALOG_CHECKED = "September 2026";

/**
 * Per-game notes shown above the catalogue. Empty when nothing needs saying —
 * the Blox Fruits count reconciled once the four renames were resolved.
 */
export const CATALOG_NOTES: Record<string, string> = {
  "blox-fruits":
    "All 42 fruits with their Permanent prices — including Magnet, added in " +
    "Update 30 — all seven gamepasses, both scroll bundles, and every skin of " +
    "the eight fruits that have them. A fruit's default look is listed for " +
    "completeness but cannot be traded on its own: it comes with the fruit. " +
    "Robux prices are what the wiki showed when this was last checked; they " +
    "move with updates.",

  gag2:
    "420 rows: 117 cosmetics, 113 seeds and crops, 72 gear, 50 pets, 34 " +
    "crates, 16 packs, 13 eggs and the chests, plus the two currencies " +
    "marked so you can see they never move. The cosmetics are the half that " +
    "actually trades — the crate is consumed, the thing that comes out of " +
    "it is what you keep — so a catalogue with every crate and no boombox, " +
    "bench or conveyor was missing the decorative economy entirely. 242 " +
    "rows carry a picture, cut from gag2.gg's own cards; the rest fall back " +
    "to the lettered tile rather than to a broken image. Rarities are the " +
    "honest weak point: over half the rows carry none, because neither the " +
    "wiki nor gag2.gg filed them under one, and a guessed tier would be " +
    "worse than a blank.",

  "pet-simulator-99":
    "The full roster, straight from BIG Games' own API: 3,109 pets — 1,039 " +
    "Huge, 341 Titanic, 73 Gargantuan — 924 eggs, and every booth, " +
    "hoverboard, enchant, charm and lootbox besides. This is the one game " +
    "whose developer publishes its data, which is why it is also the only one " +
    "carrying pictures: 3,108 rows have a Roblox asset id and the image is " +
    "fetched from Roblox at render time rather than stored here. 622 pets " +
    "have no rarity in the API itself; those are left unset. BIG Games' terms " +
    "require written consent before commercial use, so this is a reference " +
    "rather than a live feed.",

  "creatures-of-sonaria":
    "All 482 creatures against the wiki's own stated 481, so the roster is " +
    "effectively complete, plus the hand-researched top of the market: five " +
    "trade-only creatures that cannot be obtained in game at all, and the ten " +
    "palettes and materials that trade above most creatures. The wiki pull " +
    "carries no palettes or materials at all — in this game those are the most " +
    "valuable half of the market, so they stay hand-curated and are separate " +
    "rows rather than dropdown tags. Values are in Shooms and every one is a " +
    "band, not a number. Explosive Stars Material is the most valuable item in " +
    "the game and has no price anywhere; it is listed unpriced, and any trade " +
    "naming it gets no verdict.",

  fisch:
    "1,426 fish, and the four tiers players actually chase — Divine Secret, " +
    "Apex, Secret and Exotic — researched by hand on top of the pull. The " +
    "cosmetics are the known gap: fischipedia.org blocks automated access, so " +
    "these came from the thinner legacy wiki and carry 96 rod skins against " +
    "roughly 531 that exist, 17 boats against 312, and 81 bobbers against " +
    "354. The 19 gliders are hand-researched, because the pull found 2. Rods, " +
    "totems and bait are here so you can see them and are marked " +
    "untradeable: the single most expensive mix-up in this game is a rod " +
    "SKIN, which trades, and the ROD it dresses, which never does.",

  "adopt-me":
    "788 pets, 758 toys, 283 vehicles, 104 strollers and the eight old " +
    "limiteds the whole market is anchored on. 104 rows are marked " +
    "untradeable from the wiki's own Non-Tradable category. Two gaps worth " +
    "knowing: potions came back as 2 rows and furniture as 11, which is " +
    "thinner than the game really has — and potions matter here, because Fly " +
    "and Ride change what a pet is worth.",
};

/** Rows that could not be confirmed against the wiki. */
export function unverifiedCount(gameSlug: string): number {
  return catalogFor(gameSlug).filter((i) => i.verified === false).length;
}


/**
 * How a game varies an item, and how much that is worth.
 *
 * ---------------------------------------------------------------------------
 * Why this is two shapes and not one
 * ---------------------------------------------------------------------------
 *
 * Every one of these games modifies items, and they do it in exactly two ways.
 * Getting them confused produces a catalogue with thousands of duplicate rows,
 * which is the standard way a trading site becomes unusable.
 *
 *   A FIXED TAG LIST is a small, closed set — Neon / Mega Neon, Golden /
 *   Rainbow / Shiny, Big / Mega. Some stack (a Fisch fish can be Shiny AND
 *   Sparkling AND Giant), some are exclusive (a pet is Golden or Rainbow, not
 *   both). These are tags on one row.
 *
 *   A MULTIPLIER LOOKUP is a large open table where each entry multiplies the
 *   item's value — Fisch's mutations, GAG2's crop mutations. A fish carries
 *   exactly one. These are also tags on one row, with a number attached.
 *
 * The rule both shapes serve: ONE base item is ONE catalogue row. A "Shiny
 * Aether Nessie" is a Nessie with two tags, never three rows. Fisch alone
 * advertises "400,000+ possible variations" of its fish — a row per variation
 * is not a catalogue, it is a denial-of-service attack on your own search box.
 *
 * ---------------------------------------------------------------------------
 * What is NOT here any more
 * ---------------------------------------------------------------------------
 *
 * This model used to carry `multipliers` — confirmed figures like Fisch's
 * Aether at 15x — and `unconfirmed`, the ones nobody had pinned down. Both
 * existed to multiply a value, and MintPlaza no longer keeps values (see
 * src/lib/referrals.ts). A multiplier with nothing to multiply is not harmless
 * dead weight: it is half a calculator, sitting there inviting the other half
 * back.
 *
 * `note` stays, because those notes are game mechanics off the game's own wiki
 * — how the variant systems work, which ones stack, which two share a word —
 * and none of that moves with the market.
 */
export interface VariantAxis {
  key: string;
  label: string;
  options: readonly string[];
  /** True where several can be true at once. False means pick one. */
  stacks?: boolean;
}

export interface VariantModel {
  axes: readonly VariantAxis[];
  note?: string;
}

export const VARIANTS: Record<string, VariantModel> = {
  "blox-fruits": {
    axes: [{ key: "form", label: "Form", options: ["Physical", "Permanent"] }],
    note: "Permanent is a different item in practice — it never leaves your inventory, so it trades like a gamepass rather than like a fruit, and it carries its own value.",
  },

  fisch: {
    axes: [
      // Stacks with each other AND on top of a mutation.
      { key: "attribute", label: "Attributes", stacks: true,
        options: ["Shiny", "Sparkling", "Big", "Giant", "Tiny"] },
      // Exactly one, ever.
      //
      // Every mutation the game has is listed, in the order fischipedia ranks
      // them. A player who caught a Tryhard fish owns a Tryhard fish, and
      // leaving it out of the picker would not make it less real — it would
      // make the player unable to say what they are holding, so they would
      // type it in the note field where nothing can match on it, and the
      // catalogue would quietly stop describing the game.
      { key: "mutation", label: "Mutation", stacks: false,
        options: [
          // The four fischipedia documents in detail, biggest first.
          "Aether", "Prism", "Prismize", "Prismatic",
          "Tryhard", "Galaxy", "Glowy", "Chaotic", "Plagued", "Darkness",
          "Melody", "Scavenged", "Singularity", "Synth",
          "Bathyal", "Darkheart", "Hadal", "Light", "Thalassic",
        ] },
    ],
    note: "A fish carries at most one mutation and any number of attributes. Size tags (Big, Giant, Tiny) describe weight. Mutations are what move a fish's worth — Aether most of all — but by how much is a question for the value list, not for MintPlaza.",
  },

  "adopt-me": {
    axes: [
      { key: "neon", label: "Neon", options: ["Normal", "Neon", "Mega Neon"] },
      { key: "potion", label: "Ability", options: ["No Potion", "Fly", "Ride", "Fly-Ride"] },
    ],
    note: "These combine into a grid, not a ladder: a Mega Neon Fly-Ride (players write it MFR) is one pet with two tags. Neon takes four Full Grown of the same pet and Mega takes four Neons, which is why the gap between them is so large. Every combination is priced separately by the community, so state both tags when you list one.",
  },

  "pet-simulator-99": {
    axes: [
      { key: "tint", label: "Tint", options: ["Normal", "Golden", "Rainbow", "Shiny", "Shiny Golden", "Shiny Rainbow"] },
    ],
    note: "Shiny stacks on top of Golden and Rainbow, which is why the last two entries exist. None of these is a rarity — the game's own API carries the pet type separately, and an exists count is a better measure of scarcity than any tier.",
  },

  "creatures-of-sonaria": {
    // Deliberately empty. Growth stages are not tradeable variants, and
    // palettes and materials are standalone items with their own rows — some
    // of them trade higher than the creatures they go on.
    axes: [],
    note: "Sonaria has no tint system. A creature is a creature; Colour Palettes and Material Palettes are separate tradeable items, not tags, and the top ones trade for more than most creatures do.",
  },

  gag2: {
    axes: [
      { key: "variant", label: "Pet variant", options: ["Normal", "Big", "Mega", "Rainbow"] },
      { key: "mutation", label: "Crop mutation", stacks: false,
        options: ["Gold", "Rainbow", "Glow", "Aurora", "Ignited", "Frozen", "Electric", "Starstruck", "Bloodlit"] },
    ],
    note: "Two systems that share a word. A PET variant (Big, Mega, Rainbow, and they stack) is not a CROP mutation, and Rainbow exists in both meaning different things. One mutation per crop, no stacking. Mega used to be called Huge; it is the same tier renamed. GAG2.GG's calculator runs the game's own sell formula, so it is the place to turn a weight and a mutation into an exact number.",
  },

};

/**
 * The primary axis of each game, flattened.
 *
 * The listing form takes one variant per item, so it reads this. The richer
 * model above is what the catalogue and the Studio use, and it is where the
 * second axis lives for the two games that have one.
 */
export const ITEM_VARIANTS: Record<string, readonly string[]> = Object.fromEntries(
  Object.entries(VARIANTS).map(([slug, m]) => [slug, m.axes[0]?.options ?? []]),
);

/**
 * Every axis a game varies its items on, for a form that can show them all.
 *
 * `ITEM_VARIANTS` above keeps only the first axis, which is right for the one
 * place that needs a single tag and wrong everywhere else. For Fisch the first
 * axis is attributes, so reading only that one means the mutation — the single
 * biggest thing a Fisch trader wants stated — never reaches the player at all.
 */
export function variantAxesFor(gameSlug: string): readonly VariantAxis[] {
  return VARIANTS[gameSlug]?.axes ?? [];
}

/**
 * Mutations — modified versions of a fruit that change appearance, moveset and
 * playstyle. All three are event-exclusive and Beast type, and each belongs to
 * one specific fruit, so a listing states them per item rather than per game.
 *
 * They move value the way Permanent does, which is why they are a listing
 * field and not a note.
 */
export const MUTATIONS: Record<string, readonly string[]> = {
  "bf-kitsune": ["Empyrean"],
  "bf-yeti": ["Fiend"],
  "bf-tiger": ["Werewolf"],
};

export function mutationsFor(itemId: string): readonly string[] {
  return MUTATIONS[itemId] ?? [];
}

/**
 * Every variant a player can choose for ONE item: the game's own axes, plus
 * that item's mutations where it has any.
 *
 * ---------------------------------------------------------------------------
 * Why this exists
 * ---------------------------------------------------------------------------
 *
 * MUTATIONS above described itself as a listing field. It was not one. Nothing
 * called mutationsFor(), the picker offered the game's axes only, and both
 * server-side validators accepted a variant only if a GAME axis listed it — so
 * a mutation would have been refused even if the picker had offered it.
 *
 * The effect was specific and bad: Blox Fruits is the launch game, Empyrean
 * Kitsune is about the most valuable thing in it, and MintPlaza could not tell
 * it apart from an ordinary Kitsune. Two players agreeing a trade on this site
 * were agreeing about different items.
 *
 * Per-item rather than per-game because that is what these are: Empyrean
 * belongs to Kitsune and to nothing else, so offering it on every fruit would
 * invite a listing for a thing that cannot exist.
 */
export function variantAxesForItem(item: CatalogItem): readonly VariantAxis[] {
  const mutations = mutationsFor(item.id);
  const axes = variantAxesFor(item.gameSlug);
  if (mutations.length === 0) return axes;
  return [
    ...axes,
    { key: "mutation", label: "Mutation", options: [...mutations] },
  ];
}

/**
 * Is this a variant the player could really have chosen for this item?
 *
 * Both server actions ask this rather than checking the game axes themselves.
 * A variant nothing recognises is worse than a rejection: it sits in a list
 * matching nothing, forever, with no way to tell why.
 */
export function isKnownVariant(item: CatalogItem, variant: string): boolean {
  return variantAxesForItem(item).some((a) => a.options.includes(variant));
}

/**
 * Beli prices are confirmed for 20 of the 41 fruits. The rest are absent rather
 * than derived: the Beli-to-Robux ratio is not constant (Quake is 667×, Portal
 * 950×, Spirit 1333×), so there is no formula to fall back on and a calculated
 * price would be a guess wearing a number's clothes.
 */
export function beliCoverage(): { known: number; total: number } {
  const fruits = catalogFor("blox-fruits").filter((i) => i.category === "Fruit");
  return { known: fruits.filter((i) => i.beli !== undefined).length, total: fruits.length };
}

/**
 * One catalogue row as the database stores it.
 *
 * Deliberately structural rather than imported from a generated client type:
 * this is the shape the merge needs, and stating it here is what lets the
 * merge be tested without a database.
 */
export interface CatalogRow {
  id: string;
  game_slug: string;
  name: string;
  category: string | null;
  attributes: Record<string, unknown> | null;
  verified_at?: string | null;
  is_active?: boolean | null;
}

/**
 * The code registry with the control panel's edits laid over it.
 *
 * ---------------------------------------------------------------------------
 * Why this merges instead of choosing
 * ---------------------------------------------------------------------------
 *
 * The read this replaced returned the database rows whenever there were any,
 * and the registry only when there were none. That reads as "the database
 * wins", which sounds right and was catastrophic: the table is seeded per item,
 * so a partial seed does not mean "these are the items", it means "these are
 * the items somebody has touched". Fifteen rows for Pet Simulator 99 silently
 * removed 4,944 items from the product.
 *
 * So the registry is the baseline and a row is an override. `is_active: false`
 * is how the panel removes an item, which is why inactive rows must be fetched
 * rather than filtered out in the query -- filter them there and the registry's
 * copy reappears, making deactivation do nothing at all.
 *
 * ---------------------------------------------------------------------------
 * The id is the slug, never the uuid
 * ---------------------------------------------------------------------------
 *
 * `game_items.id` is a uuid and it is internal. Everything a player creates
 * keys items by catalogue slug, and the database enforces it: is_item_slug()
 * guards listing_sides.item_id and inventory_entries.item_id, and rejects
 * uuid-shaped values outright. Returning the uuid handed the pickers an id
 * that could not be saved, so listing or stocking anything failed in the four
 * games that had rows, while the two with none worked perfectly.
 *
 * A row with no slug is a leftover from before the panel stamped them. It
 * cannot be keyed by a player, so it is dropped rather than shown under a uuid.
 */
export function applyCatalogOverrides(
  base: readonly CatalogItem[],
  rows: readonly CatalogRow[],
): CatalogItem[] {
  const attrsOf = (row: CatalogRow) => row.attributes ?? {};

  const bySlug = new Map<string, CatalogRow>();
  for (const row of rows) {
    const slug = attrsOf(row).slug;
    if (typeof slug === "string" && slug.length > 0) bySlug.set(slug, row);
  }

  // `base` is the registry's copy where there is one. A row supplies the
  // fields it actually defines and the registry supplies the rest, because a
  // row is an edit rather than a replacement -- most of these were written by
  // an ingest that never carried every column. Whole-row replacement dropped
  // `beli` from the 21 Blox Fruits items that have it, silently, because the
  // rows simply have no beli key.
  const fromRow = (row: CatalogRow, slug: string, base?: CatalogItem): CatalogItem => {
    const a = attrsOf(row);
    const parentSlug = a.parentSlug;
    return {
      id: slug,
      gameSlug: row.game_slug,
      name: row.name,
      category: row.category ?? "",
      rarity: (a.rarity as CatalogItem["rarity"]) ?? base?.rarity,
      type: (a.type as string | undefined) ?? base?.type,
      formerly: Array.isArray(a.formerly) ? (a.formerly as string[]) : base?.formerly,
      aliases: Array.isArray(a.aliases) ? (a.aliases as string[]) : base?.aliases,
      // Already a slug, which is what an id is now, so there is nothing to
      // translate -- the uuid lookup this replaced existed only because ids
      // were uuids.
      parentId: typeof parentSlug === "string" ? parentSlug : base?.parentId,
      // Absent means tradeable, so only an explicit false may turn it off --
      // otherwise a row predating the column vanishes from every picker.
      tradeable: a.tradeable === false ? false : base?.tradeable,
      chromatic: a.chromatic === true ? true : base?.chromatic,
      robux: typeof a.robux === "number" ? a.robux : base?.robux,
      beli: typeof a.beli === "number" ? a.beli : base?.beli,
      note: (a.note as string | undefined) ?? base?.note,
      verified: a.verified === false ? false : base?.verified,
      art: (a.art as string | undefined) ?? base?.art,
      checkedAt: row.verified_at ?? base?.checkedAt,
    };
  };

  const merged: CatalogItem[] = [];
  for (const item of base) {
    const row = bySlug.get(item.id);
    if (!row) {
      merged.push(item);
      continue;
    }
    bySlug.delete(item.id);
    if (row.is_active === false) continue;
    merged.push(fromRow(row, item.id, item));
  }

  // Whatever is left was added in the panel and the registry has never heard
  // of it. It belongs in the catalogue too.
  for (const [slug, row] of bySlug) {
    if (row.is_active === false) continue;
    merged.push(fromRow(row, slug));
  }

  return merged;
}
