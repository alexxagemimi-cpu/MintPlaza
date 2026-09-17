/**
 * Level Up — what it costs, and what it actually gets you.
 *
 * This file is the price list and the perk list. What somebody HAS is in the
 * database (see `public.entitlements` in supabase/schema.sql), and taking the
 * money is a payment processor's job. Those three things are deliberately in
 * three different places, because they fail for different reasons and change
 * on different schedules.
 *
 * ---------------------------------------------------------------------------
 * Why there is no exchange-rate lookup
 * ---------------------------------------------------------------------------
 *
 * The obvious build is: hold one price in dollars, call an FX API, show the
 * local number. Every part of that is a mistake.
 *
 * A live rate means a network call on a page render, a key to rotate, a
 * fallback for when it is down, and a price that is 5.98 one hour and 6.04 the
 * next — which reads as broken rather than as precise. It also means the number
 * on the card and the number the card is charged can differ, and the player
 * finds that out from their bank.
 *
 * So prices are fixed, hand-set, and each one is a decision somebody made
 * rather than a number a script produced. This is how every app store,
 * Netflix and Steam do it, for exactly these reasons.
 *
 * ---------------------------------------------------------------------------
 * Why there are only two of them
 * ---------------------------------------------------------------------------
 *
 * India pays ₹399. Everywhere else pays $6 USD.
 *
 * "Everywhere else pays in dollars" IS local pricing, done by the one party
 * that always has today's rate: the player's own bank. A card issued in Brazil
 * charged $6 USD settles in reais at the real rate on the day, automatically,
 * with no table here to maintain. Adding fourteen more currencies would mean
 * fourteen more numbers going quietly stale — which is the exact failure this
 * codebase just spent a release removing from its value tables.
 *
 * When a processor is live and there is evidence that local currency converts
 * better in a particular market, that market gets a row here. One row, one
 * decision, one date. Until then, two prices that are both correct beats
 * sixteen that are mostly guesses.
 */

/** How long one purchase lasts. Also the number the grant function defaults to. */
export const LEVEL_UP_DAYS = 60;

/**
 * What the database says the signed-in player has.
 *
 * Declared here rather than beside the function that reads it because the
 * settings panel is a client component, and a client component importing a
 * type from a module that also imports the Supabase server client is one
 * careless edit away from pulling server code into the browser bundle. A type
 * in a plain module cannot do that to anybody.
 */
export interface LevelUpStatus {
  active: boolean;
  /** When it ends, or when it ended. Null if they have never had one. */
  expiresAt: string | null;
  /** Rounded up, so the last day reads "1 day left" while it still works. */
  daysLeft: number | null;
  /** True where they had it and it ran out. A different message from never. */
  lapsed: boolean;
}

/** Nobody, and the safe default: with no database attached everyone is free. */
export const NO_LEVEL_UP: LevelUpStatus = {
  active: false,
  expiresAt: null,
  daysLeft: null,
  lapsed: false,
};

export interface Price {
  /** ISO 4217. */
  currency: string;
  /** In major units — 399 means ₹399, not paise. */
  amount: number;
  /** What to print in front of the number. */
  symbol: string;
  /** Rendered price, e.g. "₹399". */
  display: string;
}

const INR: Price = { currency: "INR", amount: 399, symbol: "₹", display: "₹399" };
const USD: Price = { currency: "USD", amount: 6, symbol: "$", display: "$6" };

/**
 * Country code to price. Anything not named here pays in USD.
 *
 * India is cheaper than the dollar price converts to, and that is the point
 * rather than an oversight — it is priced for what the game is worth to play
 * there, not for what a dollar is worth there.
 */
const PRICE_BY_COUNTRY: Record<string, Price> = {
  IN: INR,
};

export function priceFor(countryCode: string): Price {
  return PRICE_BY_COUNTRY[countryCode.toUpperCase()] ?? USD;
}

/** True where the player is charged in their own currency rather than in USD. */
export function isLocalCurrency(countryCode: string): boolean {
  return countryCode.toUpperCase() in PRICE_BY_COUNTRY;
}

/**
 * The line under the price, which only appears for the dollar price.
 *
 * It is here rather than in the component because it is a statement about how
 * the charge works, and getting it wrong is the kind of thing that ends in a
 * chargeback from somebody who expected their own currency.
 */
