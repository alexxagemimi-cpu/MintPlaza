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
  | "Common" | "Uncommon" | "Rare" | "Legendary" | "Mythical" | "Premium";

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
 * Blox Fruits — checked against the game wiki, September 2026, and corrected
 * by a player who knows the game.
 *
 * Totals 43, which matches community documentation for August 2026.
 *
 * Four entries here are renames rather than separate fruits, and each keeps
 * its old name as a searchable alias because players go on using them:
 *
 *   Barrier  was reworked into Creation
 *   Revive   was reworked into Ghost
 *   Leopard  was reworked and renamed to Tiger
 *   Rumble   was renamed to Lightning
 *
 * Also corrected from an earlier draft: Quake and Buddha are Legendary rather
 * than Rare, Light is Rare rather than Uncommon, Gravity is Mythical since it
 * is not among the eleven Legendary fruits the wiki names, and Shark was
 * missing entirely.
 */
const BLOX_FRUITS: CatalogItem[] = [
  // ---- Common ----
  f("Rocket", "Common", "Natural"),
  f("Spin", "Common", "Natural"),
  f("Chop", "Common", "Natural"),
  f("Blade", "Common", "Natural"),
  f("Spring", "Common", "Natural"),
  f("Bomb", "Common", "Natural"),
  f("Smoke", "Common", "Elemental"),
  f("Spike", "Common", "Natural"),

  // ---- Uncommon ----
  f("Flame", "Uncommon", "Elemental"),
  f("Ice", "Uncommon", "Elemental"),
  f("Sand", "Uncommon", "Elemental"),
  f("Dark", "Uncommon", "Elemental"),
  f("Eagle", "Uncommon", "Beast"),
  f("Diamond", "Uncommon", "Natural"),

  // ---- Rare ----
  f("Light", "Rare", "Elemental"),
  f("Rubber", "Rare", "Natural"),
  f("Ghost", "Rare", "Natural", ["Revive"]),
  f("Magma", "Rare", "Elemental"),

  // ---- Legendary — the wiki names these eleven ----
  f("Quake", "Legendary", "Natural"),
  f("Buddha", "Legendary", "Beast"),
  f("Love", "Legendary", "Natural"),
  f("Spider", "Legendary", "Natural"),
  f("Sound", "Legendary", "Natural"),
  f("Phoenix", "Legendary", "Beast"),
  f("Portal", "Legendary", "Natural"),
  f("Lightning", "Legendary", "Elemental", ["Rumble"]),
  f("Pain", "Legendary", "Natural"),
  f("Blizzard", "Legendary", "Elemental"),
  f("Creation", "Legendary", "Natural", ["Barrier"]),

  // ---- Mythical ----
  f("Gravity", "Mythical", "Natural"),
  f("Shark", "Mythical", "Beast"),
  f("Mammoth", "Mythical", "Beast"),
  f("T-Rex", "Mythical", "Beast"),
  f("Dough", "Mythical", "Natural"),
  f("Shadow", "Mythical", "Elemental"),
  f("Venom", "Mythical", "Natural"),
  f("Control", "Mythical", "Natural"),
  f("Spirit", "Mythical", "Natural"),
  f("Gas", "Mythical", "Elemental"),
  f("Tiger", "Mythical", "Beast", ["Leopard"]),
  f("Yeti", "Mythical", "Beast"),
  f("Dragon", "Mythical", "Beast"),
  f("Kitsune", "Mythical", "Beast"),
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
 * Starter catalogues for the other five. Deliberately small — enough to build
 * and test the listing flow against, not a claim to be complete. These grow
 * through the admin surface, and through what players actually list.
 */
const ADOPT_ME = make("adopt-me", "am", "Pet", [
  ["Shadow Dragon", "Legendary"], ["Bat Dragon", "Legendary"],
  ["Frost Dragon", "Legendary"], ["Giraffe", "Legendary"],
  ["Parrot", "Legendary"], ["Crow", "Legendary"],
  ["Owl", "Legendary"], ["Unicorn", "Legendary"],
  ["Kangaroo", "Rare"], ["Turtle", "Rare"],
]);

const PS99 = make("pet-simulator-99", "ps", "Pet", [
  ["Huge Cat", "Mythical"], ["Huge Pixel Cat", "Mythical"],
  ["Titanic Pegasus", "Mythical"], ["Huge Dragon", "Mythical"],
  ["Huge Hacked Cat", "Mythical"], ["Huge Balloon Cat", "Mythical"],
]);

const ROYALE_HIGH = make("royale-high", "rh", "Halo", [
  ["Winter Halo 2019", "Mythical"], ["Halloween Halo 2019", "Mythical"],
  ["Autumn Halo 2020", "Legendary"], ["Valentines Halo 2021", "Legendary"],
  ["Summer Halo 2021", "Legendary"], ["Corrupt Halo", "Mythical"],
]);

const GARDEN = make("grow-a-garden", "gg", "Crop", [
  ["Candy Blossom", "Mythical"], ["Ember Lily", "Legendary"],
  ["Beanstalk", "Legendary"], ["Sugar Apple", "Legendary"],
  ["Moon Melon", "Rare"], ["Dragon Fruit", "Rare"],
]);

const SONARIA = make("creatures-of-sonaria", "cs", "Creature", [
  ["Kavouradis", "Mythical"], ["Boreacal", "Legendary"],
  ["Nyctosaurus", "Legendary"], ["Aurelvis", "Legendary"],
  ["Sarco", "Rare"], ["Vithura", "Rare"],
]);

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
