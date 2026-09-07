/**
 * Raids & Services — help that takes one or two people, not a team.
 *
 * This tab is deliberately narrow. It is for the things a player cannot
 * comfortably do alone but does not need a squad for: a raid carry, a trial
 * that needs exactly three, a puzzle step that needs somebody to hit you, a
 * boss that is miserable solo. Anything that needs a crew — a Leviathan wanting
 * five in one Sea Exploration Group, a Dough King run — belongs in Help &
 * Recruitment instead, and is not listed here.
 *
 * The board has two sides, and they are the same shape:
 *
 *   OFFER    "I can do these for you" — one player, many services.
 *   REQUEST  "I need help with this" — one player, one thing they are stuck on.
 *
 * Either side can vote on the other. A player stuck on Yama votes on a helper's
 * offer; a helper votes on a request they could take. A vote is interest, not a
 * commitment, and the faces of everyone who voted are the fastest way to see
 * whether a listing is worth answering.
 *
 * Listings are short-lived on purpose. Two hours, or until the deal is taken.
 * A board of week-old "still need help?" posts is worse than an empty one.
 *
 * ---------------------------------------------------------------------------
 * Everything below is read off the Blox Fruits wiki, and where a requirement is
 * stated it is the game's, not ours. A wrong requirement here costs somebody an
 * evening, so anything that could not be confirmed is left out rather than
 * guessed at. Two things that were checked and deliberately excluded:
 *
 *   - Saber V3 does not exist. It is a fan concept; Saber stops at V2.
 *   - "Observation Haki V2" is now called Instinct V2 in game. Both names are
 *     kept so search finds it either way.
 * ---------------------------------------------------------------------------
 */

/**
 * One pickable reference picture.
 *
 * `art` is optional and empty for now, exactly like the item catalogue: until
 * real artwork exists a reference renders as a typographic tile, which reads
 * cleanly and never pretends to be a picture it is not. Dropping files into
 * /public/refs and filling the field in is the only change needed, and the
 * control panel can do it without a deploy.
 */
export interface ServiceRef {
  id: string;
  label: string;
  art?: string;
  /** Colour for the fallback tile, so the six races stay distinguishable. */
  hue?: string;
}

/**
 * The races, as the game names them today.
 *
 * Worth stating plainly because two of them are commonly called something else:
 * the Sky race is Angel, and the Mink race is Rabbit. Draco arrives with V4.
 */
export const RACES: readonly ServiceRef[] = [
  { id: "race-human",  label: "Human",  hue: "#8A5A12" },
  { id: "race-shark",  label: "Shark",  hue: "#2C6C9E" },
  { id: "race-angel",  label: "Angel",  hue: "#6B4CA8" },
  { id: "race-rabbit", label: "Rabbit", hue: "#2F7D57" },
  { id: "race-ghoul",  label: "Ghoul",  hue: "#A93226" },
  { id: "race-cyborg", label: "Cyborg", hue: "#465650" },
];

/** What kind of help this is. Named the way the game names things. */
export type ServiceKind =
  | "Raid" | "Trial" | "Puzzle" | "Boss" | "Unlock" | "Grind" | "Island"
  | "Crew" | "Event" | "Hunt";

/**
 * Which board a template belongs to.
 *
 *   "services" — one or two people. You are stuck, somebody unsticks you.
 *   "recruit"  — three or more. Nobody is stuck; the thing simply cannot be
 *                started until enough people are standing in the same place.
 *
 * The split is not cosmetic. A service is a favour and is over in minutes; a
 * recruitment is a crew that has to assemble, which is why its board runs on a
 * much shorter clock and shows who is in as they join.
 */
export type Section = "services" | "recruit";

export interface Service {
  id: string;
  gameSlug: string;
  name: string;
  kind: ServiceKind;
  /**
   * The thing itself, photographed in game.
   *
   * On the recruitment board this carries most of the recognition: a player
   * knows the Leviathan's silhouette long before they read the word, and a
   * board of crew calls with pictures is scannable in a way a board of
   * paragraphs never is. Absent where I do not have a real screenshot — an
   * approximate picture of the wrong boss is worse than none, so the tile
   * falls back to type rather than borrowing something that nearly fits.
   */
  art?: string;
  /** Defaults to "services" so every existing template keeps its board. */
  section?: Section;
  /** The game's own requirement. Only stated where it was confirmed. */
  needs?: string;
  /**
   * Total players including the one being helped. On the services board this
   * is capped at 3 by the scope of the tab; on the recruitment board it is the
   * size of crew the game actually requires, and the reason the post exists.
   */
  players?: number;
  /** What the person being helped walks away with. */
  gives?: string;
  /**
   * True where the entry is a category rather than one fixed thing, and the
   * poster fills in the specifics. Keeps one row from having to exist for every
   * boss in the game.
   */
  openEnded?: boolean;
  /**
   * Pictures the poster can pick one of, shown on the listing as a reference.
   *
   * A V3 listing means something different depending on the race — the Angel
   * quest needs another Angel, the Ghoul one needs somebody willing to be
   * killed five times — and a picture says which faster than a sentence does.
   * It is a reference only: it never changes what the listing means, and the
   * description is still where the poster says what they actually need.
   */
  refs?: readonly ServiceRef[];
  /** Other names people search for. */
  aliases?: readonly string[];
  verified?: boolean;
}

