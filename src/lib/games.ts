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
      "Pet trades where Neon and Fly/Ride decide the value, and people to run a live event alongside.",
    // No services module. Both candidates were checked and both failed: aging
    // runs at the same speed alone as it does with company, and every event
    // minigame pays each player for their own performance. A thing you can do
    // by yourself is not a service, and a tab full of jobs nobody needs help
    // with is worse than no tab.
    modules: ["trades", "inventory", "activities", "help"],
    wants: [
      { label: "wtt mfr bat dragon", kind: "trade" },
      { label: "lf frost dragon", kind: "trade" },
      { label: "trading neon potions", kind: "trade" },
      { label: "event group?", kind: "group" },
      { label: "wfl this trade", kind: "check" },
      { label: "is this overpay", kind: "check" },
      { label: "how do i get a trade licence", kind: "help" },
      { label: "how do you make a mega neon", kind: "help" },
    ],
    exploreTabs: [
      { id: "trades", label: "Trade Hub", kind: "trades",
        blurb: "I have X, I want Y \u2014 pets, neons, potions, vehicles and pet wear. In-game trades only: no Robux, no off-platform, no middleman." },
      { id: "community", label: "Events & Learning", kind: "community",
        blurb: "Group up for a live seasonal event, or teach a new trader what a trust trade looks like before somebody shows them the hard way." },
    ],
    exploreHighlights: ["Trades", "Neon & Mega Neon", "Retired limiteds", "Seasonal events"],
    activityKinds: ["Event", "Crew"],
    itemCategories: ["Pet", "Egg", "Potion", "Vehicle", "Toy", "Pet Wear", "Food", "Stroller"],
    itemAttributes: [
      { key: "neon", label: "Neon", options: ["Normal", "Neon", "Mega Neon"] },
      { key: "potion", label: "Ability", options: ["No Potion", "Fly", "Ride", "Fly-Ride"] },
      { key: "obtainable", label: "Obtainable", options: ["Available", "Retired"] },
    ],
    tradeGate:
      "A Trade Licence \u2014 a short in-game test \u2014 is required before you can trade ultra-rare and legendary items. Up to 18 items per trade. Trading for Robux, gift cards or anything outside the game is banned by Adopt Me itself, not just by us.",
    hue: "#E8B23A",
    art: "/games/adopt-me.jpg",
    sourceNote:
      "adoptme.fandom.com (Trade System, Neon Pets, Mega Neons, Category:Non-Tradable, Category:Events) plus adoptmevalues.gg (Cosmic Values, 776 pets, updated daily). Services were removed after both candidates were confirmed soloable \u2014 see the September 2026 corrections file. Halloween 2026 and a 2026 Phantom Dragon are SEO rumour, not fact, and are deliberately absent.",
  },

  {
    slug: "pet-simulator-99",
    name: "Pet Simulator 99",
    shortName: "PS99",
    blurb:
      "Huges, Titanics and enchants, with RAP and exists counts published by the game itself \u2014 the only honest numbers on the site.",
    modules: ["trades", "inventory", "activities", "services", "help"],
    wants: [
      { label: "wtt huge cat", kind: "trade" },
      { label: "lf titanic", kind: "trade" },
      { label: "selling enchants for gems", kind: "trade" },
      { label: "need a raid carry", kind: "group" },
      { label: "lf clan for clan battle", kind: "group" },
      { label: "is this a good trade, wfl", kind: "check" },
      { label: "what's the rap on this", kind: "check" },
      { label: "how do enchants work", kind: "help" },
    ],
    exploreTabs: [
      { id: "trades", label: "Trading Plaza", kind: "trades",
        blurb: "I have X, I want Y \u2014 pets, huges, titanics, enchants and gems. RAP comes from the game; community values are estimates. MintPlaza holds nothing." },
      { id: "raids", label: "Raids & Runs", kind: "services",
        blurb: "Raid carries, where the chests drop for everyone who came." },
      { id: "community", label: "Clans & Battles", kind: "community",
        blurb: "Start or fill a clan for the weekly Clan Battle \u2014 every member of a winning clan gets the prize, not just the top scorer." },
    ],
    exploreHighlights: ["Trades", "Weekly Clan Battles", "RAP checks", "Huge & Titanic hunting"],
    activityKinds: ["Raid", "Boss", "Crew"],
    itemCategories: ["Pet", "Egg", "Enchant", "Charm", "Booth", "Hoverboard", "Potion", "Item"],
    itemAttributes: [
      // Golden, Rainbow and Shiny are tints painted on a pet, not rarities, and
      // Shiny stacks on top of the other two. Treating them as rarity would put
      // a Shiny Golden pet in a tier that does not exist.
      { key: "tint", label: "Tint", options: ["Normal", "Golden", "Rainbow", "Shiny", "Shiny Golden", "Shiny Rainbow"] },
      { key: "petType", label: "Pet type", options: ["Regular", "Huge", "Titanic", "Gargantuan", "Exclusive"] },
      { key: "level", label: "Level" },
    ],
    tradeGate:
      "Trading is open from the start \u2014 no level, no gamepass, no ticket. Trade in-server or at the Trading Plaza, which holds up to 50 players. Some items are flagged untradeable by the game itself.",
    hue: "#D9538F",
    art: "/games/pet-simulator-99.jpg",
    sourceNote:
      "BIG Games' own public API (ps99.biggamesapi.io) for pets, eggs, enchants, RAP and exists counts, plus db.biggames.io and pet-simulator.fandom.com. The API terms permit non-commercial use only and require attribution \u2014 written consent from BIG Games is needed before this becomes a live feed rather than a reference. Pet totals move weekly (2,720 in May 2026, roughly 3,080 by September); never hard-code one.",
  },

  {
    slug: "creatures-of-sonaria",
    name: "Creatures of Sonaria",
    shortName: "Sonaria",
    blurb:
      "Creatures, palettes and plushies traded in the Trade Realm, where the top of the market is genuinely unpriced and we say so.",
    // No services module. Surviving and growing are soloable, and there is no
    // job in this game where one player unsticks another and both walk away
    // with something. Two honest tabs beat three with one invented.
    modules: ["trades", "inventory", "activities", "help"],
    wants: [
      { label: "wtt keruku", kind: "trade" },
      { label: "lf somnia elus", kind: "trade" },
      { label: "trading palettes for shooms", kind: "trade" },
      { label: "lf pack to grow with", kind: "group" },
      { label: "teach me the trade realm", kind: "help" },
      { label: "is this a fair trade", kind: "check" },
      { label: "what's this worth in shooms", kind: "check" },
      { label: "how do i get shooms", kind: "help" },
    ],
    exploreTabs: [
      { id: "trades", label: "Trade Realm", kind: "trades",
        blurb: "I have X, I want Y \u2014 creatures, palettes, materials and plushies. One trade caps at 500,000 Shooms, and every value here is a community estimate." },
      { id: "community", label: "Growers & Guides", kind: "community",
        blurb: "Group up so nobody gets killed mid-growth, and teach new players the Trade Realm before somebody grey-slots them." },
    ],
    exploreHighlights: ["Trade Realm", "Trade-only creatures", "Palettes & Materials", "Safe growing"],
    activityKinds: ["Crew"],
    itemCategories: ["Creature", "Palette", "Material", "Plushie", "Token"],
    itemAttributes: [
      // Sonaria's five size tiers describe how big a creature is, not how good
      // or how rare, and its value lists contradict the wiki on tier in 14
      // places. So size is recorded as a fact about the creature and never
      // used as a rarity.
      { key: "obtain", label: "How to get", options: ["In-game", "Trade-only", "Event", "Retired"] },
      { key: "sizeTier", label: "Size tier", options: ["1", "2", "3", "4", "5"] },
    ],
    tradeGate:
      "Trading happens only in the Trade Realm, which is a separate place from the live world. One trade is capped at 500,000 Shooms. Shooms trade; Tikits do not.",
    hue: "#7E57C2",
    art: "/games/creatures-of-sonaria.jpg",
    sourceNote:
      "creatures-of-sonaria-official.fandom.com (Trading; 481 creatures \u2014 469 species and 12 subspecies) plus the game.guide community value list, checked 12 September 2026. Sonar Studios publish no official values. The most valuable item on the list is still TBD and is left unpriced rather than invented, and 14 rows where the list contradicts the wiki are flagged rather than silently picked.",
  },

  {
    slug: "fisch",
    name: "Fisch",
    shortName: "Fisch",
    blurb:
      "The huge fishing game \u2014 catch, mutate and trade over a thousand fish, and find the second pair of hands the Grotto puzzle actually needs.",
    modules: ["trades", "inventory", "activities", "services", "help"],
    wants: [
      { label: "trading my Nessie, taking offers", kind: "trade" },
      { label: "wtt shiny fish for enchant relics", kind: "trade" },
      { label: "w/f/l on this megalodon trade?", kind: "check" },
      { label: "what's my Aether fish worth right now?", kind: "check" },
      { label: "need a 2nd for the Glacial Grotto diamond puzzle", kind: "help" },
      { label: "pairing up for a Marlon Friend quest", kind: "help" },
      { label: "recruiting for my crew, chasing the Crew Rod", kind: "group" },
      { label: "who's popping an Aurora Totem?", kind: "group" },
      { label: "how do I even reach the Trade Plaza?", kind: "help" },
    ],
    exploreTabs: [
      { id: "trades", label: "Trade Plaza", kind: "trades",
        blurb: "I've got a fish, rod skin, boat, bobber or glider \u2014 here's what I want for it. Rods, totems and bait do not trade, and nothing here is held by MintPlaza." },
      { id: "deckhands", label: "Deckhands", kind: "services",
        blurb: "The two jobs Fisch will not let one player finish: the Glacial Grotto diamond puzzle, and the Marlon Friend pairing that doubles both players' spins." },
      { id: "fleet", label: "The Fleet", kind: "community",
        blurb: "Crews, group hunts, expeditions and teaching \u2014 everything that is better, or only works, with a full boat." },
    ],
    exploreHighlights: ["Trades", "Crew Rod", "Diamond puzzle", "Apex hunts", "Aurora Totem"],
    activityKinds: ["Puzzle", "Crew", "Hunt", "Event", "Island", "Grind"],
    itemCategories: ["Fish", "Rod Skins", "Boats", "Bobbers", "Gliders", "Relics"],
    itemAttributes: [
      // A fish carries at most ONE mutation, and any number of attributes on
      // top of it. Two different shapes, so two different fields.
      { key: "mutation", label: "Mutation" },
      { key: "attribute", label: "Attribute", options: ["Shiny", "Sparkling", "Big", "Giant", "Tiny"] },
      { key: "availability", label: "Availability", options: ["Obtainable", "Limited", "Unobtainable"] },
    ],
    tradeGate:
      "Two different gates, and they are often confused. DIRECT TRADING needs EXP Level 15 on both sides and swaps fish, bobbers, boats and rod skins. The TRADE PLAZA island needs Level 25 to travel to \u2014 take the Trade Plaza Traveler at Moosewood's south docks \u2014 and there you list for Shady Scrips at a Sales Booth or the Aquarium. Rods, totems, bait and applied enchantments never trade. The Level 15 figure is community-sourced and not yet confirmed on the official page.",
    hue: "#127D91",
    art: "/games/fisch.jpg",
    sourceNote:
      "fischipedia.org, the official wiki, date-stamped per fact \u2014 it blocks automated fetching, so everything came from search snippets carrying the page's own 'last edited' stamp. Cross-checked against fisch.fandom.com, which is known to carry outdated multipliers (Aether 12\u00d7 where the official page says 15\u00d7). Values from the game.guide TrueVal S$ list, 8 September 2026. Compiled September 2026.",
  },

  {
    slug: "gag2",
    name: "Grow a Garden 2",
    shortName: "GAG2",
    blurb:
      "Plant, grow offline, sell for Sheckles and defend against night raids. Items move by one-way Mailbox gift \u2014 there is no protected trade window in this game.",
    // No services module and no services tab. GAG2 never blocks solo play, and
    // there is no confirmed two-or-three-player job where everyone walks away
    // with something.
    modules: ["trades", "inventory", "activities", "help"],
    wants: [
      { label: "lf mushroom seed", kind: "trade" },
      { label: "trading moon bloom", kind: "trade" },
      { label: "wtt ice serpent", kind: "trade" },
      { label: "need guild members", kind: "group" },
      { label: "lf a guild to join", kind: "group" },
      { label: "how does night stealing work", kind: "help" },
      { label: "best defence plant?", kind: "help" },
      { label: "is this rainbow legit", kind: "check" },
    ],
    exploreTabs: [
      { id: "trades", label: "Garden Market", kind: "trades",
        blurb: "Crops, seeds, pets and gear. Read this first: GAG2 has no two-sided trade window. Items move by one-way Mailbox gift, by dropping them, or inside a guild \u2014 so whoever sends first is trusting the other person completely." },
      { id: "community", label: "Guilds & Growers", kind: "community",
        blurb: "Fill a guild for the weekly competition \u2014 every member on a qualifying tier gets the reward \u2014 or teach a new grower the night cycle before they lose a garden to it." },
    ],
    exploreHighlights: ["Weekly guild competition", "Night-stealing defence", "Mutation farming"],
    activityKinds: ["Crew"],
    itemCategories: ["Seed", "Crop", "Pet", "Egg", "Gear", "Prop", "Crate", "Mutation Item"],
    itemAttributes: [
      { key: "variant", label: "Pet variant", options: ["Normal", "Big", "Mega", "Rainbow"] },
      { key: "mutation", label: "Crop mutation", options: ["None", "Gold", "Rainbow", "Glow", "Aurora", "Frozen", "Electric", "Starstruck", "Bloodlit", "Ignited"] },
      { key: "harvest", label: "Harvest type", options: ["Single", "Multi"] },
    ],
    tradeGate:
      "There is no universal two-sided trade menu in Grow a Garden 2, and as of September 2026 none has been announced. Items move three ways, and none of them is protected: the Mailbox gifts one way for free (but rare and above pets cannot be mailed), guild trading is limited in scope, and dropping an item on the ground is exactly as safe as it sounds. Whoever goes first is trusting the other player with no way back.",
    hue: "#4CAF50",
    art: "",
    sourceNote:
      "growagarden2.fandom.com and gag2.miraheze.org ONLY \u2014 never growagarden.fandom.com, which is the original and a different game. Values from gag2.gg/values, 11 September 2026. This is the most volatile game on the roster: it launched in June 2026, peaked at 483,561 concurrent on 13 August and fell 43.6% week-on-week from there, though it is still actively patched. Re-check the seed and pet tables every patch. Pet variant multipliers follow Fandom (Big \u00d72, Mega \u00d73, Rainbow \u00d71.25) over Miraheze's dissenting figures.",
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