export function priceNote(countryCode: string): string | undefined {
  if (isLocalCurrency(countryCode)) return undefined;
  return "Charged in US dollars. Your bank converts it at their rate on the day, so what leaves your account is whatever $6 is worth where you are.";
}

/* ------------------------------------------------------------------ */
/* What it gets you                                                    */
/* ------------------------------------------------------------------ */

/**
 * The perks, with the free number beside the paid one.
 *
 * Every pair here matches a function in supabase/schema.sql, and the database
 * test suite asserts the paid numbers by making a player hit each limit. If
 * somebody changes one here and not there, this page starts lying — which is
 * why the proof script checks the two agree.
 */
export interface Perk {
  title: string;
  free: string;
  levelUp: string;
  /** Why it matters, in a sentence a fourteen-year-old would actually read. */
  blurb: string;
}

export const PERKS: readonly Perk[] = [
  {
    title: "Post more often",
    free: "3 every 3 hours",
    levelUp: "8 every 3 hours",
    blurb:
      "The slot limit is what stops the board filling with one person. Level Up raises yours; it does not remove it.",
  },
  {
    title: "Keep more up at once",
    free: "10 per game",
    levelUp: "25 per game",
    blurb:
      "If you trade in more than one game, or you hold a lot, ten runs out fast.",
  },
  {
    title: "Listings last three times as long",
    free: "7 days",
    levelUp: "21 days",
    blurb:
      "Fewer reposts. A listing for something rare can sit until the right person turns up.",
  },
  {
    title: "Bump three times a day",
    // Both sides in hours rather than "once a day" against "every 8 hours".
    // The two units made the comparison harder to read than it needed to be,
    // and the proof script caught it: every other perk states a number on both
    // sides, and a perk that does not is one somebody cannot check.
    free: "once every 24 hours",
    levelUp: "once every 8 hours",
    blurb:
      "A bump moves your listing back to the top. This is the one thing here that costs other players something, so it is three a day and not thirty.",
  },
  {
    title: "A Level Up mark on your profile",
    free: "—",
    levelUp: "yes",
    blurb:
      "It says you pay for the site. It is not a tick, it does not mean you are trustworthy, and it never will — see below.",
  },
];

/**
 * The line that has to appear wherever the badge does.
 *
 * On a site where teenagers hand strangers items worth months of grinding, a
 * mark that reads as "verified" is worth more to a scammer than to anybody
 * else — they would be the first in the queue to buy one. So this is not fine
 * print, it is the product working as intended: the badge is a receipt, not a
 * reference.
 */
export const BADGE_IS_NOT_TRUST =
  "The Level Up mark means somebody paid for the site. It does not mean they are safe to trade with, MintPlaza has not checked them, and it counts for nothing if a trade goes wrong. Check trades the same way whoever you are dealing with.";

/* ------------------------------------------------------------------ */
/* Countries                                                           */
/* ------------------------------------------------------------------ */

/**
 * The picker's list.
 *
 * Asked rather than guessed. A country read from an IP address is wrong for
 * anybody on a VPN, on mobile data routed through another city, or in a
 * household that uses one — and being told the wrong price with no way to
 * correct it is worse than being asked. It is also a location the site would
 * then be holding without having asked for it.
 *
 * The country chosen here decides what is SHOWN. What is CHARGED is decided by
 * the processor from the card itself, which is the only party that can actually
 * check — and the page says so, so that picking India from Ohio gets you a
 * number, not a discount.
 */
export interface Country {
  code: string;
  name: string;
}