/**
 * Blox Fruits.
 *
 * Sourced from the wiki: the raid microchips and their level gate, the V4
 * trial's three races, the Cursed Dual Katana step that needs another player to
 * deal you damage, Yama's thirty Elite Hunter quests, Saber V2's player kill,
 * the Citizen Quest, and the island spawn conditions.
 */
/**
 * Blox Fruits — recruitment.
 *
 * Everything here needs three or more people, and none of it is a favour. The
 * distinction that decides which board a thing belongs on is not difficulty,
 * it is this: on the services board somebody is stuck and one helper unsticks
 * them; here nobody is stuck, the content simply will not start until enough
 * people are in the same server, on the same boat, at the same time.
 *
 * Crew sizes are the game's, where the game states one. Where it does not, the
 * number is what the content actually takes rather than a guess dressed up as
 * a requirement — Leviathan says five on one boat, so it says five; Dough King
 * says only "do not try this alone", so it says four and explains why.
 *
 * Sourced from the wiki's Sea Events and Raid Bosses pages and the boss guides
 * that agree with them. Where sources disagree — the moon Kitsune Island wants
 * is written up as both Full and Blue — the card leads with the part nobody
 * disputes and leaves the disputed detail out of the requirement.
 */
const BLOX_FRUITS_RECRUIT: Service[] = [
  // ---- Sea and island hunts: a boat, and enough people on it ----
  {
    id: "bf-r-leviathan", gameSlug: "blox-fruits", section: "recruit",
    art: "/art/services/leviathan.jpg",
    name: "Leviathan hunt", kind: "Hunt",
    needs: "Five players on the same boat — the game will not start the hunt with fewer. Everyone needs 10% of the damage on a segment to get anything from it",
    players: 5,
    gives: "Leviathan Heart, the Sanguine Art unlock, and Leviathan Scales",
    aliases: ["leviathan", "levi", "sea beast", "sanguine"], verified: true,
  },
  {
    id: "bf-r-kitsune-island", gameSlug: "blox-fruits", section: "recruit",
    art: "/art/services/kitsune-island.jpg",
    name: "Kitsune Island spawn crew", kind: "Island",
    needs: "A boat sitting at Sea Danger Level 6 and people willing to wait. It only surfaces on the right moon, so this is a shift, not a trip",
    players: 5,
    gives: "Kitsune, and the Kitsune Mask",
    aliases: ["kitsune", "kitsune island", "moon"], verified: true,
  },
  {
    id: "bf-r-prehistoric", gameSlug: "blox-fruits", section: "recruit",
    art: "/art/services/prehistoric-island.jpg",
    name: "Prehistoric Island hunt", kind: "Island",
    needs: "It can surface without one, but somebody bringing a Volcanic Magnet makes the whole hunt worth doing",
    players: 4,
    aliases: ["prehistoric", "dino", "volcanic magnet"], verified: true,
  },
  {
    id: "bf-r-mirage", gameSlug: "blox-fruits", section: "recruit",
    name: "Mirage Island hunt", kind: "Island",
    needs: "Night only. More people sailing means more servers checked, which is the whole trick to finding it",
    players: 4,
    gives: "The Mirror Fractal, and the Blue Gear",
    aliases: ["mirage", "mirage island", "blue gear"], verified: true,
  },
  {
    id: "bf-r-sea-events", gameSlug: "blox-fruits", section: "recruit",
    art: "/art/services/sea-beast.jpg",
    name: "Sea event team", kind: "Event",
    needs: "Sail and take whatever surfaces — Ship Raids, Ghost Ships, Sea Beasts, Terrorsharks. Say in your post which sea and which Danger Level you are running",
    players: 4,
    gives: "Fragments and materials. A Ship Raid pays up to 100 Fragments",
    openEnded: true,
    aliases: ["sea event", "ship raid", "ghost ship", "danger level"], verified: true,
  },
  {
    id: "bf-r-terrorshark", gameSlug: "blox-fruits", section: "recruit",
    art: "/art/services/terrorshark.jpg",
    name: "Terrorshark run", kind: "Hunt",
    needs: "Third Sea. Bring your own Monster Magnet if you want the Shark Anchor — only the player whose magnet was eaten gets the drop",
    players: 3,
    gives: "1,000 Valor a kill in the Third Sea",
    aliases: ["terrorshark", "shark anchor", "valor"], verified: true,
  },
  {
    id: "bf-r-ghost-ship", gameSlug: "blox-fruits", section: "recruit",
    name: "Haunted Shipwreck crew", kind: "Event",
    needs: "Ghost Ship Raids, Ghost Sharks and Haunted Crew Members. They hit hard and they sink your boat, so bring people who can take a hit",
    players: 4,
    aliases: ["ghost ship", "haunted", "shipwreck"], verified: true,
  },

  // ---- Raid bosses that will not go down to one person ----
  {
    id: "bf-r-dough-king", gameSlug: "blox-fruits", section: "recruit",
    art: "/art/services/dough-king.jpg",
    name: "Dough King raid", kind: "Raid",
    needs: "The Advanced Dough raid, all five islands, then the King on a timer. This is the raid people burn a whole evening failing alone",
    players: 4,
    gives: "Dough Awakening and Dough Remnant",
    aliases: ["dough king", "dough", "advanced raid"], verified: true,
  },
  {
    id: "bf-r-cake-prince", gameSlug: "blox-fruits", section: "recruit",
    art: "/art/services/cake-prince.jpg",
    name: "Cake Prince raid", kind: "Raid",
    needs: "At least three people — he has the health and the move spam to outlast anything smaller",
    players: 3,
    gives: "The Dough Fruit chance, and Cake Prince drops",
    aliases: ["cake prince", "cake", "dough fruit"], verified: true,
  },
  {
    id: "bf-r-rip-indra", gameSlug: "blox-fruits", section: "recruit",
    name: "Rip Indra (True Form) raid", kind: "Raid",
    needs: "Castle on the Sea, Third Sea. Not to be attempted alone unless you are max level with everything maxed, which is why this is here and not on the services board",
    players: 4,
    gives: "A step on Race Awakening, and Indra's drops",
    aliases: ["rip indra", "indra", "castle on the sea"], verified: true,
  },
  {
    id: "bf-r-darkbeard", gameSlug: "blox-fruits", section: "recruit",
    name: "Darkbeard raid", kind: "Raid",
    needs: "Somebody brings a Fist of Darkness and uses it at the Dark Arena altar. He despawns fifteen minutes after spawning, so the crew has to be standing there before it is used",
    players: 4,
    gives: "A Dark Fragment, Fragments and Beli",
    aliases: ["darkbeard", "fist of darkness", "dark arena"], verified: true,
  },
  {
    id: "bf-r-cursed-captain", gameSlug: "blox-fruits", section: "recruit",
    name: "Cursed Captain raid", kind: "Raid",
    needs: "Second floor of the Cursed Ship. Spawns roughly every hour, and everybody needs 10% of the damage to see a drop",
    players: 3,
    aliases: ["cursed captain", "cursed ship"], verified: true,
  },
  {
    id: "bf-r-longma", gameSlug: "blox-fruits", section: "recruit",
    name: "Boss hunt — say which", kind: "Raid",
    needs: "For any boss not listed here. Name it in your post, with the sea and the level you expect people to be",
    players: 3,
    openEnded: true,
    aliases: ["boss", "raid boss", "hunt"], verified: true,
  },

  // ---- Farming crews ----
  {
    id: "bf-r-fragments", gameSlug: "blox-fruits", section: "recruit",
    name: "Fragment farm — raid team", kind: "Raid",
    needs: "Chip holders and a team that will keep going back in. About 14,500 Fragments awakens most fruits, which is nobody's single sitting",
    players: 4,
    gives: "Fragments, and awakenings at the end of them",
    aliases: ["fragments", "frags", "raid farm", "awakening"], verified: true,
  },
  {
    id: "bf-r-bounty", gameSlug: "blox-fruits", section: "recruit",
    name: "Bounty / Honour hunt squad", kind: "Hunt",
    needs: "Say whether you are hunting Pirates or Marines, and roughly what level. A squad that does not agree on the side it is on spends the night fighting itself",
    players: 3,
    aliases: ["bounty", "honour", "honor", "pvp", "marines", "pirates"], verified: true,
  },
  {
    id: "bf-r-elite", gameSlug: "blox-fruits", section: "recruit",
    name: "Elite Hunter grind squad", kind: "Grind",
    needs: "Third Sea. Thirty quests guarantees Yama, and it goes a great deal faster with people",
    players: 3,
    gives: "Yama, and the Pretty Helmet at five Elite Pirates",
    aliases: ["elite", "elite pirates", "yama", "elite hunter"], verified: true,
  },
  {
    id: "bf-r-level-grind", gameSlug: "blox-fruits", section: "recruit",
    name: "Level grinding party", kind: "Grind",
    needs: "Say which sea and roughly what level, so people turn up somewhere useful to them too",
    players: 3,
    aliases: ["level", "grind", "xp", "party"], verified: true,
  },

  // ---- The game's own crew system ----
  {
    id: "bf-r-crew", gameSlug: "blox-fruits", section: "recruit",
    name: "Crew recruiting members", kind: "Crew",
    needs: "An actual in-game Crew, not a one-off team. Say the crew name, what it is for, and whether there is a level you expect",
    players: 5,
    openEnded: true,
    aliases: ["crew", "guild", "clan", "captain"], verified: true,
  },
  {
    id: "bf-r-looking-for-crew", gameSlug: "blox-fruits", section: "recruit",
    name: "Looking for a crew", kind: "Crew",
    needs: "The other way round — you want in. Say your level, your fruit and when you actually play",
    players: 3,
    openEnded: true,
    aliases: ["lfc", "looking for crew", "join crew"], verified: true,
  },
];

