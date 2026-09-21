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
 * The posting rules, as numbers, for anything that has to write them in a
 * sentence.
 *
 * ---------------------------------------------------------------------------
 * Why these are constants and not prose
 * ---------------------------------------------------------------------------
 *
 * PERKS below is the sales pitch, and scripts/proof.ts already checks every
 * figure in it against the SQL that enforces it. What it could not check was
 * the ordinary copy scattered through the interface — and two of those had
 * gone stale without anybody noticing:
 *
 *   The post-a-listing screen said listings expire after SEVEN DAYS and can be
 *   bumped ONCE A DAY. Both were true of an earlier design. Listings live 24
 *   hours now, three days with Level Up, and everyone gets four bumps a day.
 *
 *   The dashboard said the same seven days, and told a Level Up player that
 *   "all three" of their slots were in use when they have ten.
 *
 * Nobody writes those numbers by hand any more. Each one is here, each one is
 * checked against the database, and a screen that wants to say a number reads
 * it from this file.
 */
export const FREE_LISTING_HOURS = 24;
export const LEVEL_UP_LISTING_DAYS = 3;
export const FREE_PER_GAME = 4;
export const LEVEL_UP_PER_GAME = 10;

/**
 * The posting rate: how many new listings, and how long each slot takes to
 * come back.
 *
 * ---------------------------------------------------------------------------
 * Why the window is a day
 * ---------------------------------------------------------------------------
 *
 * It was three listings every three hours, and that is not a limit. Posting a
 * listing, finding somebody and closing the trade takes well under an hour, so
 * a free account had its slots back before it had any use for them — three an
 * hour of patience, twenty-four in a day, and a board one person could fill on
 * their own for nothing.
 *
 * A rate limit has to be slower than the thing it is limiting. A day is the
 * first window that is.
 *
 * The window is rolling, not a bucket that empties at midnight. A fixed daily
 * reset has an edge to stand on — four listings at 23:59 and four more at
 * 00:01 is eight in two minutes, every night, inside the rules. Rolling means
 * each slot returns exactly a window after the listing that spent it, so four
 * a day means four in whichever day you measure.
 *
 * Both halves are a Level Up perk, and they have to move together: ten per
 * window on a 24-hour window would be ten a day, which is barely a rise once a
 * paid listing already lives three days. Ten on twelve hours is twenty.
 *
 * These two are the FREE numbers. A signed-in player's real window comes back
 * from listing_allowance(), because a constant compiled into the page cannot
 * know whether the person reading it pays.
 */
export const FREE_PER_WINDOW = 4;
export const FREE_WINDOW_HOURS = 24;
export const LEVEL_UP_PER_WINDOW = 10;
export const LEVEL_UP_WINDOW_HOURS = 12;

/**
 * Bumps a day, and the cooldown that follows from it. Deliberately the same
 * free and paid: the board sorts on bumped_at, so selling bumps would mean
 * selling everybody else's position, which is how a board becomes a ladder.
 */
export const BUMPS_PER_DAY = 4;
export const BUMP_COOLDOWN_HOURS = 24 / BUMPS_PER_DAY;

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
 *
 * ---------------------------------------------------------------------------
 * What is deliberately NOT sold
 * ---------------------------------------------------------------------------
 *
 * BUMPING. The board sorts on when a listing was last bumped, so a paid bump
 * is the one perk that takes something from everybody else — it pushes their
 * listings down. Selling it turns the board into a pay-to-be-seen ladder,
 * which is how every marketplace that has tried it ends up. Everyone gets one
 * bump every six hours.
 *
 * LIVE POSTS. The 25-minute recruitment posts with the voting on them are
 * three per game for everybody. They are the part of the site that only works
 * when enough people can start one, and rationing them would thin out the
 * board rather than sell anything.
 *
 * A BADGE. There is no "Level Up" mark on a profile any more. On a site where
 * strangers hand each other valuable items, a mark you can buy is worth more
 * to a scammer than to anybody honest — they would be first in the queue —
 * and no amount of small print under it fixes what it looks like at a glance.
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
    title: "Ten listings instead of four",
    free: "4 live per game",
    levelUp: "10 live per game",
    blurb:
      "How many of your listings can be up at once in one game. Four is enough to trade with; ten is enough to clear out an inventory.",
  },
  {
    title: "Post twenty a day instead of four",
    free: "4 every 24 hours",
    levelUp: "10 every 12 hours",
    blurb:
      "A slot comes back a window after the listing that used it, so free accounts get four new listings a day and Level Up gets ten twice a day. Nothing resets at midnight — each slot returns on its own clock.",
  },
  {
    title: "Listings last three days instead of one",
    free: "24 hours",
    levelUp: "3 days",
    blurb:
      "Everything on MintPlaza expires after a day, so the board is never full of things that were traded away last week. Level Up gives yours three.",
  },
];

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