export const COUNTRIES: readonly Country[] = [
  { code: "IN", name: "India" },
  { code: "US", name: "United States" },
  { code: "GB", name: "United Kingdom" },
  { code: "CA", name: "Canada" },
  { code: "AU", name: "Australia" },
  { code: "NZ", name: "New Zealand" },
  { code: "IE", name: "Ireland" },
  { code: "PH", name: "Philippines" },
  { code: "ID", name: "Indonesia" },
  { code: "MY", name: "Malaysia" },
  { code: "SG", name: "Singapore" },
  { code: "TH", name: "Thailand" },
  { code: "VN", name: "Vietnam" },
  { code: "PK", name: "Pakistan" },
  { code: "BD", name: "Bangladesh" },
  { code: "LK", name: "Sri Lanka" },
  { code: "NP", name: "Nepal" },
  { code: "AE", name: "United Arab Emirates" },
  { code: "SA", name: "Saudi Arabia" },
  { code: "TR", name: "Türkiye" },
  { code: "EG", name: "Egypt" },
  { code: "ZA", name: "South Africa" },
  { code: "NG", name: "Nigeria" },
  { code: "KE", name: "Kenya" },
  { code: "GH", name: "Ghana" },
  { code: "MA", name: "Morocco" },
  { code: "BR", name: "Brazil" },
  { code: "MX", name: "Mexico" },
  { code: "AR", name: "Argentina" },
  { code: "CL", name: "Chile" },
  { code: "CO", name: "Colombia" },
  { code: "PE", name: "Peru" },
  { code: "DE", name: "Germany" },
  { code: "FR", name: "France" },
  { code: "ES", name: "Spain" },
  { code: "IT", name: "Italy" },
  { code: "PT", name: "Portugal" },
  { code: "NL", name: "Netherlands" },
  { code: "BE", name: "Belgium" },
  { code: "AT", name: "Austria" },
  { code: "CH", name: "Switzerland" },
  { code: "SE", name: "Sweden" },
  { code: "NO", name: "Norway" },
  { code: "DK", name: "Denmark" },
  { code: "FI", name: "Finland" },
  { code: "PL", name: "Poland" },
  { code: "CZ", name: "Czechia" },
  { code: "RO", name: "Romania" },
  { code: "GR", name: "Greece" },
  { code: "HU", name: "Hungary" },
  { code: "UA", name: "Ukraine" },
  { code: "JP", name: "Japan" },
  { code: "KR", name: "South Korea" },
  { code: "TW", name: "Taiwan" },
  { code: "HK", name: "Hong Kong" },
  // Last on purpose. Somebody whose country is not listed still gets a price
  // and a working button, rather than a form that dead-ends on them.
  { code: "ZZ", name: "Somewhere else" },
];

export function isCountryCode(code: string | null | undefined): code is string {
  return typeof code === "string" && COUNTRIES.some((c) => c.code === code.toUpperCase());
}

export function countryName(code: string): string {
  return COUNTRIES.find((c) => c.code === code.toUpperCase())?.name ?? "Somewhere else";
}

/* ------------------------------------------------------------------ */
/* Checkout                                                            */
/* ------------------------------------------------------------------ */

/**
 * Where the buy button goes — read from the environment, server-side only.
 *
 * There is no card form in this codebase and there is not going to be one.
 * Taking a card means holding card data, which means PCI scope, which is not
 * something a website run by one person should ever be inside. Every real
 * option — Stripe, Razorpay, Paddle, Lemon Squeezy — hosts the payment page
 * themselves and hands back a URL. So this is a URL.
 *
 * Two variables, one per price point, because a processor's checkout link is
 * per-product and the rupee price and the dollar price are two products.
 *
 * When neither is set, the page says honestly that it cannot be bought yet.
 * That is the correct behaviour and not a placeholder: a button that pretends
 * to take money and does not is worse than no button, and a button that takes
 * money with nothing behind it is fraud.
 */
export function checkoutUrlFor(countryCode: string): string | undefined {
  const raw = isLocalCurrency(countryCode)
    ? process.env.LEVEL_UP_CHECKOUT_URL_INR
    : process.env.LEVEL_UP_CHECKOUT_URL_USD;

  const url = raw?.trim();
  if (!url) return undefined;

  // The value comes from an environment variable rather than from a request,
  // so this is not defending against an attacker — it is defending against a
  // typo in a deploy config becoming a `javascript:` link on a page full of
  // children. Anything that is not plain https is treated as not configured.
  try {
    const parsed = new URL(url);
    return parsed.protocol === "https:" ? parsed.toString() : undefined;
  } catch {
    return undefined;
  }
}

/** Shown where no processor is configured. */
export const CHECKOUT_UNAVAILABLE =
  "Level Up is not on sale yet — there is no payment provider connected to this site. Nothing here can take your money, and nothing will until that changes.";
