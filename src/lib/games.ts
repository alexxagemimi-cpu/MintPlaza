/**
 * The game registry.
 *
 * Every per-game difference in MintPlaza lives here as data, never as a branch
 * inside a component. The shape mirrors the `games` table this will be read
 * from once the database lands.
 *
 * The contents are researched, not assumed — item attributes match how each
 * game's community actually describes and values things, and `wants` are the
 * requests players genuinely post, taken from the trading and recruitment
 * communities for each game. Sources are noted per game.
 *
 * All of it is mutable. These games change monthly, so nothing here should
 * ever be treated as permanently true; once the admin surface exists this
 * becomes editable content rather than code (§17, §45).
 */

export type ModuleId = "trades" | "inventory" | "activities" | "help" | "services";

/** How a game's items vary. Drives the inventory form and the match keys. */
export interface ItemAttribute {
  key: string;
  label: string;
  /** Fixed options render as a segmented control; free values as an input. */
  options?: readonly string[];
}

/**
 * What players in this game actually ask for.
 *
 * Four shapes cover every request seen across all six communities:
 *   trade — I have X, I want Y
 *   group — this needs N people and I have fewer
 *   help  — I am stuck and someone who is not stuck could unstick me
 *   check — is this fair? what is this worth?
 *
 * The fourth is the one no Discord solves well, and every one of these games
 * has a community that does it by hand all day.
 */
export type WantKind = "trade" | "group" | "help" | "check";

export interface Want {
  /** Phrased the way a player would type it. */
  label: string;
  kind: WantKind;
  /** The real constraint, where the activity has one. */
  detail?: string;
}

/**
 * A section inside Explore. Every game gets three, and the shape is always the
 * same: what you can trade, what you can ask other players to do with you, and
 * where the community organises itself. Only the middle one changes name and
 * meaning between games.
 */
export interface ExploreTab {
  id: string;
  label: string;
  blurb: string;
  kind: "trades" | "services" | "community";
}

export interface Game {
  slug: string;
  name: string;
  shortName: string;
  blurb: string;
  modules: readonly ModuleId[];
  wants: readonly Want[];
  /** The three sections inside Explore for this game. */
  exploreTabs: readonly ExploreTab[];
  /** What the Explore card on the dashboard advertises. Changes per game. */
  exploreHighlights: readonly string[];
  activityKinds: readonly string[];
  itemCategories: readonly string[];
  itemAttributes: readonly ItemAttribute[];
  /** In-game gate on trading at all, where one exists. Shown, not enforced. */
  tradeGate?: string;
  hue: string;
  art: string;
  /** Where the above came from, and when. Shown in admin, not to players. */
  sourceNote: string;
}

