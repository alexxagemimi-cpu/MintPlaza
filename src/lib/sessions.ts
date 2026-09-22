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
  /** A heading the board groups this under, where a game has natural clusters. */
  group?: string;
  /**
   * True where finishing this pays EVERY person who took part.
   *
   * This is the most important field on a template and it is a safety rule, not
   * a label. Half the "group content" in these games is a race: a Megalodon
   * hunt ends the instant somebody lands the fish, a leaderboard pays rank one.
   * Recruiting strangers into a race means using MintPlaza to gather rivals who
   * will each lose to the person who posted — so anything that cannot honestly
   * claim this never reaches the board.
   *
   * Undefined means nobody has checked yet, which is treated exactly like false
   * until somebody does.
   */
  everyoneRewarded?: boolean;
  /**
   * In the catalogue, off the board.
   *
   * For a template that is real but not yet safe to offer — usually because
   * whether the helper gets anything is unconfirmed. It still resolves by id,
   * so an old listing naming it renders as what it was, and the Studio can
   * switch it on the day the answer arrives. It simply cannot be posted.
   */
  draft?: boolean;
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
/**
 * The everyone-rewarded audit.
 *
 * Every template below was checked one at a time against a single question:
 * if fifteen strangers answer this post, does each of them come away with
 * something, or do they come away having helped one person win?
 *
 * All fifteen pass, for one of two reasons. The sea and island content shares
 * its drops — Leviathan pays everyone who did enough damage to a segment,
 * a raid boss drops for the party, an island's spawn opens its shop to whoever
 * is standing on it. The grinding content does not share anything because
 * there is nothing to share: each player earns their own fragments, their own
 * levels, their own bounty kills, and the crew is company and safety rather
 * than a split.
 *
 * Bounty hunting was the one worth arguing about, because a bounty goes to
 * whoever lands the kill. It stays in because your squad is not who you are
 * competing with — the other server is. If that ever stops being true, the flag
 * comes off and the template leaves the board on its own.
 */