const BLOX_FRUITS_SERVICES: Service[] = [
  // ---- Raids and awakening ----
  {
    id: "bf-s-basic-raid", gameSlug: "blox-fruits", name: "Fruit awakening raid carry",
    kind: "Raid",
    needs: "Level 1100+. Somebody needs a Basic Raid Microchip — 100,000 Beli, or any physical fruit, from the Mysterious Scientist",
    players: 2,
    gives: "Awakened moves and Fragments. Five islands, each harder than the last",
    aliases: ["awakening", "awaken", "raid carry", "fragments"], verified: true,
  },
  {
    id: "bf-s-advanced-raid", gameSlug: "blox-fruits", name: "Advanced raid — Phoenix or Dough",
    kind: "Raid",
    needs: "An Advanced Raid Microchip: 1,000 Robux, or a physical fruit worth over 1,000,000",
    players: 2,
    gives: "The only two Advanced Raids in the game",
    aliases: ["phoenix raid", "dough raid", "advanced"], verified: true,
  },
  {
    id: "bf-s-fragments", gameSlug: "blox-fruits", name: "Fragment farming",
    kind: "Grind",
    needs: "About 14,500 Fragments awakens most fruits",
    players: 2,
    aliases: ["frags"], verified: true,
  },

  // ---- Race awakening ----
  {
    id: "bf-s-v4", gameSlug: "blox-fruits", name: "Race V4 trial",
    kind: "Trial",
    needs: "Exactly 3 players of 3 different races, all activating V3 at the same moment",
    players: 3,
    gives: "Race V4",
    // The picture says which race you are; the description says what you are
    // actually missing, which is never the same twice.
    // Which race you are decides who you still need, so the picker is the
    // fastest way to say it.
    refs: RACES,
    aliases: ["v4", "race v4", "race awakening"], verified: true,
  },
  {
    id: "bf-s-v3", gameSlug: "blox-fruits", name: "Race V3 trial",
    kind: "Trial",
    // Every race gets a different task from Arowe, and two of them cannot be
    // done alone at all.
    needs: "Second Sea, and Arowe gives you a different task depending on your race. Angel: kill another Angel player. Ghoul: kill 5 players — the same person five times counts. Human: kill Diamond, Jeremy and Orbitus. Shark: kill a naturally spawned Sea Beast, summoned ones do not count. Rabbit: 30 chests. Cyborg: show Arowe any physical fruit. V3 costs 2,000,000",
    players: 2,
    gives: "Race V3",
    refs: RACES,
    aliases: ["v3", "arowe", "race v3", "angel v3", "ghoul v3"], verified: true,
  },
  {
    id: "bf-s-temple", gameSlug: "blox-fruits", name: "Temple of Time access",
    kind: "Unlock",
    needs: "The Blue Gear, then the Mysterious Force at the top of the Great Tree",
    players: 2,
    gives: "The Race Awakening trials",
    aliases: ["temple", "blue gear"], verified: true,
  },

  // ---- Puzzles and weapon unlocks ----
  {
    id: "bf-s-cdk", gameSlug: "blox-fruits", name: "Cursed Dual Katana puzzle",
    kind: "Puzzle",
    needs: "Level 2200+ and 350 mastery on both Yama and Tushita. One trial needs you to take 8,000–10,000 damage from another player while holding Yama — that is the part you need a helper for",
    players: 2,
    gives: "Cursed Dual Katana",
    // The puzzle is a chain, and people get stuck at different links — one
    // needs Yama, another Tushita, another the trial itself.
    refs: [
      { id: "cdk-yama",    label: "Yama",    hue: "#8A5A12" },
      { id: "cdk-tushita", label: "Tushita", hue: "#2C6C9E" },
      { id: "cdk-trial",   label: "The CDK trial", hue: "#6B4CA8" },
      { id: "cdk-cdk",     label: "Cursed Dual Katana", hue: "#A93226" },
    ],
    aliases: ["cdk", "cursed dual katana", "alucard"], verified: true,
  },
  {
    id: "bf-s-yama", gameSlug: "blox-fruits", name: "Yama — Elite Hunter grind",
    kind: "Grind",
    needs: "Third Sea. 20 Elite Hunter quests for a chance at Yama, 30 to be guaranteed it",
    players: 2,
    gives: "Yama, and the Pretty Helmet at 5 Elite Pirates",
    aliases: ["yama", "elite", "elite pirates", "elite hunter"], verified: true,
  },
  {
    id: "bf-s-saber-v2", gameSlug: "blox-fruits", name: "Saber V2",
    kind: "Unlock",
    needs: "One million bounty or honour, and a kill on another player of similar level",
    players: 2,
    gives: "Saber V2",
    aliases: ["saber"], verified: true,
  },
  {
    // Naming one soloable boss was a mistake: Captain Elephant does not need a
    // second player, so a listing for it was noise. One open entry covers every
    // ordinary boss instead and the poster says which in their own words — this
    // list should not grow a row each time somebody finds a boss hard.
    id: "bf-s-boss-help", gameSlug: "blox-fruits", name: "Help beating a boss",
    kind: "Boss",
    needs: "Say which boss in your post — whichever one you are stuck on",
    players: 2,
    openEnded: true,
    aliases: ["boss", "carry", "boss carry", "captain elephant", "greybeard"],
    verified: true,
  },
  {
    id: "bf-s-hallow-scythe", gameSlug: "blox-fruits", name: "Hallow Scythe farming",
    kind: "Boss",
    needs: "A 5% drop from the Soul Reaper, so expect to go again",
    players: 2,
    gives: "Hallow Scythe",
    aliases: ["hallow scythe", "soul reaper", "scythe"], verified: true,
  },
  {
    id: "bf-s-shark-anchor", gameSlug: "blox-fruits", name: "Shark Anchor — Anchored Terrorshark",
    kind: "Boss",
    needs: "Only the player whose Monster Magnet was consumed can take the drop, so bring your own",
    players: 2,
    gives: "Shark Anchor",
    aliases: ["shark anchor", "terrorshark", "monster magnet"], verified: true,
  },


  // ---- Second Sea ----
  {
    id: "bf-s-darkbeard", gameSlug: "blox-fruits", name: "Darkbeard",
    kind: "Boss",
    needs: "A Fist of Darkness, used at the altar in the middle of the Dark Arena. He despawns 15 minutes after spawning, so people need to already be there",
    players: 3,
    gives: "A Dark Fragment, Fragments and Beli",
    aliases: ["darkbeard", "fist of darkness", "dark arena"], verified: true,
  },
  {
    id: "bf-s-fist-of-darkness", gameSlug: "blox-fruits", name: "Fist of Darkness hunting",
    kind: "Grind",
    needs: "A random chest every four hours, or a Sea Beast. Second Sea's answer to the God's Chalice",
    players: 2,
    aliases: ["fist of darkness", "fod"], verified: true,
  },
  {
    id: "bf-s-slayer-skin", gameSlug: "blox-fruits", name: "Slayer Skin (Dark Blade V3)",
    kind: "Puzzle",
    // The two-fist rule is the whole reason this is on a services board.
    needs: "Human, Rabbit, Shark and Angel all at V3 — the four races you can reroll into. Cyborg, Ghoul and Draco do not count. It also needs two Fists of Darkness, and one player cannot hold both, so somebody else has to carry the second",
    players: 3,
    gives: "The Slayer Skin for Dark Blade",
    refs: [
      { id: "slayer-human",  label: "Human V3",  hue: "#8A5A12" },
      { id: "slayer-rabbit", label: "Rabbit V3", hue: "#2F7D57" },
      { id: "slayer-shark",  label: "Shark V3",  hue: "#2C6C9E" },
      { id: "slayer-angel",  label: "Angel V3",  hue: "#6B4CA8" },
    ],
    aliases: ["slayer", "dark blade v3", "db v3", "slayer skin"], verified: true,
  },
  {
    id: "bf-s-cursed-captain", gameSlug: "blox-fruits", name: "Cursed Captain",
    kind: "Boss",
    needs: "Second floor of the Cursed Ship, Second Sea. Spawns roughly every 60 to 72 minutes. You need 10% of the damage to get a drop, and going alone under Level 1300 is not advised",
    players: 3,
    aliases: ["cursed captain", "cursed ship"], verified: true,
  },

  // ---- Third Sea ----
  {
    id: "bf-s-skull-guitar", gameSlug: "blox-fruits", name: "Skull Guitar (Soul Guitar)",
    kind: "Puzzle",
    needs: "Level 2300+. Pray at the Gravestone at night during a Full Moon, then craft it with 500 Bones, 1 Dark Fragment, 250 Ectoplasm and 5,000 Fragments",
    players: 2,
    gives: "Skull Guitar",
    aliases: ["soul guitar", "skull guitar", "guitar", "gravestone"], verified: true,
  },
  {
    id: "bf-s-materials", gameSlug: "blox-fruits", name: "Material farming",
    kind: "Grind",
    needs: "Say which in your post — Bones, Ectoplasm, Mystic Droplets, Dark Fragments and the rest all come from different places",
    players: 2,
    openEnded: true,
    aliases: ["bones", "ectoplasm", "materials", "mystic droplet", "dark fragment"],
    verified: true,
  },

  // ---- Haki and styles ----
  {
    id: "bf-s-citizen-quest", gameSlug: "blox-fruits", name: "Citizen Quest",
    kind: "Unlock",
    needs: "The Citizen in the Second Sea wants you to find him a Musketeer Hat. Say in your post which part you are stuck on",
    players: 2,
    gives: "The Musketeer Hat — the gate on Instinct V2",
    aliases: ["citizen", "citizen quest", "musketeer hat", "instinct", "observation"], verified: true,
  },
  {
    id: "bf-s-godhuman", gameSlug: "blox-fruits", name: "Godhuman mastery grind",
    kind: "Grind",
    needs: "400+ mastery on Death Step, Sharkman Karate and Electric Claw — each of which needs 400+ on its own base style first",
    players: 2,
    gives: "Godhuman",
    aliases: ["godhuman", "mastery"], verified: true,
  },
  {
    id: "bf-s-sanguine", gameSlug: "blox-fruits", name: "Sanguine Art unlock",
    kind: "Unlock",
    needs: "A Leviathan Heart handed to Shafi, then 5,000,000 Beli and 5,000 Fragments. The Leviathan itself needs a crew — that part belongs in Recruitment",
    players: 2,
    gives: "Sanguine Art",
    aliases: ["sanguine", "shafi"], verified: true,
  },

  // ---- Islands ----
  {
    id: "bf-s-mirage", gameSlug: "blox-fruits", name: "Mirage Island — Mirror Fractal",
    kind: "Island",
    needs: "Night-time only, since the Valentine's update — a full moon is no longer needed. Resonate the Mirror Fractal at the island's highest point",
    players: 2,
    gives: "The Blue Gear",
    aliases: ["mirage", "mirror fractal", "blue gear"], verified: true,
  },

  // ---- Boss carries ----
  {
    id: "bf-s-rip-indra", gameSlug: "blox-fruits", name: "Rip Indra (True Form)",
    kind: "Boss",
    needs: "Castle on the Sea, Third Sea. A step on the Race Awakening puzzle, which is why it is listed separately from the open boss entry",
    players: 3,
    aliases: ["indra", "rip indra"], verified: true,
  },
  {
    id: "bf-s-level", gameSlug: "blox-fruits", name: "Level grinding help",
    kind: "Grind",
    players: 2,
    aliases: ["level", "grind", "xp"], verified: true,
  },
  {
    id: "bf-s-bounty", gameSlug: "blox-fruits", name: "Bounty hunting partner",
    kind: "Grind",
    players: 2,
    aliases: ["bounty", "pvp"], verified: true,
  },
];