export const GAMES: readonly Game[] = [
  {
    slug: "blox-fruits",
    name: "Blox Fruits",
    shortName: "Blox Fruits",
    blurb:
      "Raid teams, sea hunts and fruit trades — the things that need more players than you have friends online.",
    modules: ["trades", "inventory", "activities", "help"],
    wants: [
      { label: "Need 2 more for Dough King", kind: "group", detail: "2–4 players · 7.5 minute timer" },
      { label: "Leviathan hunt forming", kind: "group", detail: "10% damage per segment to get drops" },
      { label: "3 for Race V4 — all different races", kind: "group", detail: "Third Sea · V3 or above" },
      { label: "Terrorshark hunt, who's in?", kind: "group" },
      { label: "Anyone got Mirage Island up?", kind: "help" },
      { label: "Bounty hunting partner", kind: "group" },
      { label: "Perm Kitsune for Perm East Dragon", kind: "trade" },
      { label: "Is this W/F/L?", kind: "check" },
      { label: "Third Sea level grind help", kind: "help" },
    ],
    exploreTabs: [
      { id: "trades", label: "Trade & Offers", kind: "trades",
        blurb: "Every fruit, sword, gun and material on offer, with what each trader wants back." },
      { id: "raids", label: "Raids & Services", kind: "services",
        blurb: "Raid carries, V4 trials, puzzle steps and boss runs \u2014 the things that need one or two people, not a crew." },
      { id: "community", label: "Help & Recruitment", kind: "community",
        blurb: "Crews recruiting, grind partners, and anyone stuck who could use a hand." },
    ],
    exploreHighlights: ["Trades", "Raid help", "Leviathan hunt", "Dough King recruit", "V4 trials"],
    activityKinds: ["Raid", "Sea event", "Boss hunt", "Race awakening", "Grind session"],
    itemCategories: ["Fruit", "Sword", "Gun", "Fighting style", "Accessory", "Material"],
    itemAttributes: [
      { key: "form", label: "Form", options: ["Physical", "Permanent"] },
    ],
    hue: "#D9542B",
    art: "/games/blox-fruits.jpg",
    sourceNote:
      "Raid and sea-event requirements from Blox Fruits community documentation; requests from active Blox Fruits trading and raid Discord communities. Checked September 2026.",
  },

  {
    slug: "grow-a-garden",
    name: "Grow a Garden",
    shortName: "Garden",
    blurb:
      "Pet, seed and sheckle trades, plus getting a shout when the weather worth planting for actually arrives.",
    modules: ["trades", "inventory", "activities", "help"],
    wants: [
      { label: "Ping me on the next weather event", kind: "group" },
      { label: "Mutation run — who's in?", kind: "group" },
      { label: "Trading pets for sheckles", kind: "trade" },
      { label: "Pet weight check", kind: "check" },
      { label: "W/F/L on this?", kind: "check" },
      { label: "Help finishing an event set", kind: "help" },
    ],
    exploreTabs: [
      { id: "trades", label: "Trade & Offers", kind: "trades",
        blurb: "Pets, seeds, gear and sheckles, with weights and mutations stated up front." },
      { id: "weather", label: "Weather & Server Help", kind: "services",
        blurb: "Weather windows worth joining, restock watches, and people sharing a server." },
      { id: "community", label: "Help & Recruitment", kind: "community",
        blurb: "Mutation runs, event sets, and gardeners looking for company." },
    ],
    exploreHighlights: ["Trades", "Weather pings", "Server help", "Mutation runs"],
    activityKinds: ["Weather window", "Mutation run", "Event", "Group session"],
    itemCategories: ["Crop", "Seed", "Pet", "Gear", "Cosmetic"],
    itemAttributes: [
      { key: "mutation", label: "Mutation", options: ["None", "Mutated"] },
      { key: "weight", label: "Weight (kg)" },
    ],
    hue: "#5BAE3A",
    art: "/games/grow-a-garden.jpg",
    sourceNote:
      "Weather, mutation and event mechanics from Grow a Garden community documentation; requests from Grow a Garden trading communities. Checked September 2026.",
  },

  {
    slug: "adopt-me",
    name: "Adopt Me!",
    shortName: "Adopt Me",
    blurb:
      "Pet trades, and finding people who will actually sit through a neon or mega project with you.",
    modules: ["trades", "inventory", "help", "activities"],
    wants: [
      { label: "Need 3 more Full Grown for a neon", kind: "group", detail: "4 Full Grown of the same pet" },
      { label: "Mega project — 16 pets deep", kind: "group", detail: "4 Luminous neons" },
      { label: "Can someone help age my pets?", kind: "help" },
      { label: "MFR Frost for NFR Shadow", kind: "trade" },
      { label: "Is this W/F/L?", kind: "check" },
      { label: "Task help, I keep missing them", kind: "help" },
    ],
    exploreTabs: [
      { id: "trades", label: "Trade & Offers", kind: "trades",
        blurb: "Pets with tier, age and potion stated, so nobody has to ask twice." },
      { id: "projects", label: "Projects & Services", kind: "services",
        blurb: "Neon and mega projects looking for parts, and players offering aging and task help." },
      { id: "community", label: "Help & Recruitment", kind: "community",
        blurb: "Trade licence help, new players finding their feet, and general company." },
    ],
    exploreHighlights: ["Trades", "Neon projects", "Aging help", "Task runs"],
    activityKinds: ["Neon project", "Mega project", "Aging help", "Task run", "Event"],
    itemCategories: ["Pet", "Egg", "Vehicle", "Toy", "Stroller", "Food"],
    itemAttributes: [
      { key: "tier", label: "Tier", options: ["Regular", "Neon", "Mega Neon"] },
      {
        key: "age",
        label: "Age",
        options: ["Newborn", "Junior", "Pre-Teen", "Teen", "Post-Teen", "Full Grown"],
      },
      { key: "potion", label: "Potion", options: ["No Potion", "Fly", "Ride", "Fly & Ride"] },
    ],
    hue: "#E8B23A",
    art: "/games/adopt-me.jpg",
    sourceNote:
      "Neon and mega requirements, age ladder and potion combinations from Adopt Me community documentation; requests from Adopt Me trading communities. Checked September 2026.",
  },

  {
    slug: "pet-simulator-99",
    name: "Pet Simulator 99",
    shortName: "PS99",
    blurb:
      "Huge, Titanic and Exclusive trades, value checks before you accept, and people to run a clan with.",
    modules: ["trades", "inventory", "help", "activities"],
    wants: [
      { label: "Trading a Huge for a Titanic", kind: "trade" },
      { label: "Rainbow Huge — what's it worth?", kind: "check" },
      { label: "Looking for Exclusives", kind: "trade" },
      { label: "Clan mates wanted", kind: "group" },
      { label: "Which enchants should I run?", kind: "help" },
      { label: "Check this before I accept", kind: "check" },
    ],
    exploreTabs: [
      { id: "trades", label: "Trade & Offers", kind: "trades",
        blurb: "Huges, Titanics and Exclusives with variant and level shown before you open a trade." },
      { id: "clans", label: "Clans & Services", kind: "services",
        blurb: "Clans recruiting for the level bonuses, plus enchant and farming route advice." },
      { id: "community", label: "Help & Recruitment", kind: "community",
        blurb: "Value questions, rebirth pushes, and people to grind alongside." },
    ],
    exploreHighlights: ["Trades", "Value checks", "Clan recruit", "Enchant advice"],
    activityKinds: ["Clan", "Event", "Group session"],
    itemCategories: ["Pet", "Egg", "Enchant", "Charm", "Item"],
    itemAttributes: [
      {
        key: "rarity",
        label: "Rarity",
        options: [
          "Basic", "Rare", "Epic", "Legendary", "Mythical", "Exotic",
          "Divine", "Superior", "Celestial", "Secret", "Exclusive",
        ],
      },
      // Huge, Titanic and Gargantuan are subgroups of the Exclusive rarity,
      // not rarities of their own.
      { key: "class", label: "Exclusive class", options: ["None", "Huge", "Titanic", "Gargantuan"] },
      // Variants are damage enhancements layered on a pet, not rarities.
      { key: "variant", label: "Variant", options: ["Normal", "Golden", "Rainbow", "Shiny"] },
      { key: "level", label: "Level" },
    ],
    hue: "#D9538F",
    art: "/games/pet-simulator-99.jpg",
    sourceNote:
      "Rarity ladder, Exclusive subgroups and variant enhancements from Pet Simulator community documentation; requests from PS99 trading communities. Checked September 2026.",
  },

  {
    slug: "royale-high",
    name: "Royale High",
    shortName: "Royale High",
    blurb:
      "Halo and set trades, diamond grinding company, and partners for the quests nobody wants to do alone.",
    modules: ["trades", "inventory", "activities", "help"],
    wants: [
      { label: "Trading a Winter halo", kind: "trade" },
      { label: "Halo value check", kind: "check" },
      { label: "Diamond farming partner", kind: "help" },
      { label: "Campus quest help", kind: "help" },
      { label: "Grinding to level 75 so I can trade", kind: "help", detail: "Trading unlocks at level 75" },
      { label: "Anyone doing the seasonal set?", kind: "group" },
    ],
    exploreTabs: [
      { id: "trades", label: "Trade & Offers", kind: "trades",
        blurb: "Halos and sets by series, with diamond expectations stated openly." },
      { id: "quests", label: "Quests & Services", kind: "services",
        blurb: "Campus quest partners, class runs, and diamond grinding company." },
      { id: "community", label: "Help & Recruitment", kind: "community",
        blurb: "Getting to level 75, seasonal sets, and players to do it with." },
    ],
    exploreHighlights: ["Trades", "Halo checks", "Quest partners", "Diamond grinding"],
    activityKinds: ["Quest run", "Campus activity", "Diamond grind", "Seasonal event"],
    itemCategories: ["Halo", "Set", "Accessory", "Skirt", "Heels", "Wings"],
    itemAttributes: [
      { key: "kind", label: "Kind", options: ["Halo", "Set piece", "Accessory"] },
      {
        key: "series",
        label: "Series",
        options: ["Everfriend", "Flowering", "Tidalglow", "Eveningfall", "Glitterfrost", "Other"],
      },
    ],
    tradeGate: "Trading in Royale High unlocks at level 75.",
    hue: "#D98BC4",
    art: "/games/royale-high.jpg",
    sourceNote:
      "Halo series, the level 75 trading gate and diamond sources from Royale High community documentation; requests from Royale High trading communities. Checked September 2026.",
  },

  {
    slug: "creatures-of-sonaria",
    name: "Creatures of Sonaria",
    shortName: "Sonaria",
    blurb:
      "Creature trades where the details decide the value, and packs for the missions built to need a group.",
    modules: ["trades", "inventory", "activities", "help"],
    wants: [
      { label: "Pack mission group forming", kind: "group" },
      { label: "Trading an Adult creature", kind: "trade" },
      { label: "W/F/L on this trade?", kind: "check" },
      { label: "Mush grinding help", kind: "help" },
      { label: "Looking for a specific palette", kind: "trade" },
      { label: "Anyone running dailies?", kind: "group" },
    ],
    exploreTabs: [
      { id: "trades", label: "Trade & Offers", kind: "trades",
        blurb: "Creatures with stage, gender, mutation and palette, because all four move the value." },
      { id: "missions", label: "Missions & Packs", kind: "services",
        blurb: "Pack missions forming, daily and weekly runs, and escorts through kill-on-sight ground." },
      { id: "community", label: "Help & Recruitment", kind: "community",
        blurb: "Growing partners, mush grinding, and packs taking new members." },
    ],
    exploreHighlights: ["Trades", "Pack missions", "Daily runs", "Growing escort"],
    activityKinds: ["Pack mission", "Daily mission", "Weekly mission", "Monthly mission", "Event mission"],
    itemCategories: ["Creature", "Plushie", "Token", "Palette", "Material", "Skin"],
    itemAttributes: [
      { key: "stage", label: "Stage", options: ["Child", "Juvenile", "Adult", "Elder"] },
      { key: "gender", label: "Gender", options: ["Male", "Female"] },
      { key: "mutation", label: "Mutation" },
      { key: "palette", label: "Palette" },
    ],
    hue: "#4E8FB5",
    art: "/games/creatures-of-sonaria.jpg",
    sourceNote:
      "Trading factors (species, mutation, traits, age, gender, palette) and pack mission structure from Creatures of Sonaria community documentation. Checked September 2026.",
  },
] as const;

export const DEFAULT_GAME_SLUG = GAMES[0].slug;

export function getGame(slug: string): Game | undefined {
  return GAMES.find((g) => g.slug === slug);
}

export function hasModule(game: Game, id: ModuleId): boolean {
  return game.modules.includes(id);
}

export const MODULE_LABELS: Record<ModuleId, string> = {
  trades: "Trades",
  inventory: "Inventory",
  activities: "Activities",
  help: "Help",
  services: "Services",
};

const KIND_SUMMARY: Record<WantKind, string> = {
  trade: "Trades",
  group: "Groups",
  help: "Help",
  check: "Value checks",
};

/** A short line naming what this game is used for here, derived from its wants. */
export function wantSummary(game: Game): string {
  const seen: string[] = [];
  for (const w of game.wants) {
    const label = KIND_SUMMARY[w.kind];
    if (!seen.includes(label)) seen.push(label);
  }
  return seen.join(" · ");
}

/**
 * Every want across every game, tagged with where it came from.
 * The homepage draws on this, so the promises it makes are the same data the
 * product runs on rather than marketing copy written separately.
 */
export function allWants(): readonly (Want & { game: Game })[] {
  return GAMES.flatMap((game) => game.wants.map((w) => ({ ...w, game })));
}