const BLOX_FRUITS_RECRUIT: Service[] = [
  // ---- Sea and island hunts: a boat, and enough people on it ----
  {
    id: "bf-r-leviathan", gameSlug: "blox-fruits", section: "recruit", everyoneRewarded: true,
    art: "/art/services/leviathan.jpg",
    name: "Leviathan hunt", kind: "Hunt",
    needs: "Five players on the same boat — the game will not start the hunt with fewer. Everyone needs 10% of the damage on a segment to get anything from it",
    players: 5,
    gives: "Leviathan Heart, the Sanguine Art unlock, and Leviathan Scales",
    aliases: ["leviathan", "levi", "sea beast", "sanguine"], verified: true,
  },
  {
    id: "bf-r-kitsune-island", gameSlug: "blox-fruits", section: "recruit", everyoneRewarded: true,
    art: "/art/services/kitsune-island.jpg",
    name: "Kitsune Island spawn crew", kind: "Island",
    needs: "A boat sitting at Sea Danger Level 6 and people willing to wait. It only surfaces on the right moon, so this is a shift, not a trip",
    players: 5,
    gives: "Kitsune, and the Kitsune Mask",
    aliases: ["kitsune", "kitsune island", "moon"], verified: true,
  },
  {
    id: "bf-r-prehistoric", gameSlug: "blox-fruits", section: "recruit", everyoneRewarded: true,
    art: "/art/services/prehistoric-island.jpg",
    name: "Prehistoric Island hunt", kind: "Island",
    needs: "It can surface without one, but somebody bringing a Volcanic Magnet makes the whole hunt worth doing",
    players: 4,
    aliases: ["prehistoric", "dino", "volcanic magnet"], verified: true,
  },
  {
    id: "bf-r-mirage", gameSlug: "blox-fruits", section: "recruit", everyoneRewarded: true,
    art: "/art/services/mirage-island.jpg",
    name: "Mirage Island hunt", kind: "Island",
    needs: "Night only. More people sailing means more servers checked, which is the whole trick to finding it",
    players: 4,
    gives: "The Mirror Fractal, and the Blue Gear",
    aliases: ["mirage", "mirage island", "blue gear"], verified: true,
  },
  {
    id: "bf-r-sea-events", gameSlug: "blox-fruits", section: "recruit", everyoneRewarded: true,
    art: "/art/services/sea-beast.jpg",
    name: "Sea event team", kind: "Event",
    needs: "Sail and take whatever surfaces — Ship Raids, Ghost Ships, Sea Beasts, Terrorsharks. Say in your post which sea and which Danger Level you are running",
    players: 4,
    gives: "Fragments and materials. A Ship Raid pays up to 100 Fragments",
    openEnded: true,
    aliases: ["sea event", "ship raid", "ghost ship", "danger level"], verified: true,
  },
  {
    id: "bf-r-terrorshark", gameSlug: "blox-fruits", section: "recruit", everyoneRewarded: true,
    art: "/art/services/terrorshark.jpg",
    name: "Terrorshark run", kind: "Hunt",
    needs: "Third Sea. Bring your own Monster Magnet if you want the Shark Anchor — only the player whose magnet was eaten gets the drop",
    players: 3,
    gives: "1,000 Valor a kill in the Third Sea",
    aliases: ["terrorshark", "shark anchor", "valor"], verified: true,
  },
  {
    id: "bf-r-ghost-ship", gameSlug: "blox-fruits", section: "recruit", everyoneRewarded: true,
    name: "Haunted Shipwreck crew", kind: "Event",
    needs: "Ghost Ship Raids, Ghost Sharks and Haunted Crew Members. They hit hard and they sink your boat, so bring people who can take a hit",
    players: 4,
    aliases: ["ghost ship", "haunted", "shipwreck"], verified: true,
  },

  // ---- Raid bosses that will not go down to one person ----
  {
    id: "bf-r-dough-king", gameSlug: "blox-fruits", section: "recruit", everyoneRewarded: true,
    art: "/art/services/dough-king.jpg",
    name: "Dough King raid", kind: "Raid",
    needs: "The Advanced Dough raid, all five islands, then the King on a timer. This is the raid people burn a whole evening failing alone",
    players: 4,
    gives: "Dough Awakening and Dough Remnant",
    aliases: ["dough king", "dough", "advanced raid"], verified: true,
  },
  {
    id: "bf-r-cake-prince", gameSlug: "blox-fruits", section: "recruit", everyoneRewarded: true,
    art: "/art/services/cake-prince.jpg",
    name: "Cake Prince raid", kind: "Raid",
    needs: "At least three people — he has the health and the move spam to outlast anything smaller",
    players: 3,
    gives: "The Dough Fruit chance, and Cake Prince drops",
    aliases: ["cake prince", "cake", "dough fruit"], verified: true,
  },
  {
    id: "bf-r-rip-indra", gameSlug: "blox-fruits", section: "recruit", everyoneRewarded: true,
    name: "Rip Indra (True Form) raid", kind: "Raid",
    needs: "Castle on the Sea, Third Sea. Not to be attempted alone unless you are max level with everything maxed, which is why this is here and not on the services board",
    players: 4,
    gives: "A step on Race Awakening, and Indra's drops",
    aliases: ["rip indra", "indra", "castle on the sea"], verified: true,
  },
  {
    id: "bf-r-boss", gameSlug: "blox-fruits", section: "recruit", everyoneRewarded: true,
    name: "Boss hunt — say which", kind: "Raid",
    needs: "For any boss not listed here. Name it in your post, with the sea and the level you expect people to be",
    players: 3,
    openEnded: true,
    aliases: ["boss", "raid boss", "hunt"], verified: true,
  },

  // ---- Farming crews ----
  {
    id: "bf-r-fragments", gameSlug: "blox-fruits", section: "recruit", everyoneRewarded: true,
    name: "Fragment farm — raid team", kind: "Raid",
    needs: "Chip holders and a team that will keep going back in. About 14,500 Fragments awakens most fruits, which is nobody's single sitting",
    players: 4,
    gives: "Fragments, and awakenings at the end of them",
    aliases: ["fragments", "frags", "raid farm", "awakening"], verified: true,
  },
  {
    id: "bf-r-bounty", gameSlug: "blox-fruits", section: "recruit", everyoneRewarded: true,
    name: "Bounty / Honour hunt squad", kind: "Hunt",
    needs: "Say whether you are hunting Pirates or Marines, and roughly what level. A squad that does not agree on the side it is on spends the night fighting itself",
    players: 3,
    aliases: ["bounty", "honour", "honor", "pvp", "marines", "pirates"], verified: true,
  },
  {
    id: "bf-r-elite", gameSlug: "blox-fruits", section: "recruit", everyoneRewarded: true,
    art: "/art/services/elite-diablo.jpg",
    name: "Elite Pirates hunter squad", kind: "Hunt",
    needs: "Third Sea. Thirty quests guarantees Yama, and it goes a great deal faster with people",
    players: 3,
    gives: "Yama, and the Pretty Helmet at five Elite Pirates",
    aliases: ["elite", "elite pirates", "yama", "elite hunter"], verified: true,
  },
  {
    id: "bf-r-level-grind", gameSlug: "blox-fruits", section: "recruit", everyoneRewarded: true,
    name: "Level grinding party", kind: "Grind",
    needs: "Say which sea and roughly what level, so people turn up somewhere useful to them too",
    players: 3,
    aliases: ["level", "grind", "xp", "party"], verified: true,
  },

  // ---- The game's own crew system ----
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
/**
 * The two games nobody has researched yet.
 *
 * These are placeholders and they read like it: a name, a kind, a player count,
 * no requirement and no reward, because nobody has checked. They exist so the
 * boards are not empty, and PARTIAL_SERVICES says so in the interface.
 *
 * Five entries that used to live here have been deleted rather than improved,
 * and the deletions are the useful part of this comment:
 *
 *   adopt-me "Task help" and "Neon making" — aging runs at the same speed
 *     alone, and making a neon needs four pets you already own. Neither is a
 *     job a second player can help with.
 *   pet-simulator-99 "Hatching help" and "Zone carry" — hatching is solo, and
 *     the carry is now ps99-s-raid-carry, written from what raids actually do.
 *   creatures-of-sonaria "Growth help" and "Group hunt" — growing is solo, and
 *     standing near somebody so they do not get killed is company, which is
 *     what the community tab is for.
 *
 * Every one of them was a plausible-sounding service for a thing you can do by
 * yourself. That is the failure mode this file has to keep catching.
 */
const OTHER_SERVICES: Service[] = [

];


/* ==================================================================== */
/* Fisch                                                                */
/* ==================================================================== */

/**
 * Fisch — services.
 *
 * Two. Not two because the research ran out of time: two because Fisch almost
 * never stops one player finishing something. Expedition puzzles, Marlon's
 * quest chain, door and lever and pedestal mechanics, the Heaven's Rod crystal
 * vault — all of them were checked and all of them can be done alone.
 *
 * Exactly one mechanic in the whole game physically refuses a single player:
 * the Glacial Grotto diamond puzzle needs two people standing on two pedestals
 * at the same moment. The Marlon Friend pairing is the other, and it earns its
 * place differently — it does not block you, it doubles both of you.
 *
 * A third would have to be invented, and an invented service is a player
 * sitting in a server waiting for help with something they could have done
 * twenty minutes ago.
 */
const FISCH_SERVICES: Service[] = [
  {
    id: "fisch-s-diamond-puzzle", gameSlug: "fisch", section: "services",
    name: "Glacial Grotto diamond puzzle", kind: "Puzzle", group: "Northern Expedition",
    needs:
      "Two players each hold out a Glass Diamond on the two pedestals at the same time. The beam only melts the ice around the Crystalized Rod when both of you are standing there together — one person cannot reach both.",
    players: 2,
    gives: "The ice melts for good and the Crystalized Rod goes on sale (35,000 C$) for both of you",
    aliases: ["diamond puzzle", "crystalized rod", "crystallized rod", "glacial grotto", "glass diamond"],
    everyoneRewarded: true, verified: true,
  },
  {
    id: "fisch-s-marlon-friend", gameSlug: "fisch", section: "services",
    name: "Marlon Friend paired quest", kind: "Grind", group: "Moosewood",
    needs:
      "Pair up at the Marlon Friend NPC and both of you finish your quest. Pairing gives you 2 reward spins each instead of the 1 you get alone.",
    players: 2,
    gives: "2 Friend Quest spins each — XP, potions, and a chance at the Friendly Rod and rod-skin crates",
    aliases: ["marlon", "marlon friend", "friend quest", "friendly rod", "spins"],
    everyoneRewarded: true, verified: true,
  },
];

/**
 * Fisch — the Fleet.
 *
 * The one rule that decided this list: a hunt that ends the moment somebody
 * lands the fish is a race, and MintPlaza will not help you recruit people to
 * lose to you. Megalodon, Kraken, Ancient Kraken, Bloop Fish and Megamouth
 * hunts all die on the first catch — the Bloop even puts up a barrier and tells
 * you to "be the first and only" — so none of them is here. They exist in the
 * catalogue, on the fish they drop, and nowhere else.
 *
 * What is here either has a shared stock (the Apex pool lets 400 people catch),
 * a server-wide buff (an Aurora Totem lights up the whole lobby), or no scarce
 * prize at all (teaching, ferrying, appraising).
 */
const FISCH_RECRUIT: Service[] = [
  {
    id: "fisch-r-crew-found", gameSlug: "fisch", section: "recruit",
    name: "Start a crew", kind: "Crew", group: "Crews",
    needs:
      "Crews are made at the Crew Herald in Moosewood: 50,000 C$ and Level 200+. You start with 10 seats and the Crew Architect expands you to 50.",
    players: 3,
    gives: "A shared Crew Rating that unlocks the Crew Bobber (100), Crew Lantern (1,000), Crew Rod (5,000) and the Crew-ser boat (20,000)",
    aliases: ["crew", "clan", "found crew", "crew rod", "crews"],
    everyoneRewarded: true, verified: true,
  },
  {
    id: "fisch-r-crew-daily", gameSlug: "fisch", section: "recruit",
    name: "Crew daily challenges", kind: "Crew", group: "Crews",
    needs:
      "At least half the crew has to finish each of the three daily challenges for them to count. They reset at 00:00 UTC.",
    players: 3,
    gives: "Crew Rating toward the monthly leaderboard, plus the rotating cosmetics",
    aliases: ["daily challenge", "crew rating", "challenges"],
    everyoneRewarded: true, verified: true,
  },
  {
    id: "fisch-r-crew-weekly", gameSlug: "fisch", section: "recruit",
    name: "Crew weekly challenges", kind: "Crew", group: "Crews",
    needs: "The crew grinds the weekly challenges together. They reset on Mondays and they are where the rating actually comes from.",
    players: 3,
    gives: "+50 Crew Rating per weekly challenge finished",
    aliases: ["weekly challenge", "crew", "rating"],
    everyoneRewarded: true, verified: true,
  },
  {
    id: "fisch-r-apex-hunt", gameSlug: "fisch", section: "recruit",
    name: "Apex hunt party", kind: "Hunt", group: "Hunts",
    needs:
      "An Apex Pool spawns with a shared global stock — 400 Narwhal or Beluga, 350 Magician Narwhal — and a group fishes it until the stock runs out. This is not a race: there are hundreds of them.",
    players: 3,
    gives: "A Narwhal, Beluga or Magician Narwhal for everyone who catches before the stock empties",
    aliases: ["apex hunt", "narwhal", "beluga", "magician narwhal"],
    everyoneRewarded: true, verified: true,
  },
  {
    id: "fisch-r-baby-bloop", gameSlug: "fisch", section: "recruit",
    name: "Baby Bloop hunt", kind: "Hunt", group: "Hunts",
    needs:
      "Everyone fishes the Baby Bloop abundance and catches as many as they can. More catches across the server raise the chance the next hunt spawns.",
    players: 3,
    gives: "Baby Bloop Fish for every catcher. The Bloop Fish Hunt that can follow is one-winner and is deliberately not part of this.",
    aliases: ["baby bloop", "bloop", "bloop whistle"],
    everyoneRewarded: true, verified: true,
  },
  {
    id: "fisch-r-aurora-totem", gameSlug: "fisch", section: "recruit",
    name: "Aurora Totem luck party", kind: "Event", group: "Totems & Weather",
    needs:
      "Somebody pops an Aurora Totem and starts Aurora Borealis. The luck boost is server-wide, so the whole lobby fishes it together while it lasts.",
    players: 3,
    gives: "A shared luck boost for the whole server, for as long as the weather holds",
    aliases: ["aurora", "aurora totem", "borealis", "luck party"],
    everyoneRewarded: true, verified: true,
  },
  {
    id: "fisch-r-expedition-climb", gameSlug: "fisch", section: "recruit",
    name: "Northern Expedition climb", kind: "Island", group: "Expeditions",
    needs:
      "Climb the Northern Summit together, watching Temperature and Oxygen the whole way, to reach the high-altitude spots and camps.",
    players: 3,
    gives: "Frigid Cavern, Cryogenic Canal and Glacial Grotto fishing — and their rods — open to everyone who makes the climb",
    aliases: ["northern expedition", "summit", "climb", "glacial grotto", "frigid cavern"],
    everyoneRewarded: true, verified: true,
  },
  {
    id: "fisch-r-heavens-rod", gameSlug: "fisch", section: "recruit",
    name: "Heaven's Rod crystal run", kind: "Puzzle", group: "Expeditions",
    needs:
      "Four energy crystals from around the mountain and five red buttons in Glacial Grotto opens the vault. A group gathers the crystals far faster — but be straight with people: this can be done alone, so it is company, not rescue.",
    players: 3,
    gives: "The vault stays open for good and Heaven's Rod goes on sale (1,750,000 C$, Level 220)",
    aliases: ["heavens rod", "crystal puzzle", "vault", "energy crystals"],
    everyoneRewarded: true, verified: true,
  },
  {
    id: "fisch-r-seasonal-event", gameSlug: "fisch", section: "recruit",
    name: "Seasonal event fishing", kind: "Event", group: "Events",
    needs:
      "Fish a live event together — Fischfest, Fischmas, FischFright, Fischgiving, Valentides, Shamrock Seas — for the catches that only exist while the window is open.",
    players: 3, openEnded: true,
    gives: "Event-only fish, event currency and cosmetics — every participant can earn them",
    aliases: ["fischfest", "event", "seasonal", "fischmas", "fischfright", "fischgiving"],
    everyoneRewarded: true, verified: true,
  },
  {
    id: "fisch-r-bestiary", gameSlug: "fisch", section: "recruit",
    name: "Bestiary completion party", kind: "Grind", group: "Help & Teaching",
    needs: "A group fishes one region together until everybody's Bestiary page for it is full.",
    players: 3,
    gives: "Bestiary bobbers and the page-completion rewards, for each person's own book",
    aliases: ["bestiary", "completion", "bobber party"],
    everyoneRewarded: true, verified: true,
  },
  {
    id: "fisch-r-teach", gameSlug: "fisch", section: "recruit",
    name: "Teaching new anglers", kind: "Grind", group: "Help & Teaching",
    needs: "Somebody who knows the game shows newcomers rods, bait, mutations, totems and how to get between regions.",
    players: 3,
    gives: "Knowledge. No item changes hands, which is the point.",
    aliases: ["teaching", "help", "new player", "beginner guide"],
    everyoneRewarded: true, verified: true,
  },
  {
    id: "fisch-r-appraise", gameSlug: "fisch", section: "recruit",
    name: "Appraisal meetup", kind: "Grind", group: "Help & Teaching",
    needs: "Meet up, appraise catches at the Appraiser, and sanity-check each other's trade values before anybody accepts anything.",
    players: 3,
    gives: "A second opinion and a W/F/L read. No item reward.",
    aliases: ["appraise", "value check", "wfl", "appraisal"],
    everyoneRewarded: true, verified: true,
  },
  {
    id: "fisch-r-region-access", gameSlug: "fisch", section: "recruit",
    name: "Region access ferry", kind: "Island", group: "Help & Teaching",
    needs: "Somebody with a fast, many-seat boat ferries newer anglers out to regions they cannot reach yet.",
    players: 3,
    gives: "A ride out, and everyone can then fish there themselves",
    aliases: ["ferry", "boat ride", "region access", "carry"],
    everyoneRewarded: true, verified: true,
  },
];

/* ==================================================================== */
/* Grow a Garden 2                                                      */
/* ==================================================================== */

/**
 * GAG2 — nothing in services, on purpose.
 *
 * GAG2 never blocks solo play. There is no boss, no gated puzzle, no job that
 * needs a second pair of hands. Every candidate was a farming-efficiency trick,
 * and "I could do this faster with a friend" is not the same as "the game will
 * not let me do this alone" — only the second one is a service.
 */
const GAG2_RECRUIT: Service[] = [
  {
    id: "gag2-r-guild-competition", gameSlug: "gag2", section: "recruit",
    name: "Guild for the weekly competition", kind: "Crew", group: "Guilds",
    needs:
      "A guild holds 20 members and expands to 50. Each member's single heaviest harvest adds to the guild's weekly score, and everyone on a qualifying leaderboard tier is paid through the Mailbox.",
    players: 20,
    gives: "Placement rewards by rank — Ice Serpent and Black Dragon variants and eggs — sent to every qualifying member",
    aliases: ["guild", "weekly comp", "ice serpent", "black dragon", "gilbert"],
    // A tier, not a winner. Worth saying out loud because the competition IS a
    // ranked leaderboard: "join a guild and earn your tier" is honest,
    // "help my guild beat rank 1" would be recruiting people into a race.
    everyoneRewarded: true, verified: true,
  },
  {
    id: "gag2-r-teach-night", gameSlug: "gag2", section: "recruit",
    name: "Teach night-stealing and defence", kind: "Crew", group: "Learning",
    needs:
      "New growers learn the night cycle, which seeds actually defend a garden (Cactus, Bamboo, Venom Spitter, Dragon's Breath) and how mutations work, before they lose a plot to a raid.",
    players: 3,
    gives: "Knowledge. No prize.",
    aliases: ["help", "teach", "new", "beginner", "stealing", "defence", "defense"],
    everyoneRewarded: true, verified: true,
  },
];

/* ==================================================================== */
/* Pet Simulator 99                                                     */
/* ==================================================================== */

const PS99_SERVICES: Service[] = [
  {
    id: "ps99-s-raid-carry", gameSlug: "pet-simulator-99", section: "services",
    name: "Raid tier carry", kind: "Raid", group: "Raids",
    needs:
      "A stronger player clears a harder raid tier than you could reach alone. Loot is handed out per player by what each of you did, so a weaker player gets less — but never nothing.",
    players: 3,
    gives: "Raid chests, with Huge and Titanic chances, for everybody who was in it",
    aliases: ["raid", "carry", "boss", "chest", "tier"],
    everyoneRewarded: true, verified: true,
  },
  {
    // NOT postable, and that is the whole point of the flag.
    //
    // Nobody has been able to confirm that a helper in a boss fight gets any
    // loot at all. Until somebody does, putting this on the board would be
    // asking a stranger to spend their evening on a maybe. It stays in the
    // catalogue so the Studio can switch it on the day it is confirmed, and so
    // that a listing that somehow names it still renders as what it was.
    id: "ps99-s-boss-help", gameSlug: "pet-simulator-99", section: "services",
    name: "Boss help", kind: "Boss", group: "Raids",
    needs:
      "A stronger player helps beat a boss or level tier that is blocking you. Whether the helper is rewarded has not been confirmed — until it is, this is a favour, not a deal.",
    players: 2,
    gives: "The boss goes down and you get past it. What the helper gets is unknown.",
    aliases: ["boss", "stuck", "level", "help"],
    everyoneRewarded: false, draft: true, verified: false,
  },
];

const PS99_RECRUIT: Service[] = [
  {
    id: "ps99-r-clan-battle", gameSlug: "pet-simulator-99", section: "recruit",
    name: "Clan for the weekly Clan Battle", kind: "Crew", group: "Clans",
    needs:
      "Clans race to earn the most points on a set activity over about seven days. BIG Games' own patch notes put it plainly: every member in a winning clan gets the prize. The top 3 contributors get Rainbow and the top 10 get Golden on top of that.",
    players: 10,
    gives: "A Titanic or Huge plus a hoverboard or booth to every member of a winning clan",
    aliases: ["clan", "clan battle", "comp", "titanic"],
    everyoneRewarded: true, verified: true,
  },
  {
    id: "ps99-r-teach-trade", gameSlug: "pet-simulator-99", section: "recruit",
    name: "Teach trading and RAP", kind: "Crew", group: "Learning",
    needs:
      "New players learn what RAP actually means, how to read an exists count, and the trades that look generous and are not.",
    players: 3,
    gives: "Knowledge. No prize.",
    aliases: ["teach", "help", "rap", "scam", "new", "exists"],
    everyoneRewarded: true, verified: true,
  },
];

/* ==================================================================== */
/* Adopt Me                                                             */
/* ==================================================================== */

/**
 * Adopt Me — nothing in services, and it took two deletions to get here.
 *
 * "Pet aging buddy" went first: a pet ages at exactly the same rate whether you
 * are alone or in a full server. The only gain is one player managing several
 * pets, which is farming, not rescue.
 *
 * "Event minigame partner" went second, and it is the more interesting one.
 * The Hauntlet, Costume Party and Sleep or Treat all look co-op and none of
 * them is: each player earns candy from their own placement, their own votes,
 * their own doors. The only thing a second player adds is calling out which
 * door is safe. That is a conversation, not a job.
 */
const ADOPT_ME_RECRUIT: Service[] = [
  {
    id: "adoptme-r-event-group", gameSlug: "adopt-me", section: "recruit",
    name: "Seasonal event group", kind: "Event", group: "Events",
    needs:
      "Group up while an event is live — Halloween, Lunar New Year, Summer — to collect currency and event pets together. Everyone earns their own; nothing is shared out and nothing is taken from you.",
    players: 3, openEnded: true,
    gives: "Event pets and items, each player earning their own",
    aliases: ["event", "halloween", "lunar", "summer", "group"],
    everyoneRewarded: true, verified: true,
  },
  {
    id: "adoptme-r-teach-scams", gameSlug: "adopt-me", section: "recruit",
    name: "Teach trading and scam-spotting", kind: "Crew", group: "Learning",
    needs:
      "New traders learn W/F/L, how the Trade Licence test works, and the two scams that take the most pets off people: the trust trade, and the last-second swap.",
    players: 3,
    gives: "Knowledge. No prize.",
    aliases: ["teach", "scam", "trust trade", "wfl", "licence", "license", "new"],
    everyoneRewarded: true, verified: true,
  },
];

/* ==================================================================== */
/* Creatures of Sonaria                                                 */
/* ==================================================================== */

/**
 * Sonaria — nothing in services either. Growing and surviving are soloable, and
 * the closest thing to a job is standing near somebody so they do not get
 * killed, which is company rather than a deal. It is in the community tab,
 * where it is honest.
 */
const SONARIA_RECRUIT: Service[] = [
  {
    id: "sonaria-r-grow-group", gameSlug: "creatures-of-sonaria", section: "recruit",
    name: "Safe-growing group", kind: "Crew", group: "Growers",
    needs:
      "A new or large creature is at its most vulnerable while it grows. A group around you deters the players who hunt exactly that, and everyone grows their own creature in peace.",
    players: 3,
    gives: "Each player grows their own creature. There is no shared prize, and that is fine.",
    aliases: ["grow", "pack", "protect", "pvp", "group"],
    everyoneRewarded: true, verified: true,
  },
  {
    id: "sonaria-r-teach-trade", gameSlug: "creatures-of-sonaria", section: "recruit",
    name: "Teach the Trade Realm", kind: "Crew", group: "Learning",
    needs:
      "New players learn how the Trade Realm works, the 500,000 Shoom cap on a single trade, why Shooms trade and Tikits do not, and how the grey-slot scam is run.",
    players: 3,
    gives: "Knowledge. No prize.",
    aliases: ["teach", "trade realm", "scam", "shooms", "values", "new"],
    everyoneRewarded: true, verified: true,
  },
];

export const SERVICES: readonly Service[] = [
  ...BLOX_FRUITS_SERVICES, ...BLOX_FRUITS_RECRUIT, ...OTHER_SERVICES,
  ...FISCH_SERVICES, ...FISCH_RECRUIT,
  ...GAG2_RECRUIT,
  ...PS99_SERVICES, ...PS99_RECRUIT,
  ...ADOPT_ME_RECRUIT,
  ...SONARIA_RECRUIT,
];

/**
 * May a player actually post this?
 *
 * Two reasons to say no, and both of them protect the person who would answer
 * the listing rather than the person writing it:
 *
 *   - `draft` — the template is real but something about it is unconfirmed.
 *   - `everyoneRewarded` is not true — the reward may go to one person, so
 *     recruiting for it means recruiting people to lose.
 *
 * Recruitment is held to the stricter test because that is where a stranger is
 * being asked to give up an evening. On the services board a listing is one
 * player asking another for a favour, they can both see what it is, and
 * "everyone rewarded" is not always the right question — the Glacial Grotto
 * puzzle rewards both, but plenty of real favours simply do not pay the helper
 * and both sides know it going in.
 */
export function postable(s: Service): boolean {
  if (s.draft) return false;
  if ((s.section ?? "services") === "recruit" && s.everyoneRewarded !== true) return false;
  return true;
}

/**
 * The templates one board of one game offers, straight from code.
 *
 * This is the fallback the site renders when the database is unreachable, so it
 * has to apply the same `postable` rule the merged path does — otherwise a
 * database outage would quietly re-enable the one template we decided nobody
 * should be recruited for.
 */
export function servicesFor(
  gameSlug: string,
  section: Section = "services",
): readonly Service[] {
  return SERVICES.filter(
    (s) =>
      s.gameSlug === gameSlug &&
      (s.section ?? "services") === section &&
      postable(s),
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

/**
 * Games whose list is knowingly short, and why.
 *
 * Not the same thing as a game with NO services. Adopt Me, Sonaria and GAG2
 * have none because there is nothing to have — they were researched, every
 * candidate failed the test, and they ship as two-tab games. Those are finished,
 * not partial, and saying "coming soon" about them would be a lie.
 *
 * What is listed here is genuinely unfinished: a game where the research has
 * not been done yet.
 */
export const PARTIAL_SERVICES: readonly string[] = [
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
  | { kind: "item"; itemId: string }
  /**
   * What the host wants back, written out.
   *
   * The other three are the Blox Fruits answers, and they were the only ones
   * offered. A Fisch guide wanting a rod, a Grow a Garden run wanting seeds and
   * a PS99 carry wanting gems all had to pick whichever button was least wrong
   * and then explain themselves in the description — so the description was
   * doing the terms' job on four of the six games.
   */
  | { kind: "text"; text: string };

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
 * A ceiling to stop a runaway selection, not a target. Thirty rather than
 * eighteen because the number is typed now rather than picked off a row of
 * buttons, and the only thing a ceiling has to stop is a slipped key turning
 * into a thousand-player post.
 */
export const MAX_TEAM = 30;

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
  /** Minutes since posting. */
  postedMinutesAgo: number;
  /**
   * How long the poster said it should stay up, in minutes.
   *
   * The clock used to be ours. It should never have been: the person who knows
   * how long they will be online is the person posting, and a fixed window
   * either cuts them off early or leaves a dead post on the board. Absent on
   * older rows and on trades, which fall back to the board's default.
   */
  windowMinutes?: number;
  /** Most people who may put their hand up. Absent means no limit. */
  voteCap?: number;
  /**
   * How many the poster intends to pick. Shown to voters, because "12 voted"
   * means something completely different when 10 will be taken than when 2 will.
   */
  slots?: number;
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

/**
 * What the poster can choose from.
 *
 * Bounded on both ends, and the bounds are the point. Ten minutes is the
 * shortest post anybody can realistically answer; four hours is the longest
 * that can still honestly be called live. Between those the choice is theirs —
 * a person who knows they are on for twenty minutes should be able to say so
 * rather than leaving a post that outlives them by an hour and forty.
 *
 * The database enforces the same bounds, so a hand-made request cannot post a
 * listing that sits on the board for a week.
 */
export const WINDOW_CHOICES: Readonly<Record<Section, readonly number[]>> = {
  services: [30, 60, 120, 240],
  // Shorter across the board: a crew call is "I am sailing now", and the answer
  // stops being true much faster than "I need this done today" does.
  recruit: [15, 30, 40, 60, 120],
};

/** Most people who may put their hand up. `null` is the no-limit choice. */
export const VOTE_CAP_CHOICES: readonly (number | null)[] = [5, 10, 25, 50, null];

export const MIN_WINDOW_MINUTES = 10;
export const MAX_WINDOW_MINUTES = 240;

/** The board a listing belongs to, from the template it was built on. */
export function sectionOf(l: Pick<ServiceListing, "serviceIds">): Section {
  return findService(l.serviceIds[0])?.section === "recruit" ? "recruit" : "services";
}

/**
 * How long this particular listing gets.
 *
 * The poster's choice where they made one, the board's default otherwise —
 * clamped either way, so a row written before these columns existed, or by
 * something that bypassed the form, still cannot outlive the bounds.
 */
export function windowFor(l: ServiceListing): number {
  const fallback =
    sectionOf(l) === "recruit" ? RECRUIT_WINDOW_MINUTES : LIVE_WINDOW_MINUTES;
  const chosen = l.windowMinutes ?? fallback;
  return Math.min(MAX_WINDOW_MINUTES, Math.max(MIN_WINDOW_MINUTES, chosen));
}

/** "40 minutes", "2 hours" — for the picker and the card. */
export function windowLabel(minutes: number): string {
  if (minutes < 60) return `${minutes} minutes`;
  const h = minutes / 60;
  return h === 1 ? "1 hour" : `${Number.isInteger(h) ? h : h.toFixed(1)} hours`;
}

/** True once the cap is reached and nobody else can put their hand up. */
export function votingFull(l: ServiceListing): boolean {
  return l.voteCap !== undefined && l.voteCount >= l.voteCap;
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