/**
 * The other five games. Short, and flagged as such — these grow through the
 * control panel rather than through code.
 */
const OTHER_SERVICES: Service[] = [
  { id: "gg-s-mutation", gameSlug: "grow-a-garden", name: "Mutation run help", kind: "Grind", players: 2 },
  { id: "gg-s-restock", gameSlug: "grow-a-garden", name: "Restock watch", kind: "Grind", players: 2 },
  { id: "gg-s-event-set", gameSlug: "grow-a-garden", name: "Finishing an event set", kind: "Unlock", players: 2 },

  { id: "am-s-task", gameSlug: "adopt-me", name: "Task help", kind: "Grind", players: 2 },
  { id: "am-s-neon", gameSlug: "adopt-me", name: "Neon making", kind: "Unlock",
    needs: "Four full-grown pets of the same kind", players: 2 },

  { id: "ps-s-hatch", gameSlug: "pet-simulator-99", name: "Hatching help", kind: "Grind", players: 2 },
  { id: "ps-s-carry", gameSlug: "pet-simulator-99", name: "Zone carry", kind: "Grind", players: 2 },

  { id: "rh-s-story", gameSlug: "royale-high", name: "Story help", kind: "Unlock", players: 2 },
  { id: "rh-s-diamond", gameSlug: "royale-high", name: "Diamond run", kind: "Grind", players: 2 },

  { id: "cs-s-growth", gameSlug: "creatures-of-sonaria", name: "Growth help", kind: "Grind", players: 2 },
  { id: "cs-s-hunt", gameSlug: "creatures-of-sonaria", name: "Group hunt", kind: "Grind", players: 3 },
];

