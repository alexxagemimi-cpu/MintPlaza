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
  /**
   * When this row's numbers were last touched, ISO.
   *
   * Values are a snapshot of a market that moves daily, and a snapshot with no
   * date on it is indistinguishable from a fact. Shown beside the value as
   * "checked 3 days ago" so a trader can weigh it — and it moves every time the
   * control panel saves, so it stays true without anybody maintaining it.
   *
   * Only rows from the database carry one. The seeded catalogue falls back to
   * the date stamped on VALUE_SOURCE.
   */
  checkedAt?: string;
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
 * 59. The thirteen missing names are missing on purpose rather than padded out
 * — see CATALOG_GAPS.
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

export const CATALOG: readonly CatalogItem[] = [
  ...BLOX_FRUITS, ...BLOX_GAMEPASSES, ...BLOX_SCROLLS, ...BLOX_SKINS,
  ...ADOPT_ME, ...PS99, ...ROYALE_HIGH, ...GARDEN, ...SONARIA,
  ...FISCH_CATALOG, ...GAG2_CATALOG,
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
    "All 42 fruits with their Permanent prices — including Magnet, added in " +
    "Update 30 — all seven gamepasses, both scroll bundles, and every skin of " +
    "the eight fruits that have them. A fruit's default look is listed for " +
    "completeness but cannot be traded on its own: it comes with the fruit. " +
    "Robux prices are what the wiki showed when this was last checked; they " +
    "move with updates.",

  fisch:
    "The four tiers players actually chase and trade, in full: 11 Divine " +
    "Secret, 11 Apex, 40 Secret and 54 Exotic fish. Everything below them — " +
    "roughly a thousand Common through Mythical fish, 531 rod skins, 312 " +
    "boats and 354 bobbers — is bulk that belongs in a machine pull from the " +
    "wiki's own data modules rather than in a hand-typed list. Rods, totems " +
    "and bait are here so you can see them, and are marked untradeable: the " +
    "single most expensive mix-up in this game is a rod SKIN, which trades, " +
    "and the ROD it dresses, which never does.",

  gag2:
    "All 33 seeds and crops plus the two mutation seeds, cross-checked " +
    "between the official wiki and the community seed list. Nine rows are " +
    "marked unverified and that is the honest state of them: every Mythic and " +
    "Super price circulating online except Venus Fly Trap's comes from " +
    "third-party lists that contradict each other by a factor of three. Pets " +
    "and eggs are not here yet — sources cannot even agree whether there are " +
    "22, 30, 35 or 36 pets, so the table waits for the official one.",
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
 * Missing numbers stay missing
 * ---------------------------------------------------------------------------
 *
 * `multipliers` holds only figures confirmed on a game's own wiki, each with
 * the date it was read. `unconfirmed` names the variants that exist but whose
 * multiplier nobody has pinned down — Fisch has around two hundred of those and
 * the third-party lists circulating for them contradict each other and the
 * wiki. Naming them is useful; guessing what they are worth is not.
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
  /** Confirmed value multipliers, keyed by option name. */
  multipliers?: Readonly<Record<string, number>>;
  /** Named, real, and of unknown value. Shown as such, never estimated. */
  unconfirmed?: readonly string[];
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
      { key: "mutation", label: "Mutation", stacks: false,
        options: ["Aether", "Prism", "Prismize", "Prismatic"] },
    ],
    multipliers: {
      // Every figure below is off fischipedia's own page for that mutation,
      // with the date it was last edited. Third-party lists still print Aether
      // at 12x — that is the pre-balance number and it is wrong.
      Aether: 15,      // fischipedia/Aether, 29 Aug 2026
      Prism: 8,        // fischipedia/Prism, 1 Sep 2026
      Prismize: 6.5,   // fischipedia/Prismize, 30 Aug 2026 (was 8x before the Rift update)
      Prismatic: 6.5,  // fischipedia/Prismatic, 20 Aug 2026
      Shiny: 1.85,     // an attribute, not a mutation, and it stacks on top
    },
    unconfirmed: [
      "Tryhard", "Galaxy", "Glowy", "Chaotic", "Plagued", "Darkness",
      "Melody", "Scavenged", "Singularity", "Synth",
      "Bathyal", "Darkheart", "Hadal", "Light", "Thalassic",
    ],
    note: "A fish carries at most one mutation and any number of attributes. Size tags (Big, Giant, Tiny) describe weight and do not change what it is worth. The unconfirmed list is real mutations whose multiplier the official wiki has not been read for — the numbers circulating for them on other sites disagree with each other.",
  },

  "adopt-me": {
    axes: [
      { key: "neon", label: "Neon", options: ["Normal", "Neon", "Mega Neon"] },
      { key: "potion", label: "Ability", options: ["No Potion", "Fly", "Ride", "Fly-Ride"] },
    ],
    note: "These combine into a grid, not a ladder: a Mega Neon Fly-Ride (players write it MFR) is one pet with two tags. Neon takes four Full Grown of the same pet and Mega takes four Neons, which is why the gap in value is so large. Every combination is priced separately by the community.",
  },

  "pet-simulator-99": {
    axes: [
      { key: "tint", label: "Tint", options: ["Normal", "Golden", "Rainbow", "Shiny", "Shiny Golden", "Shiny Rainbow"] },
    ],
    note: "Shiny stacks on top of Golden and Rainbow, which is why the last two entries exist. None of these is a rarity — the game's own API carries the pet type separately, and an exists count is a better measure of scarcity than any tier.",
  },

  "creatures-of-sonaria": {
    // Deliberately empty. Growth stages are not tradeable variants, and
    // palettes and materials are standalone items with their own rows and
    // their own values — some worth more than the creatures they go on.
    axes: [],
    note: "Sonaria has no tint system. A creature is a creature; Colour Palettes and Material Palettes are separate tradeable items, not tags, and the top ones trade for more than most creatures do.",
  },

  gag2: {
    axes: [
      { key: "variant", label: "Pet variant", options: ["Normal", "Big", "Mega", "Rainbow"] },
      { key: "mutation", label: "Crop mutation", stacks: false,
        options: ["Gold", "Rainbow", "Glow", "Aurora", "Ignited", "Frozen", "Electric", "Starstruck", "Bloodlit"] },
    ],
    multipliers: {
      // Pet variants, following Fandom where Miraheze dissents. The community
      // and every downstream calculator agree with Fandom; Miraheze's 1.25x /
      // 1.75x is the minority reading and looks like a stale patch.
      Big: 2, Mega: 3,
      // Crop mutations. Community-tested, not published by the developer.
      Gold: 10, Glow: 100, Aurora: 90, Ignited: 60,
    },
    unconfirmed: ["Frozen", "Electric", "Starstruck", "Bloodlit"],
    note: "Two systems that share a word. A PET variant (Big x2, Mega x3, Rainbow x1.25, and they stack — Mega Rainbow is x3.75) is not a CROP mutation (Gold x10, Glow x100), and Rainbow exists in both with different numbers. One mutation per crop, no stacking. Mega used to be called Huge; it is the same tier renamed.",
  },

  "grow-a-garden": {
    axes: [{ key: "mutation", label: "Mutation", options: ["Normal", "Mutated"] }],
    note: "The original Grow a Garden, which is a different game from GAG2 and has its own wiki. Not yet researched to the depth of the others.",
  },

  "royale-high": { axes: [] },
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

/** What a confirmed multiplier does to a value, or nothing if unknown. */
export function multiplierFor(gameSlug: string, option: string): number | undefined {
  return VARIANTS[gameSlug]?.multipliers?.[option];
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
 * Beli prices are confirmed for 20 of the 41 fruits. The rest are absent rather
 * than derived: the Beli-to-Robux ratio is not constant (Quake is 667×, Portal
 * 950×, Spirit 1333×), so there is no formula to fall back on and a calculated
 * price would be a guess wearing a number's clothes.
 */
export function beliCoverage(): { known: number; total: number } {
  const fruits = catalogFor("blox-fruits").filter((i) => i.category === "Fruit");
  return { known: fruits.filter((i) => i.beli !== undefined).length, total: fruits.length };
}
