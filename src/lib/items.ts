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
import type { Demand, ItemValue } from "./values";

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
  /**
   * Community trade value, when it came from the database rather than the
   * seeded table in values.ts. Present only on rows loaded from Supabase, which
   * is what makes an admin edit take effect on the site.
   */
  value?: ItemValue;
  demand?: Demand;
  /** Shown on the tile where the item carries a condition worth stating. */
  note?: string;
  /**
   * False where the rarity or existence could not be confirmed. Shown in admin
   * so the uncertain rows can be corrected first, rather than quietly
   * presented as fact.
   */
  verified?: boolean;
}

/** Tile colours by rarity. Restrained — this is a label, not a rainbow. */
export const RARITY_STYLE: Record<Rarity, { fg: string; bg: string; ring: string }> = {
  Common:    { fg: "#5A6B65", bg: "#EEF2F0", ring: "#0D161314" },
  Uncommon:  { fg: "#2F7D57", bg: "#E6F4EC", ring: "#2F7D5726" },
  Rare:      { fg: "#2C6C9E", bg: "#E7F0F8", ring: "#2C6C9E26" },
  "Ultra-Rare": { fg: "#2F5FA8", bg: "#E6ECF9", ring: "#2F5FA826" },
  Legendary: { fg: "#8A5A12", bg: "#FBF1E0", ring: "#8A5A1226" },
  Mythical:  { fg: "#9B3B6E", bg: "#FAEBF2", ring: "#9B3B6E26" },
  Premium:   { fg: "#6B4CA8", bg: "#F0ECFA", ring: "#6B4CA826" },
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
 * Blox Fruits — 41 fruits, read off the in-game wiki list.
 *
 * Order and rarity follow the wiki's own grid, where the tile border is the
 * rarity: grey Common, cyan Uncommon, purple Rare, magenta Legendary, red
 * Mythical. That gives 7 / 6 / 4 / 11 / 13, totalling 41.
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

  // ---- Mythical (13) ----
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
  f("Dragon", "Mythical", "Beast", 5000),
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
  opts: { base?: boolean; note?: string } = {},
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
  verified: true,
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
  skin("Dragon", "bf-dragon", "Ember", undefined, true, {
    note: "Winter 2025 Fruit Box, 1% chance.",
  }),
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
 * Royale High halos. Each is tied to the event it was winnable in, and once
 * that event ends trading is the only way to get it — which is exactly why the
 * year belongs in the name.
 */
const ROYALE_HIGH: CatalogItem[] = ([
  ["Corrupt Halo", "Mythical"],
  ["Halloween Halo 2018", "Mythical"],
  ["Winter Crystal Halo 2018", "Mythical"],
  ["Valentines Halo 2019", "Legendary"],
  ["Lucky Halo 2019", "Legendary"],
  ["Easter Halo 2019", "Legendary"],
  ["Mermaid Halo 2019", "Legendary"],
  ["Halloween Halo 2019", "Mythical"],
  ["Autumn Halo 2019", "Legendary"],
  ["Winter Halo 2019", "Mythical"],
  ["Valentines Halo 2020", "Legendary"],
  ["Lucky Halo 2020", "Legendary"],
  ["Spring Halo 2020", "Legendary"],
  ["Mermaid Halo 2020", "Legendary"],
  ["Halloween Halo 2020", "Legendary"],
  ["Winter Halo 2020", "Legendary"],
  ["Valentines Halo 2021", "Legendary"],
  ["Lucky Halo 2021", "Legendary"],
  ["Spring Halo 2021", "Legendary"],
  ["Mermaid Halo 2021", "Legendary"],
  ["Halloween Halo 2021", "Legendary"],
  ["Winter Halo 2021", "Legendary"],
  ["Spring Halo 2022", "Rare"],
  ["Mermaid Halo 2022", "Rare"],
  ["Witching Hour Autumn Halo 2022", "Legendary"],
  ["Winter Halo 2022", "Legendary"],
] as [string, Rarity][]).map(([name, rarity]) => ({
  id: `rh-${name.toLowerCase().replace(/[^a-z0-9]+/g, "-")}`,
  gameSlug: "royale-high",
  name,
  category: "Halo",
  rarity,
  verified: true,
}));

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

/** Grow a Garden. Crops, seeds and pets, with mutation and weight as variants. */
const GARDEN = [
  ...make("grow-a-garden", "gg", "Crop", [
    ["Candy Blossom", "Mythical"], ["Ember Lily", "Legendary"],
    ["Beanstalk", "Legendary"], ["Sugar Apple", "Legendary"],
    ["Moon Melon", "Rare"], ["Dragon Fruit", "Rare"],
    ["Grape", "Rare"], ["Mushroom", "Rare"],
    ["Pepper", "Legendary"], ["Cacao", "Legendary"],
  ] as [string, Rarity][]),
  ...make("grow-a-garden", "gg", "Pet", [
    ["Raccoon", "Mythical"], ["Dragonfly", "Legendary"],
    ["Queen Bee", "Legendary"], ["Disco Bee", "Mythical"],
    ["Butterfly", "Legendary"],
  ] as [string, Rarity][]),
  ...make("grow-a-garden", "gg", "Gear", [
    ["Master Sprinkler", "Legendary"], ["Godly Sprinkler", "Rare"],
    ["Lightning Rod", "Legendary"],
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

/** Games whose catalogue is knowingly incomplete. Surfaced in the interface. */
export const PARTIAL_CATALOGUES: readonly string[] = [
  "adopt-me", "pet-simulator-99", "grow-a-garden", "creatures-of-sonaria",
];

export const CATALOG: readonly CatalogItem[] = [
  ...BLOX_FRUITS, ...BLOX_GAMEPASSES, ...BLOX_SCROLLS, ...BLOX_SKINS,
  ...ADOPT_ME, ...PS99, ...ROYALE_HIGH, ...GARDEN, ...SONARIA,
];

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

export function findItem(id: string): CatalogItem | undefined {
  return CATALOG.find((i) => i.id === id);
}

/** How current this catalogue is. Shown wherever it could mislead. */
export const CATALOG_CHECKED = "September 2026";

/**
 * Per-game notes shown above the catalogue. Empty when nothing needs saying —
 * the Blox Fruits count reconciled once the four renames were resolved.
 */
export const CATALOG_NOTES: Record<string, string> = {
  "blox-fruits":
    "All 41 fruits with their Permanent prices, all seven gamepasses, both " +
    "scroll bundles, and every skin of the eight fruits that have them. A " +
    "fruit's default look is listed for completeness but cannot be traded on " +
    "its own — it comes with the fruit. Robux prices are what the wiki showed " +
    "when this was last checked; they move with updates.",
};

/** Rows that could not be confirmed against the wiki. */
export function unverifiedCount(gameSlug: string): number {
  return catalogFor(gameSlug).filter((i) => i.verified === false).length;
}


/**
 * The variants a listing may state about an item.
 *
 * In Blox Fruits a permanent and a physical of the same fruit are different
 * things at very different values, so the listing has to say which — the same
 * way a trading site shows it on the tile rather than burying it in a note.
 */
export const ITEM_VARIANTS: Record<string, readonly string[]> = {
  // Permanent fruits are the shop's premium form of all 41 fruits. They are a
  // variant rather than 41 extra rows, so "Permanent Dragon" has exactly one
  // representation and matching stays a single key lookup.
  "blox-fruits": ["Permanent", "Physical"],
  "adopt-me": ["Regular", "Neon", "Mega Neon"],
  "pet-simulator-99": ["Normal", "Golden", "Rainbow", "Shiny"],
  "creatures-of-sonaria": ["Child", "Juvenile", "Adult", "Elder"],
  "royale-high": [],
  "grow-a-garden": ["Normal", "Mutated"],
};


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
 * Beli prices are confirmed for 20 of the 41 fruits. The rest are absent rather
 * than derived: the Beli-to-Robux ratio is not constant (Quake is 667×, Portal
 * 950×, Spirit 1333×), so there is no formula to fall back on and a calculated
 * price would be a guess wearing a number's clothes.
 */
export function beliCoverage(): { known: number; total: number } {
  const fruits = catalogFor("blox-fruits").filter((i) => i.category === "Fruit");
  return { known: fruits.filter((i) => i.beli !== undefined).length, total: fruits.length };
}