export const SERVICES: readonly Service[] = [
  ...BLOX_FRUITS_SERVICES, ...BLOX_FRUITS_RECRUIT, ...OTHER_SERVICES,
];

export function servicesFor(
  gameSlug: string,
  section: Section = "services",
): readonly Service[] {
  return SERVICES.filter(
    (s) => s.gameSlug === gameSlug && (s.section ?? "services") === section,
  );
}

export function findService(id: string): Service | undefined {
  return SERVICES.find((s) => s.id === id);
}

/** The reference a listing picked, looked up across the services it names. */
export function findRef(
  serviceIds: readonly string[], refId?: string,
): ServiceRef | undefined {
  if (!refId) return undefined;
  for (const id of serviceIds) {
    const hit = findService(id)?.refs?.find((r) => r.id === refId);
    if (hit) return hit;
  }
  return undefined;
}

/** Games whose service list is knowingly short. Surfaced in the interface. */
export const PARTIAL_SERVICES: readonly string[] = [
  "adopt-me", "pet-simulator-99", "grow-a-garden", "royale-high", "creatures-of-sonaria",
];

/**
 * What a helper may ask in return.
 *
 * A closed list, and that is a safety decision rather than a modelling one. A
 * free-text box becomes a market for real money and for account access within a
 * week — both forbidden outright — and the cheapest way to enforce a rule is to
 * leave nowhere to type it.
 */
