/**
 * The game registry.
 *
 * Every per-game difference in MintPlaza lives here as data, never as a branch
 * inside a component. The shape mirrors the `games` table this will be read
 * from once the database lands, so moving it is a swap of the loader and not a
 * rewrite of anything that consumes it.
 *
 * Adding a seventh game is an entry here plus an item catalogue. It is never a
 * new route tree. (Master spec §2, §5, §36.)
 */

/** Feature areas a game can switch on. Explore renders only what is enabled. */
export type ModuleId =
  | "trades"
  | "inventory"
  | "activities"
  | "help"
  | "services";

/** How a game's items vary. Drives the inventory form and the match keys. */
export interface ItemAttribute {
  key: string;
  label: string;
  /** Fixed options render as a segmented control; free values as an input. */
  options?: readonly string[];
}

export interface Game {
  slug: string;
  name: string;
  /** Used where the full name will not fit — switcher, breadcrumbs, chips. */
  shortName: string;
  /** One line, descriptive. Never a claim about live game state (§17). */
  blurb: string;
  /** What players actually come here to coordinate. Shown on the game home. */
  coordinates: readonly string[];
  modules: readonly ModuleId[];
  /** The vocabulary this game's activities use. Data, not an enum in code. */
  activityKinds: readonly string[];
  itemCategories: readonly string[];
  itemAttributes: readonly ItemAttribute[];
  /** Per-game identity hue, sampled from the artwork. Used for soft glows. */
  hue: string;
  /**
   * Cover art, served from /public/games. One field per game so any image can
   * be swapped without touching a component.
   *
   * These are the games' own promotional images. MintPlaza claims no rights in
   * them and no affiliation with their creators or with Roblox (§30).
   */
  art: string;
}

export const GAMES: readonly Game[] = [
  {
    slug: "blox-fruits",
    name: "Blox Fruits",
    shortName: "Blox Fruits",
    blurb: "Fruit trading, raid teams, and sea hunts that need more players than you have friends online.",
    coordinates: ["Fruit trades", "Raid teams", "Sea hunts", "Progression help"],
    modules: ["trades", "inventory", "activities", "help"],
    activityKinds: ["Raid", "Sea event", "Boss hunt", "Grind session"],
    itemCategories: ["Fruit", "Sword", "Gun", "Accessory", "Material"],
    itemAttributes: [
      { key: "form", label: "Form", options: ["Physical", "Permanent"] },
      { key: "condition", label: "Condition", options: ["Untouched", "Used"] },
    ],
    hue: "#D9542B",
    art: "/games/blox-fruits.jpg",
  },
  {
    slug: "grow-a-garden",
    name: "Grow a Garden",
    shortName: "Garden",
    blurb: "Crop and pet trades, plus coordinating around the weather and mutation windows worth showing up for.",
    coordinates: ["Crop trades", "Mutation windows", "Weather groups", "Garden help"],
    modules: ["trades", "inventory", "activities", "help"],
    activityKinds: ["Weather window", "Mutation run", "Event", "Group session"],
    itemCategories: ["Crop", "Seed", "Pet", "Gear"],
    itemAttributes: [
      { key: "mutation", label: "Mutation", options: ["None", "Mutated"] },
      { key: "weight", label: "Weight", options: [] },
    ],
    hue: "#5BAE3A",
    art: "/games/grow-a-garden.jpg",
  },
  {
    slug: "adopt-me",
    name: "Adopt Me!",
    shortName: "Adopt Me",
    blurb: "Pet trades, and finding the people who will actually sit through a neon or mega project with you.",
    coordinates: ["Pet trades", "Neon projects", "Mega projects", "Task help"],
    modules: ["trades", "inventory", "help", "activities"],
    activityKinds: ["Neon project", "Mega project", "Task run", "Event"],
    itemCategories: ["Pet", "Egg", "Vehicle", "Toy", "Food"],
    itemAttributes: [
      { key: "tier", label: "Tier", options: ["Normal", "Neon", "Mega Neon"] },
      { key: "age", label: "Age", options: ["Newborn", "Junior", "Pre-Teen", "Teen", "Post-Teen", "Full Grown"] },
      { key: "potion", label: "Potion", options: ["None", "Fly", "Ride", "Fly & Ride"] },
    ],
    hue: "#E8B23A",
    art: "/games/adopt-me.jpg",
  },
  {
    slug: "murder-mystery-2",
    name: "Murder Mystery 2",
    shortName: "MM2",
    blurb: "Collectible trades and finding a group when an event is genuinely running, not months after it ended.",
    coordinates: ["Knife trades", "Collection goals", "Event groups", "Value checks"],
    modules: ["trades", "inventory", "activities"],
    activityKinds: ["Event grind", "Collection goal", "Group session"],
    itemCategories: ["Knife", "Gun", "Pet", "Bundle"],
    itemAttributes: [
      { key: "tier", label: "Tier", options: ["Common", "Uncommon", "Rare", "Legendary", "Godly", "Ancient", "Unique"] },
      { key: "chroma", label: "Chroma", options: ["No", "Yes"] },
    ],
    hue: "#D9538F",
    art: "/games/murder-mystery-2.jpg",
  },
  {
    slug: "royale-high",
    name: "Royale High",
    shortName: "Royale High",
    blurb: "Halo and set trades, campus quest partners, and groups for the activities nobody wants to do alone.",
    coordinates: ["Halo trades", "Set trades", "Quest partners", "Campus activities"],
    modules: ["trades", "inventory", "activities", "help"],
    activityKinds: ["Quest run", "Campus activity", "Pageant", "Event"],
    itemCategories: ["Halo", "Set", "Accessory", "Skirt", "Heels", "Wings"],
    itemAttributes: [
      { key: "kind", label: "Kind", options: ["Halo", "Set piece", "Accessory"] },
      { key: "season", label: "Season", options: [] },
    ],
    hue: "#D98BC4",
    art: "/games/royale-high.jpg",
  },
  {
    slug: "creatures-of-sonaria",
    name: "Creatures of Sonaria",
    shortName: "Sonaria",
    blurb: "Creature trades and pack recruitment for the missions that are built to need a group.",
    coordinates: ["Creature trades", "Pack missions", "Daily & weekly runs", "Survival groups"],
    modules: ["trades", "inventory", "activities", "help"],
    activityKinds: ["Pack mission", "Daily mission", "Weekly mission", "Event mission"],
    itemCategories: ["Creature", "Skin", "Item"],
    itemAttributes: [
      { key: "stage", label: "Stage", options: ["Child", "Juvenile", "Adult", "Elder"] },
      { key: "variant", label: "Variant", options: ["Standard", "Variant"] },
    ],
    hue: "#4E8FB5",
    art: "/games/creatures-of-sonaria.jpg",
  },
] as const;

export const DEFAULT_GAME_SLUG = GAMES[0].slug;

export function getGame(slug: string): Game | undefined {
  return GAMES.find((g) => g.slug === slug);
}

export function hasModule(game: Game, id: ModuleId): boolean {
  return game.modules.includes(id);
}

/** Human labels for module ids, kept beside the type so they cannot drift. */
export const MODULE_LABELS: Record<ModuleId, string> = {
  trades: "Trades",
  inventory: "Inventory",
  activities: "Activities",
  help: "Help",
  services: "Services",
};
