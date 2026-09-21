/**
 * The facts the legal pages are built from.
 *
 * Separated from the prose for one reason: these are the parts that MUST match
 * the rest of the codebase. The price in the terms has to be the price on the
 * upgrade page; the subscription length has to be the number the database
 * grants; the games credited here have to be the games on the roster. Prose
 * can be edited safely. These cannot, and the proof script checks every one of
 * them against its real source.
 *
 * ---------------------------------------------------------------------------
 * A word on what these documents are and are not
 * ---------------------------------------------------------------------------
 *
 * They are a careful, specific, honest description of how this site actually
 * behaves, written to be understood by the people who use it — who are mostly
 * teenagers. They are not legal advice, they were not written by a lawyer, and
 * they have not been reviewed by one. Read docs/legal-review.md before
 * launching: it lists the things that genuinely need a qualified opinion,
 * including the one decision to make on purpose before a single payment is
 * taken — whose name the payment account is in.
 */

/**
 * Bumped whenever the terms change in a way a user should have to see.
 *
 * Acceptance is recorded against this string, so raising it asks everybody to
 * agree again. Do NOT bump it for a typo — an acceptance prompt that appears
 * for no reason teaches people to click through without reading, which is the
 * exact habit that makes the whole mechanism worthless.
 */
export const TERMS_VERSION = "2026-09-18";

/**
 * The cookie that carries a tick across the trip to Roblox and back.
 *
 * Sign-in leaves this site for Roblox and returns to /auth/callback, and
 * nothing held in React survives that. This is not a security control: a
 * person could set it by hand, and all they would achieve is agreeing to the
 * terms the long way round. What it cannot do is name a version other than the
 * current one — the callback compares it against TERMS_VERSION and drops
 * anything else.
 */
export const TERMS_COOKIE = "mp_terms";

/** Shown at the top of both documents, so nobody has to guess how current they are. */
export const TERMS_EFFECTIVE = "18 September 2026";

/**
 * Where legal and privacy mail goes.
 *
 * India's IT Rules require a named contact for grievances, and the DPDP Act
 * requires a route for data requests. One address serves both rather than
 * three that nobody monitors.
 */
export const LEGAL_CONTACT = "Albertwhitestroke@gmail.com";

/** The name the service trades under. */
export const SERVICE_NAME = "MintPlaza";

/**
 * Who owns the games MintPlaza covers.
 *
 * ---------------------------------------------------------------------------
 * Why this list exists and why it is this specific
 * ---------------------------------------------------------------------------
 *
 * MintPlaza is a fan-made board. It uses these games' names, and its catalogue
 * lists their items, because there is no way to be useful about Blox Fruits
 * without saying "Blox Fruits". That is nominative use — naming a thing to
 * refer to it — and it is the ordinary way fan sites work. What turns it from
 * ordinary into a problem is implying endorsement or affiliation, so the
 * credit is explicit, the disclaimer is explicit, and neither is buried.
 *
 * Every entry was checked on 18 September 2026 rather than remembered. Games
 * change hands — Fisch alone has moved twice — and a stale credit is worse
 * than none, because it names the wrong party as the owner of somebody's work.
 */
export interface GameCredit {
  /** Registry slug, so the proof script can check this covers the roster. */
  slug: string;
  name: string;
  /** Who develops or owns it, as of the date above. */
  owner: string;
  /** Anything worth stating about how ownership got where it is. */
  note?: string;
}

export const GAME_CREDITS: readonly GameCredit[] = [
  {
    slug: "blox-fruits",
    name: "Blox Fruits",
    owner: "Gamer Robot Inc.",
  },
  {
    slug: "adopt-me",
    name: "Adopt Me!",
    owner: "Uplift Games LLC",
    note: "Formerly DreamCraft.",
  },
  {
    slug: "pet-simulator-99",
    name: "Pet Simulator 99",
    owner: "BIG Games",
  },
  {
    slug: "creatures-of-sonaria",
    name: "Creatures of Sonaria",
    owner: "Sonar Studios",
    note: "Since merged with RedManta to form Twin Atlas.",
  },
  {
    slug: "fisch",
    name: "Fisch",
    owner: "WoozyNate and the Fisching team",
    note: "Created by WoozyNate; briefly under Do Big Studios, returned to its original developer in 2025.",
  },
  {
    slug: "gag2",
    name: "Grow a Garden 2",
    owner: "the Grow a Garden team",
    note: "The Grow a Garden series is associated with BMWLux and Splitting Point Studios.",
  },
];