export type Terms =
  | { kind: "free" }
  | { kind: "split" }
  | { kind: "item"; itemId: string };

/**
 * Somebody who voted on a listing.
 *
 * A vote is not a like. It means "I want to be in on this", so a voter is a
 * candidate for the deal — which is why every voter carries a reply state.
 */
export interface Voter {
  /**
   * The profile id. Present on rows from the database; absent on generated
   * examples. Reporting needs it — usernames change, ids do not.
   */
  userId?: string;
  username: string;
  /** The Roblox avatar, once a real account is signed in. */
  avatarUrl?: string;
  online: boolean;
  /** Minutes since they voted, so the picker can show who is freshest. */
  votedMinutesAgo: number;
  /**
   * Where they stand once the poster has picked their team.
   *
   *   not-picked  voted, but the poster did not choose them
   *   waiting     picked, and the request is with them
   *   agreed      they said yes
   *   denied      they said no
   */
  reply: "not-picked" | "waiting" | "agreed" | "denied";
}

/**
 * A message under a listing.
 *
 * Deliberately spare: reply and report, nothing else. No likes, because a like
 * on "I'm ready, add me" means nothing and a popularity contest is not what
 * this thread is for. Only people who have voted can write here — it is a room
 * for the people actually doing the thing, not a comment section.
 */
