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
 * Blox Fruits runs six tiers, not five. Premium is the sixth: paid and
 * admin-exclusive inventory items, which is where the 41 Permanent Fruits sit.
 */
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
   * or half the community cannot find what they are looking for.
   */
  aliases?: readonly string[];
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

const f = (
  name: string,
  rarity: Rarity,
  type: "Natural" | "Elemental" | "Beast",
  aliases?: readonly string[],
): CatalogItem => ({
  id: `bf-${name.toLowerCase().replace(/[^a-z0-9]+/g, "-")}`,
  gameSlug: "blox-fruits",
  name,
  category: "Fruit",
  rarity,
  type,
  aliases,
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
  f("Rocket", "Common", "Natural"),
  f("Spin", "Common", "Natural"),
  f("Blade", "Common", "Natural"),
  f("Spring", "Common", "Natural"),
  f("Bomb", "Common", "Natural"),
  f("Smoke", "Common", "Elemental"),
  f("Spike", "Common", "Natural"),

  // ---- Uncommon (6) ----
  f("Flame", "Uncommon", "Elemental"),
  f("Ice", "Uncommon", "Elemental"),
  f("Sand", "Uncommon", "Elemental"),
  f("Dark", "Uncommon", "Elemental"),
  f("Eagle", "Uncommon", "Beast"),
  f("Diamond", "Uncommon", "Natural"),

  // ---- Rare (4) ----
  f("Light", "Rare", "Elemental"),
  f("Rubber", "Rare", "Natural"),
  f("Ghost", "Rare", "Natural", ["Revive"]),
  f("Magma", "Rare", "Elemental"),

  // ---- Legendary (11) ----
  f("Quake", "Legendary", "Natural"),
  f("Buddha", "Legendary", "Beast"),
  f("Love", "Legendary", "Natural"),
  f("Creation", "Legendary", "Natural", ["Barrier"]),
  f("Spider", "Legendary", "Natural"),
  f("Sound", "Legendary", "Natural"),
  f("Phoenix", "Legendary", "Beast"),
  f("Portal", "Legendary", "Natural"),
  f("Lightning", "Legendary", "Elemental", ["Rumble"]),
  f("Pain", "Legendary", "Natural"),
  f("Blizzard", "Legendary", "Elemental"),

  // ---- Mythical (13) ----
  f("Gravity", "Mythical", "Natural"),
  f("Mammoth", "Mythical", "Beast"),
  f("T-Rex", "Mythical", "Beast"),
  f("Dough", "Mythical", "Natural"),
  f("Shadow", "Mythical", "Elemental"),
  f("Venom", "Mythical", "Natural"),
  f("Gas", "Mythical", "Elemental"),
  f("Spirit", "Mythical", "Natural"),
  f("Tiger", "Mythical", "Beast", ["Leopard"]),
  f("Yeti", "Mythical", "Beast"),
  f("Kitsune", "Mythical", "Beast"),
  f("Control", "Mythical", "Natural"),
  f("Dragon", "Mythical", "Beast"),
];

/**
 * Gamepasses trade alongside fruits in every Blox Fruits trading community, so
 * a catalogue without them is only half a catalogue.
 */
const BLOX_GAMEPASSES: CatalogItem[] = ([
  ["Dark Blade", "Mythical"],
  ["Fruit Notifier", "Legendary"],
  ["Fast Boats", "Rare"],
  ["2x Money", "Rare"],
  ["2x Mastery", "Rare"],
  ["2x Boss Drop Chance", "Rare"],
] as [string, Rarity][]).map(([name, rarity]) => ({
  id: `bf-gp-${name.toLowerCase().replace(/[^a-z0-9]+/g, "-")}`,
  gameSlug: "blox-fruits",
  name,
  category: "Gamepass",
  rarity,
}));

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
  ...BLOX_FRUITS, ...BLOX_GAMEPASSES, ...ADOPT_ME, ...PS99, ...ROYALE_HIGH, ...GARDEN, ...SONARIA,
];

export function catalogFor(gameSlug: string): readonly CatalogItem[] {
  return CATALOG.filter((i) => i.gameSlug === gameSlug);
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
export const CATALOG_NOTES: Record<string, string> = {};

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
