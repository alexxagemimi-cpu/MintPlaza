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
   * False where the rarity or existence could not be confirmed against the
   * game wiki. Shown in admin so the uncertain rows can be corrected first,
   * rather than quietly presented as fact.
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
  verified = true,
): CatalogItem => ({
  id: `bf-${name.toLowerCase().replace(/[^a-z0-9]+/g, "-")}`,
  gameSlug: "blox-fruits",
  name,
  category: "Fruit",
  rarity,
  type,
  verified,
});

/**
 * Blox Fruits — checked against the game wiki, September 2026.
 *
 * The wiki puts the total at 41 fruits across six rarities. Corrections made
 * after checking, each of which had been wrong here:
 *
 *   Leopard and Tiger are ONE fruit. Leopard was reworked and renamed to
 *   Tiger, so the old name is gone rather than being a second entry.
 *   Rumble is likewise the old name for Lightning.
 *   Quake and Buddha are Legendary, not Rare.
 *   Light is Rare, not Uncommon.
 *   Gravity is not among the eleven Legendary fruits, so it sits in Mythical.
 *   Shark exists and was missing entirely.
 *
 * The eleven Legendary fruits are named explicitly on the wiki and are the
 * most reliable rows here. The Common, Uncommon and Rare split is the least
 * reliable: entries marked unverified could not be confirmed and need a
 * player's eye before they are trusted.
 */
const BLOX_FRUITS: CatalogItem[] = [
  // ---- Common ----
  f("Rocket", "Common", "Natural"),
  f("Spin", "Common", "Natural"),
  f("Chop", "Common", "Natural", false),
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
  f("Barrier", "Rare", "Natural", false),
  f("Ghost", "Rare", "Natural"),
  f("Magma", "Rare", "Elemental"),
  f("Revive", "Rare", "Natural", false),

  // ---- Legendary — the wiki names these eleven ----
  f("Quake", "Legendary", "Natural"),
  f("Buddha", "Legendary", "Beast"),
  f("Love", "Legendary", "Natural"),
  f("Spider", "Legendary", "Natural"),
  f("Sound", "Legendary", "Natural"),
  f("Phoenix", "Legendary", "Beast"),
  f("Portal", "Legendary", "Natural"),
  f("Lightning", "Legendary", "Elemental"),
  f("Pain", "Legendary", "Natural"),
  f("Blizzard", "Legendary", "Elemental"),
  f("Creation", "Legendary", "Natural"),

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
  f("Tiger", "Mythical", "Beast"),
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
 * An open discrepancy, stated rather than hidden.
 *
 * The wiki puts Blox Fruits at 41 fruits. This catalogue lists 45 after the
 * corrections above, which means roughly four entries are either renamed
 * duplicates or no longer in the game. The unverified rows are the suspects.
 * Rather than quietly present a number that does not add up, the interface
 * says so and the rows stay editable.
 */
export const CATALOG_NOTES: Record<string, string> = {
  "blox-fruits":
    "The wiki counts 41 fruits; this list has 45, so about four are likely renamed duplicates or removed. Unverified rows are the ones to check first.",
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
  "blox-fruits": ["Permanent", "Physical"],
  "adopt-me": ["Regular", "Neon", "Mega Neon"],
  "pet-simulator-99": ["Normal", "Golden", "Rainbow", "Shiny"],
  "creatures-of-sonaria": ["Child", "Juvenile", "Adult", "Elder"],
  "royale-high": [],
  "grow-a-garden": ["Normal", "Mutated"],
};