export interface ListingComment {
  id: string;
  author: string;
  avatarUrl?: string;
  online: boolean;
  text: string;
  minutesAgo: number;
  /** The comment this answers, for a one-level thread. */
  replyTo?: string;
}

/**
 * How far along the deal is.
 *
 *   voting     open, collecting people who want in
 *   requested  the poster picked a team and asked them; replies are coming back
 *   locked     the poster locked it in. The listing closes to new votes and
 *              shows who is going
 *
 * There is no state after locked. The listing simply stops existing when its
 * two hours are up, whatever happened.
 */
export type DealStage = "voting" | "requested" | "locked";

/**
 * The most people one deal can involve.
 *
 * The board is for help that takes one or two others, so a team of eighteen is
 * far past what any listing here needs — it is a ceiling to stop a runaway
 * selection, not a target.
 */
export const MAX_TEAM = 18;

export type ListingSide = "offer" | "request";

export interface ServiceListing {
  /**
   * True only for generated example content, which the interface badges. A row
   * that came from the database leaves this off — mislabelling a real listing
   * as an example would be as bad as the reverse.
   */
  isDemo?: boolean;
  id: string;
  gameSlug: string;
  side: ListingSide;
  author: string;
  authorAvatarUrl?: string;
  authorOnline: boolean;
  /** Completed helps on MintPlaza. Zero for a new account. */
  completed: number;
  /**
   * An offer can carry many services — a helper lists everything they can run.
   * A request carries the one thing they are stuck on.
   */
  serviceIds: readonly string[];
  terms: Terms;
  note?: string;
  /** Minutes since posting. Drives the two-hour window. */
  postedMinutesAgo: number;
  /** Set once somebody's offer is taken, which closes the listing early. */
  taken: boolean;
  /**
   * A handful of voters, for the faces. Never the whole list: a popular listing
   * can have hundreds, and sending hundreds of records to draw three circles
   * would be absurd. The stack shows these and counts the rest.
   */
  voters: readonly Voter[];
  /** Everyone who voted, including the ones not sent. */
  voteCount: number;
  /** How many of them are on MintPlaza right now. */
  votersOnline: number;
  /** What the poster wrote about what they need. */
  detail?: string;
  /** Which reference picture they picked, where the service offers a choice. */
  refId?: string;
  stage: DealStage;
  comments: readonly ListingComment[];
  /** Whether the person reading this has voted. Gates the thread. */
  youVoted: boolean;
  /** Whether the person reading this posted it. */
  yours: boolean;
}

