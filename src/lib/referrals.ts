/**
 * Outbound value lookups, and the commission that pays for them.
 *
 * ---------------------------------------------------------------------------
 * The problem this solves
 * ---------------------------------------------------------------------------
 *
 * The catalogue is 10,191 rows and 74 of them have a value. That is not a
 * failure of effort — nobody publishes values for ten thousand items, and the
 * six community sites that publish any at all disagree with each other, use
 * six different units, and refresh on their own schedule. Inventing the other
 * 10,117 numbers is the one thing this site must never do.
 *
 * So an unpriced item is not a gap to be filled with a guess. It is a question
 * MintPlaza cannot answer and somebody else can, and the honest move is to say
 * so and point at whoever can. That hand-off is also the business model: the
 * value sites want the traffic, MintPlaza has the traffic, and a referral
 * agreement pays for the hosting without ever putting a number in a player's
 * mouth that the site cannot stand behind.
 *
 * ---------------------------------------------------------------------------
 * Three rules, all enforced below rather than promised
 * ---------------------------------------------------------------------------
 *
 * 1. A referral is never presented as a value. It is a link to somebody else's
 *    opinion, labelled as somebody else's opinion. The verdict stays "?".
 *
 * 2. Nothing claims to be paid until it is paid. A partner carries `active`,
 *    and it is false until a signed agreement exists. An inactive partner still
 *    gets linked — the player still needs the answer — but the paid-link
 *    disclosure is not shown, because saying "we earn commission" when no
 *    agreement exists is a lie that happens to flatter us, and saying nothing
 *    once one does exist is a lie that happens to be illegal in most of the
 *    markets this site serves.
 *
 * 3. The destination is derived server-side from a game slug and an item id.
 *    It is NEVER taken from the request. A redirect endpoint that forwards to a
 *    caller-supplied URL is an open redirect, and an open redirect on a site
 *    full of teenagers trading valuables is a phishing kit with our domain on
 *    the front of it. See src/app/go/[game]/route.ts, which reconstructs the
 *    URL from the registry below and ignores anything else it is handed.
 */

import type { CatalogItem } from "./items";
import { VALUE_SOURCES } from "./values";

/**
 * A site MintPlaza sends value questions to.
 *
 * `attributionParam` and `partnerId` are how the money is tracked. Both sit in
 * config rather than in code because the agreement is commercial and changes
 * without the software changing: a new partner is a new entry here plus an
 * environment variable, not a refactor.
 */
export interface ReferralPartner {
  key: string;
  name: string;
  /** Origin, no trailing slash. */
  home: string;
  /** The query parameter this partner attributes inbound clicks with. */
  attributionParam: string;
  /**
   * Path to the game's value list on the partner's site. Undefined where the
   * partner does not cover that game, which is the common case — no partner
   * covers all eight.
   */
  path(gameSlug: string): string | undefined;
  /**
   * Path to one specific item, where the partner's URLs are stable enough to
   * deep-link. Most are not: a value site that reorganises its slugs every
   * patch would turn deep links into 404s, and a 404 is worse than a list page.
   * Undefined means "link to the list and let the player search".
   */
  itemPath?(gameSlug: string, item: CatalogItem): string | undefined;
  /** What the agreement pays, and on what. Admin-facing, never shown to players. */
  terms: string;
  /**
   * False until a signed agreement exists. Gates the disclosure and the
   * attribution parameter — not the link itself.
   */
  active: boolean;
}

/** Slugify the way most value sites do, for deep links. */
const kebab = (s: string) =>
  s.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "");

/**
 * The partner registry.
 *
 * These are the sites VALUE_SOURCES already names as where each game's numbers
 * come from, which is not a coincidence: the site a value was read from is the
 * site a player should be sent to when there is no value to read. Keeping them
 * the same means the referral never contradicts the citation.
 *
 * Every entry is `active: false` today. No agreement has been signed, so no
 * commission is claimed and no disclosure is shown. Flipping one to true, with
 * its id in the environment, is the whole integration.
 */
export const PARTNERS: readonly ReferralPartner[] = [
  {
    key: "game-guide",
    name: "Game.Guide",
    home: "https://www.game.guide",
    attributionParam: "ref",
    path(gameSlug) {
      const map: Record<string, string> = {
        "blox-fruits": "/blox-fruits-value-list",
        fisch: "/fisch-value-list",
        "creatures-of-sonaria": "/creatures-of-sonaria-value-list",
      };
      return map[gameSlug];
    },
    terms: "No agreement yet. Contacted for a revenue-share on referred traffic.",
    active: false,
  },
  {
    key: "adoptmevalues",
    name: "AdoptMeValues",
    home: "https://adoptmevalues.gg",
    attributionParam: "ref",
    path(gameSlug) {
      return gameSlug === "adopt-me" ? "/" : undefined;
    },
    itemPath(gameSlug, item) {
      // Adopt Me value pages are one-per-pet and their slugs have been stable
      // for years, so pets deep-link. Everything else goes to the list.
      if (gameSlug !== "adopt-me" || item.category !== "Pet") return undefined;
      return `/pet/${kebab(item.name)}`;
    },
    terms: "No agreement yet.",
    active: false,
  },
  {
    key: "gag2gg",
    name: "GAG2.GG",
    home: "https://gag2.gg",
    attributionParam: "ref",
    path(gameSlug) {
      return gameSlug === "gag2" ? "/values" : undefined;
    },
    terms: "No agreement yet.",
    active: false,
  },
];

