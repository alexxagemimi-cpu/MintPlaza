/**
 * Where value questions go.
 *
 * ---------------------------------------------------------------------------
 * MintPlaza does not price trades, on purpose
 * ---------------------------------------------------------------------------
 *
 * This site used to carry its own value table and its own W/F/L calculator.
 * Both are gone, and removing them is a product decision rather than a cut
 * corner.
 *
 * A value list is not a feature you build once. It is a job somebody does every
 * day, for every game, forever — these markets move on patch days, on YouTube
 * videos, on a dupe getting patched at 3am — and a value list that is three
 * weeks old is worse than no value list, because a player reads a stale number
 * with exactly the same confidence as a fresh one and loses a trade on it. The
 * table this site shipped with covered 78 items out of 10,191, and three of the
 * six games had none at all while the interface still printed a source and a
 * date for them. That is not a gap to fill in later. That is a promise the site
 * could not keep.
 *
 * The six sites below already do that job, full time, and they are the numbers
 * these communities actually quote at each other. So MintPlaza sends every
 * value question to them and keeps none of its own. What MintPlaza is for is
 * the part they do not do: finding the person, seeing they are online, and
 * having somewhere safe to talk.
 *
 * ---------------------------------------------------------------------------
 * Three rules, all enforced below rather than promised
 * ---------------------------------------------------------------------------
 *
 * 1. Every game has a partner. Not "most" — every one. A game on the roster
 *    with nowhere to send its players is a dead end, and the proof script
 *    fails the build over it. That is why `partnerFor` returns a partner for
 *    any registered slug rather than an optional.
 *
 * 2. Nothing claims to be paid until it is paid. A partner carries `active`,
 *    false until a signed agreement exists. An inactive partner is still
 *    linked — the player still needs the answer — but the paid-link disclosure
 *    is not shown, because saying "we earn commission" with no agreement is a
 *    lie that flatters us, and saying nothing once one exists is a lie that is
 *    illegal in most of the markets this site serves.
 *
 * 3. The destination is derived server-side from a game slug. It is NEVER
 *    taken from the request. A redirect endpoint that forwards to a
 *    caller-supplied URL is an open redirect, and an open redirect on a site
 *    full of teenagers holding valuable inventories is a phishing kit with our
 *    domain on the front of it. See src/app/go/[game]/route.ts, which rebuilds
 *    the URL from the registry below and ignores anything else it is handed.
 */

/** What the player is asking for. Decides which of the partner's pages to open. */
export type ValuesIntent = "values" | "calculator";

/** The two intents, for anything that needs to validate one. */
export const VALUES_INTENTS: readonly ValuesIntent[] = ["values", "calculator"];

export function isValuesIntent(s: string | null): s is ValuesIntent {
  return s === "values" || s === "calculator";
}

/**
 * A site MintPlaza sends value questions to.
 *
 * `attributionParam` is how the money is tracked, and the id that goes with it
 * lives in the environment rather than here: the agreement is commercial and
 * changes without the software changing. A new partner is a new entry plus an
 * environment variable, not a refactor.
 */
export interface ValuesPartner {
  key: string;
  /** What the site calls itself. Shown to players, so it has to be their name. */
  name: string;
  /** Origin, no trailing slash. */
  home: string;
  /** The query parameter this partner attributes inbound clicks with. */
  attributionParam: string;
  /** Registry slugs this partner covers. */
  games: readonly string[];
  /** Path to the game's value list. */
  valuesPath(gameSlug: string): string;
  /**
   * Path to the game's W/F/L calculator, where the partner has one. Undefined
   * falls back to the value list, which still answers the question — it just
   * makes the player do the adding up.
   */
  calculatorPath?(gameSlug: string): string | undefined;
  /** What the agreement pays, and on what. Admin-facing, never shown to players. */
  terms: string;
  /**
   * False until a signed agreement exists. Gates the disclosure and the
   * attribution parameter — never the link itself.
   */
  active: boolean;
}

/**
 * The partner registry.
 *
 * Every one of these was opened and checked on 17 September 2026, and the paths
 * are paths that exist rather than paths that look like they should. That
 * matters more here than anywhere else in the codebase: a value link that 404s
 * is worse than no link, because the player has already left the site to find
 * out.
 *
 * Every entry is `active: false` today. No agreement has been signed, so no
 * commission is claimed and no disclosure is shown. Flipping one to true, with
 * its id in the environment, is the whole integration.
 */