/** Everyone the poster picked, whatever they have replied. */
export function pickedVoters(l: ServiceListing): readonly Voter[] {
  return l.voters.filter((v) => v.reply !== "not-picked");
}

/** Everyone who said yes. One is enough to lock a deal in. */
export function agreedVoters(l: ServiceListing): readonly Voter[] {
  return l.voters.filter((v) => v.reply === "agreed");
}

/**
 * Can the poster lock this in?
 *
 * One yes is enough. Waiting for everyone would leave a deal hostage to the one
 * person who wandered off, and the people who did say yes are sitting there
 * ready to go.
 */
export function canLockIn(l: ServiceListing): boolean {
  return l.stage === "requested" && agreedVoters(l).length > 0;
}

/**
 * A listing lives two hours. Not two hours of visibility and then an archive —
 * two hours, then it is gone from the database entirely, locked deals included.
 * Nobody benefits from a record of who helped whom last Tuesday, and not
 * keeping it is the simplest way to never leak it.
 */
export const LIVE_WINDOW_MINUTES = 120;

/**
 * A recruitment post lives forty minutes, not two hours.
 *
 * The difference is what the two boards are for. A service post is somebody
 * saying "I need this done sometime today"; it can sit for two hours and still
 * be true. A recruitment post is somebody saying "I am sailing now, who is
 * coming" — and a crew call that is ninety minutes old is a lie that wastes
 * the time of everybody who answers it. Forty minutes is long enough to gather
 * five people and short enough that anything still on the board is real.
 */
export const RECRUIT_WINDOW_MINUTES = 40;

/** How long this particular listing gets, decided by the board it is on. */
export function windowFor(l: ServiceListing): number {
  return findService(l.serviceIds[0])?.section === "recruit"
    ? RECRUIT_WINDOW_MINUTES
    : LIVE_WINDOW_MINUTES;
}

export function minutesLeft(l: ServiceListing): number {
  return Math.max(0, windowFor(l) - l.postedMinutesAgo);
}

export function listingState(l: ServiceListing): "live" | "taken" | "expired" {
  if (l.taken) return "taken";
  return minutesLeft(l) > 0 ? "live" : "expired";
}

/**
 * "1h 12m", the way a countdown should read at a glance.
 *
 * Deliberately without the word "left": on a 390px row that word costs about
 * thirty pixels, and thirty pixels is the difference between reading
 * "Fruit awakening raid carry" and reading "Fruit awakening raid …".
 */
export function timeLeftCopy(l: ServiceListing): string {
  const m = minutesLeft(l);
  if (m <= 0) return "Expired";
  if (m < 60) return `${m}m`;
  const h = Math.floor(m / 60);
  return `${h}h ${m % 60}m`;
}

/**
 * When this listing expires, as a timestamp the browser can count down from.
 * Derived from the posting age so the server and the client agree.
 */
export function expiresAt(l: ServiceListing, now = Date.now()): number {
  return now + minutesLeft(l) * 60_000;
}