/**
 * Pet Simulator 99 is deliberately absent from the registry.
 *
 * Its numbers come from BIG Games' own API, which is a developer endpoint
 * rather than a consumer site: there is nothing to send a player to and nobody
 * to be paid by. Adding a third-party PS99 value site here later is a one-entry
 * change; inventing one now, so that every game has a link, would be padding.
 */
export const NO_PARTNER_REASON: Record<string, string> = {
  "pet-simulator-99":
    "Pet Simulator 99's values come from BIG Games' own API, not from a value site, so there is nowhere to send you. The API's RAP figure is the closest thing to an official number any of these games has.",
  "grow-a-garden":
    "The original Grow a Garden has not been researched to the depth of the others yet.",
};

export function partnerFor(gameSlug: string): ReferralPartner | undefined {
  return PARTNERS.find((p) => p.path(gameSlug) !== undefined);
}

/**
 * Our id with a partner, read from the environment.
 *
 * Server-only: it is read inside the redirect route, never bundled into the
 * page. It ends up visible in the outbound URL either way — that is what an
 * attribution parameter is — but keeping it out of the client bundle means
 * rotating it is a deploy rather than a rebuild, and means an inactive partner
 * leaks nothing at all.
 */
export function partnerId(partner: ReferralPartner): string | undefined {
  const id = process.env[`PARTNER_ID_${partner.key.toUpperCase().replace(/-/g, "_")}`];
  return id && id.trim() ? id.trim() : undefined;
}

export interface Referral {
  /** Internal href. Always same-origin — the outbound URL is built server-side. */
  href: string;
  /** Partner name, for the link text. */
  provider: string;
  /** True when this link earns commission and must say so. */
  paid: boolean;
  /** Why there is no link, when there is no link. */
  unavailable?: string;
}

/**
 * Where to send a player who needs a value MintPlaza does not have.
 *
 * Returns an internal href, not the partner's URL. The indirection is what
 * makes the click countable — commission gets reconciled against our own
 * number rather than only the partner's — and it is what keeps the outbound
 * URL out of the client bundle.
 */
export function referralFor(gameSlug: string, itemId?: string): Referral {
  const partner = partnerFor(gameSlug);
  if (!partner) {
    return {
      href: "",
      provider: "",
      paid: false,
      unavailable:
        NO_PARTNER_REASON[gameSlug] ??
        "No value list covers this game yet, so there is nowhere to send you.",
    };
  }
  // Only the id is needed here. Resolving it to a catalogue row, and deciding
  // whether the partner can deep-link to it, happens in the redirect route —
  // which is the only place that should be building an outbound URL at all.
  const qs = itemId ? `?item=${encodeURIComponent(itemId)}` : "";
  return {
    href: `/go/${encodeURIComponent(gameSlug)}${qs}`,
    provider: partner.name,
    paid: partner.active && partnerId(partner) !== undefined,
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
  item?: CatalogItem,
): { url: string; partner: ReferralPartner } | undefined {
  const partner = partnerFor(gameSlug);
  if (!partner) return undefined;

  const path =
    (item && partner.itemPath?.(gameSlug, item)) ?? partner.path(gameSlug);
  if (!path) return undefined;

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
  "MintPlaza earns a commission if you use this link. It does not change the value you are shown, and MintPlaza has no say in what the other site publishes.";

/** Shown beside an unpaid outbound link, so the two are visibly different. */
export const PLAIN_LINK_NOTE =
  "A different site's numbers, not MintPlaza's. Values there are their estimate of a market that moves daily.";

/**
 * The line shown where a value is missing.
 *
 * Deliberately phrased as a limit rather than an apology. "No published value"
 * is a fact about the market; "we could not find one" sounds like a fact about
 * the site, and invites the reader to assume a better site would have it.
 */
export function unpricedExplanation(gameSlug: string, namedCount: number): string {
  const src = VALUE_SOURCES[gameSlug];
  if (!src) {
    return "No value list covers this game on MintPlaza yet, so nothing here is priced.";
  }
  // The same block appears beside named items in a trade and at the foot of a
  // ten-thousand-row catalogue, and the sentence has to be right in all three
  // shapes: no item named, one named, several named.
  if (namedCount === 0) {
    return `MintPlaza prices what ${src.name} publishes, in ${src.unit}, last read ${src.checked}. It does not cover everything in this list.`;
  }
  return (
    `${src.name} does not publish a value for ` +
    `${namedCount === 1 ? "this one" : "these"}. ` +
    `Values there are in ${src.unit}, last read ${src.checked}.`
  );
}