export const PARTNERS: readonly ValuesPartner[] = [
  {
    key: "cosmic-values",
    name: "Cosmic Values",
    home: "https://petsimulatorvalues.com",
    attributionParam: "ref",
    games: ["pet-simulator-99"],
    valuesPath: () => "/values.php?category=all",
    calculatorPath: () => "/trade-calculator.php?category=all",
    terms: "No agreement yet. The PS99 community's default value list; integrated into the game itself.",
    active: false,
  },
  {
    key: "elvebredd",
    name: "Elvebredd",
    home: "https://elvebredd.com",
    attributionParam: "ref",
    games: ["adopt-me"],
    // The Elvebredd home page is the calculator, so both intents land on it.
    // Splitting them onto invented paths would only manufacture 404s.
    valuesPath: () => "/",
    calculatorPath: () => "/",
    terms: "No agreement yet. The Adopt Me values most traders quote.",
    active: false,
  },
  {
    key: "blox-fruits-values",
    name: "Blox Fruits Values",
    home: "https://bloxfruitsvalues.com",
    attributionParam: "ref",
    games: ["blox-fruits"],
    valuesPath: () => "/values",
    calculatorPath: () => "/calculator",
    terms: "No agreement yet. Values set by active traders; has its own trade ads.",
    active: false,
  },
  {
    key: "gag2gg",
    name: "GAG2.GG",
    home: "https://www.gag2.gg",
    attributionParam: "ref",
    games: ["gag2"],
    valuesPath: () => "/",
    calculatorPath: () => "/wiki/calculator",
    terms:
      "No agreement yet. Prices from completed trades, and its calculator runs the game's own sell formula — the closest thing GAG2 has to an exact number.",
    active: false,
  },
  {
    key: "game-guide",
    name: "Game.Guide",
    home: "https://www.game.guide",
    attributionParam: "ref",
    games: ["creatures-of-sonaria", "fisch"],
    valuesPath(gameSlug) {
      const map: Record<string, string> = {
        "creatures-of-sonaria": "/creatures-of-sonaria-value-list",
        fisch: "/fisch-value-list",
      };
      // Unreachable for a registered game — the map covers exactly `games`
      // above, and the proof script checks that it does. The fallback exists so
      // a typo cannot produce an undefined path at runtime.
      return map[gameSlug] ?? "/";
    },
    // Game.Guide publishes lists, not a calculator. The player adds up two
    // sides themselves, which is honest work rather than a missing feature.
    terms: "No agreement yet. Covers the two games nobody else lists.",
    active: false,
  },
];

/**
 * The partner for a game, or undefined for a slug that is not on the roster.
 *
 * Undefined means "no such game", not "no such partner" — every game on the
 * roster has one, and the proof script fails the build if that stops being
 * true. Callers that already hold a registered slug can treat the result as
 * present.
 */
export function partnerFor(gameSlug: string): ValuesPartner | undefined {
  return PARTNERS.find((p) => p.games.includes(gameSlug));
}

/**
 * Our id with a partner, read from the environment.
 *
 * Server-only: read inside the redirect route, never bundled into a page. It
 * ends up visible in the outbound URL either way — that is what an attribution
 * parameter is — but keeping it off the client means rotating it is a deploy
 * rather than a rebuild, and an inactive partner leaks nothing at all.
 */
export function partnerId(partner: ValuesPartner): string | undefined {
  const id = process.env[`PARTNER_ID_${partner.key.toUpperCase().replace(/-/g, "_")}`];
  return id && id.trim() ? id.trim() : undefined;
}

export interface ValuesLink {
  /** Internal href. Always same-origin — the outbound URL is built server-side. */
  href: string;
  /** Partner name, for the link text. */
  provider: string;
  /** True when this link earns commission and must say so. */
  paid: boolean;
  /** True when the partner has a real calculator behind the calculator intent. */
  hasCalculator: boolean;
}

/**
 * Where to send a player who needs a value or a W/F/L.
 *
 * Returns an internal href, not the partner's URL. The indirection is what
 * makes the click countable — commission gets reconciled against our own number
 * rather than only the partner's — and it is what keeps the outbound URL and
 * our attribution id out of the client bundle.
 */
export function valuesLink(
  gameSlug: string,
  intent: ValuesIntent = "values",
): ValuesLink | undefined {
  const partner = partnerFor(gameSlug);
  if (!partner) return undefined;
  const qs = intent === "calculator" ? "?for=calculator" : "";
  return {
    href: `/go/${encodeURIComponent(gameSlug)}${qs}`,
    provider: partner.name,
    paid: partner.active && partnerId(partner) !== undefined,
    hasCalculator: partner.calculatorPath?.(gameSlug) !== undefined,
  };
}

/**
 * Builds the real outbound URL. Server-side only — called by the redirect
 * route, never by a component.
 *
 * The attribution parameter is attached only when the partner is active AND an
 * id is configured. A `ref=undefined` on an outbound link would be a broken
 * claim on somebody else's analytics.
 */
export function outboundUrl(
  gameSlug: string,
  intent: ValuesIntent = "values",
): { url: string; partner: ValuesPartner } | undefined {
  const partner = partnerFor(gameSlug);
  if (!partner) return undefined;

  const path =
    (intent === "calculator" ? partner.calculatorPath?.(gameSlug) : undefined) ??
    partner.valuesPath(gameSlug);

  const url = new URL(path, partner.home);
  if (partner.active) {
    const id = partnerId(partner);
    if (id) url.searchParams.set(partner.attributionParam, id);
  }
  return { url: url.toString(), partner };
}

/**
 * Shown beside any paid link. Required by the FTC and the UK CAP code, and
 * correct regardless: a player weighing a trade deserves to know that the site
 * recommending the second opinion is paid for the recommendation.
 */
export const PAID_LINK_DISCLOSURE =
  "MintPlaza earns a commission if you use this link. It does not change the numbers you are shown, and MintPlaza has no say in what the other site publishes.";

/** Shown beside an unpaid outbound link, so the two are visibly different. */
export const PLAIN_LINK_NOTE =
  "Their numbers, not MintPlaza's. Values are a community estimate of a market that moves every day.";

/**
 * The one-line answer to "why doesn't this site have values?".
 *
 * Phrased as a choice, because it is one. "We don't have values yet" invites
 * the reader to wait for them; "we don't do values" tells them where to go.
 */
export const VALUES_POLICY =
  "MintPlaza does not set values. Values change every day and a stale number loses trades, so we send you to the list your game's traders actually use.";
