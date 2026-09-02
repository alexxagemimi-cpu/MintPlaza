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

export type Rarity = "Common" | "Uncommon" | "Rare" | "Legendary" | "Mythical";

export interface CatalogItem {
  id: string;
  gameSlug: string;
  name: string;
  category: string;
  rarity?: Rarity;
  /** Game-specific secondary classification, e.g. Blox Fruits fruit type. */
  type?: string;
  art?: string;
}

/** Tile colours by rarity. Restrained — this is a label, not a rainbow. */
export const RARITY_STYLE: Record<Rarity, { fg: string; bg: string; ring: string }> = {
  Common:    { fg: "#5A6B65", bg: "#EEF2F0", ring: "#0D161314" },
  Uncommon:  { fg: "#2F7D57", bg: "#E6F4EC", ring: "#2F7D5726" },
  Rare:      { fg: "#2C6C9E", bg: "#E7F0F8", ring: "#2C6C9E26" },
  Legendary: { fg: "#8A5A12", bg: "#FBF1E0", ring: "#8A5A1226" },
  Mythical:  { fg: "#9B3B6E", bg: "#FAEBF2", ring: "#9B3B6E26" },
};

const f = (
  name: string,
  rarity: Rarity,
  type: "Natural" | "Elemental" | "Beast",
): CatalogItem => ({
  id: `bf-${name.toLowerCase().replace(/[^a-z0-9]+/g, "-")}`,
  gameSlug: "blox-fruits",
  name,
  category: "Fruit",
  rarity,
  type,
});

/**
 * Blox Fruits.
 *
 * Community documentation counted 43 fruits in August 2026 across 23 Natural,
 * 11 Elemental and 9 Beast. Sources disagree at the margins — a few fruits sit
 * on the Legendary/Mythical boundary depending on who is counting — so treat
 * rarity here as a starting point to correct, not as settled.
 */
const BLOX_FRUITS: CatalogItem[] = [
  f("Rocket", "Common", "Natural"),
  f("Spin", "Common", "Natural"),
  f("Blade", "Common", "Natural"),
  f("Spring", "Common", "Natural"),
  f("Bomb", "Common", "Natural"),
  f("Smoke", "Common", "Elemental"),
  f("Spike", "Common", "Natural"),

  f("Flame", "Uncommon", "Elemental"),
  f("Ice", "Uncommon", "Elemental"),
  f("Sand", "Uncommon", "Elemental"),
  f("Dark", "Uncommon", "Elemental"),
  f("Eagle", "Uncommon", "Beast"),
  f("Diamond", "Uncommon", "Natural"),
  f("Light", "Uncommon", "Elemental"),

  f("Rubber", "Rare", "Natural"),
  f("Ghost", "Rare", "Natural"),
  f("Magma", "Rare", "Elemental"),
  f("Quake", "Rare", "Natural"),
  f("Buddha", "Rare", "Beast"),
  f("Love", "Rare", "Natural"),
  f("Creation", "Rare", "Natural"),
  f("Spider", "Rare", "Natural"),

  f("Sound", "Legendary", "Natural"),
  f("Phoenix", "Legendary", "Beast"),
  f("Portal", "Legendary", "Natural"),
  f("Lightning", "Legendary", "Elemental"),
  f("Pain", "Legendary", "Natural"),
  f("Blizzard", "Legendary", "Elemental"),

  f("Gravity", "Mythical", "Natural"),
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
  f("Leopard", "Mythical", "Beast"),
  f("Kitsune", "Mythical", "Beast"),
  f("Dragon", "Mythical", "Beast"),
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
  ...BLOX_FRUITS, ...ADOPT_ME, ...PS99, ...ROYALE_HIGH, ...GARDEN, ...SONARIA,
];

export function catalogFor(gameSlug: string): readonly CatalogItem[] {
  return CATALOG.filter((i) => i.gameSlug === gameSlug);
}

export function findItem(id: string): CatalogItem | undefined {
  return CATALOG.find((i) => i.id === id);
}

/** How current this catalogue is. Shown wherever it could mislead. */
export const CATALOG_CHECKED = "September 2026";