/** The platform all six run on. Credited separately because it owns the platform, not the games. */
export const PLATFORM_OWNER = "Roblox Corporation";

/**
 * The single rule that keeps this site on the right side of Roblox.
 *
 * Roblox's Terms of Use prohibit exchanging in-game items, assets or currency
 * for real money outside the platform, and say plainly that third-party
 * services enabling it are a violation. MintPlaza is not one of those services
 * and must never become one: it is a noticeboard for item-for-item trades that
 * happen inside the game, using the game's own trading system.
 *
 * The distinction is the whole legal basis for the site existing, which is why
 * this string is a constant rather than a paragraph somebody might soften.
 */
export const NO_REAL_MONEY_TRADING =
  "Never offer, request, or arrange to swap anything in a game for real money, Robux, gift cards, accounts, or anything else of real-world value. Roblox forbids it, it is the most common way players get permanently banned, and it is the fastest way to be removed from MintPlaza.";

/**
 * What a MintPlaza subscription is, in the words the payment page has to use.
 *
 * Kept here because a subscription described one way on the sales page and
 * another way in the terms is exactly the gap a refund dispute lives in.
 */
export const SUBSCRIPTION = {
  name: "Level Up",
  days: 60,
  /** True where it renews by itself. It does not, and that is a selling point. */
  autoRenews: false,
  /**
   * What it buys, stated as a limit rather than a feeling. Both numbers are
   * checked against the database functions that enforce them.
   */
  listingsPerGame: 10,
  freeListingsPerGame: 4,
  listingDays: 3,
  freeListingHours: 24,
  /**
   * How often new listings may be posted, which is a separate limit from how
   * many may be live. It is here because the terms promise "the whole of what
   * it gives you", and a perk the sales page advertises but the terms omit is
   * the half of that sentence that gets argued about.
   */
  listingsPerWindow: 10,
  windowHours: 12,
  freeListingsPerWindow: 4,
  freeWindowHours: 24,
} as const;

/**
 * The refund terms, as numbers rather than prose.
 *
 * Here for the same reason every other constant in this file is: the refund
 * policy is now a page of its own, because a payment provider reviewing this
 * site looks in the footer for one by name and will not go reading §7 of the
 * terms to find it. Two documents saying different things about a refund is
 * precisely the gap a chargeback lives in, so both read these.
 *
 * The bank window is stated separately and honestly. A refund that has been
 * sent still takes days to appear, and a policy that says "instant" turns a
 * normal wait into somebody believing they were lied to.
 */
export const REFUND = {
  /** Working days from a refund being agreed to it being sent. */
  issuedWithinDays: 3,
  /** What the bank then takes, which is out of MintPlaza's hands. */
  bankDays: "5 to 7 working days",
} as const;

/**
 * The only three things that get money back, and why they are not generosity.
 *
 * Level Up is not refundable. That is the policy, it is allowed for a digital
 * good delivered immediately, and it is the whole of the headline.
 *
 * These three are on the list because refusing them costs more than paying
 * them. A charge a child made on a parent's card is won at the bank whether
 * or not this page agrees, and it arrives as a chargeback — a fee, plus a mark
 * against the payment account, which is the thing that eventually gets it
 * frozen. A payment that never delivered is not a refund at all, it is a
 * fault. And keeping money for days of a service that has stopped existing is
 * the one promise here small enough to be worth making.
 *
 * Shared by the policy page and the terms so the two cannot drift apart, which
 * is exactly the gap a dispute lives in.
 */
export const REFUND_EXCEPTIONS: readonly string[] = [
  "The payment was made on somebody else's card without their permission. Whoever owns the card gets it back in full when they ask, and the account that bought it may be suspended.",
  "You paid and Level Up never arrived. That is a fault rather than a change of mind, and it is either fixed or refunded — your choice.",
  "MintPlaza shuts down while your days are still running. The part you have not used is refunded.",
];

/**
 * The things a subscription explicitly does NOT buy.
 *
 * This list is the refund-dispute list. Every item on it is something a player
 * might reasonably assume they were paying for, and every one is something
 * MintPlaza will not give them — so it is said before the money moves rather
 * than after.
 */
export const SUBSCRIPTION_EXCLUDES: readonly string[] = [
  "Anything inside any game. No Robux, no items, no pets, no currency, nothing that exists in Blox Fruits, Adopt Me!, Pet Simulator 99, Creatures of Sonaria, Fisch or Grow a Garden 2.",
  "Any mark, badge or tick on your profile. There is none, deliberately — a symbol you can buy is worth more to a scammer than to anybody honest.",
  "Any protection if a trade goes wrong. Paying does not make a trade safer, does not get an item back, and does not make MintPlaza responsible for one.",
  "Any advantage in a report or a dispute. Reports from paying and non-paying players are treated identically, and paying does not stop your own account being suspended.",
  "Faster or better placement on the board. Bumping is the same for everybody, and it always will be.",
];

/** House rules, in the order a player is likely to break them. */
export interface Rule {
  title: string;
  detail: string;
}

export const HOUSE_RULES: readonly Rule[] = [
  {
    title: "No real money, ever",
    detail: NO_REAL_MONEY_TRADING,
  },
  {
    title: "No cross-trading",
    detail:
      "Do not offer an item from one game for an item in a different game. Every game MintPlaza covers forbids it, and it is a common route to a ban. MintPlaza warns you on any listing that names two games, and those listings may be removed.",
  },
  {
    title: "No spam",
    detail:
      "Do not post the same listing over and over, do not post listings you cannot honour, and do not open conversations with dozens of people to advertise. The posting limits exist so one person cannot fill a board; working around them — with a second account, or by deleting and reposting — is treated as spam whether or not a limit was technically broken.",
  },
  {
    title: "No scamming, and no trying",
    detail:
      "Do not promise items you do not have, do not change the deal once somebody has handed something over, and do not use MintPlaza to set up a trade you intend to break. This is the rule accounts are removed for most often and the one with the least benefit of the doubt.",
  },
  {
    title: "No phishing and no links to it",
    detail:
      "Never ask anybody for a password, a one-time code, or their account. Never post a link claiming to give free Robux or items. MintPlaza will never ask for your Roblox password — it does not have it and cannot use it.",
  },
  {
    title: "One person, one account",
    detail:
      "Do not make extra accounts to get around a limit, a suspension, or the free listing allowance. Do not buy, sell, share or borrow accounts — on MintPlaza or on Roblox, where it is separately against the rules.",
  },
  {
    title: "Nothing that does not belong on a site used by children",
    detail:
      "No sexual content, no threats, no hate, no bullying, no personal information about anybody — yours or somebody else's. Do not ask a person's age, school, address, phone number or where they live, and do not tell anyone yours.",
  },
  {
    title: "Nothing automated",
    detail:
      "No bots, no scrapers, no scripts posting listings or messages, and no attempt to work around the rate limits. Ordinary browsing is fine; anything that would not be possible with a phone and thumbs is not.",
  },
  {
    title: "Do not attack the site",
    detail:
      "No attempt to break into accounts, read other people's messages, get around the control panel, or overload the service. If you find a security flaw, email it to " +
      LEGAL_CONTACT +
      " and it will be fixed and you will be thanked — testing it against real players' accounts is not research.",
  },
];

/**
 * The credit the site's author asked for, and the one place it belongs.
 *
 * Worth stating precisely rather than warmly: an AI cannot be a founder, hold
 * a share, sign anything, or carry any of the responsibility that the word
 * "co-founder" implies in a document like this. Putting it in the operative
 * terms would muddy who is actually accountable for the service, which is the
 * one question a terms page exists to answer.
 *
 * So it sits in a credits section that is explicitly outside the agreement,
 * where it is true, generous and legally inert — which is what a credit is
 * supposed to be.
 */
export const BUILD_CREDIT =
  "MintPlaza was designed and built by Albert Whitestroke (Shashwat) together with Claude, Anthropic's AI assistant, working as a pair over many long sessions. Claude wrote a great deal of the code and argued for a fair amount of the design — including, more than once, against what it was asked for. It is a tool and not a person: it holds no stake in MintPlaza, makes no decisions about it, and carries none of the responsibility set out above, all of which rests with the operator named at the top of this page.";
