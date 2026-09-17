import Link from "next/link";
import type { Metadata } from "next";
import { readLevelUp } from "@/lib/data/level-up";
import { LevelUpMark } from "@/components/LevelUpCard";
import {
  BADGE_IS_NOT_TRUST,
  CHECKOUT_UNAVAILABLE,
  COUNTRIES,
  LEVEL_UP_DAYS,
  PERKS,
  checkoutUrlFor,
  countryName,
  isCountryCode,
  priceFor,
  priceNote,
} from "@/lib/level-up";

export const metadata: Metadata = { title: "Level Up" };

/**
 * The upgrade screen.
 *
 * ---------------------------------------------------------------------------
 * Country first, price second, and it is a real question
 * ---------------------------------------------------------------------------
 *
 * The page has two states and the country in the URL is what switches between
 * them. No JavaScript, no client component, no state hook — picking a country
 * is a form that navigates, which means the price is on a real URL that can be
 * shared, reloaded, and read by somebody with a screen reader in the order it
 * is written.
 *
 * Asking rather than guessing from an IP address is a decision, not laziness.
 * A guess is wrong for anybody on a VPN or on mobile data routed through
 * another city, being told the wrong price with no way to correct it is worse
 * than being asked, and it would mean holding a location this site has no
 * business knowing.
 *
 * What is shown is not what is charged. The processor decides that from the
 * card itself, and this page says so — so choosing India from Ohio produces a
 * number on a screen and not a discount.
 */
export default async function UpgradePage({
  searchParams,
}: {
  searchParams: Promise<{ country?: string }>;
}) {
  const { country: raw } = await searchParams;
  const country = isCountryCode(raw) ? raw!.toUpperCase() : null;
  const status = await readLevelUp();

  return (
    <div className="mx-auto max-w-2xl px-4 py-10 sm:px-8 sm:py-14">
      <Link
        href="/app"
        className="text-[0.8125rem] font-semibold text-ink-mute hover:text-ink"
      >
        ← Back
      </Link>

      <header className="mt-5 flex items-center gap-2.5">
        <LevelUpMark size={26} />
        <h1 className="text-[1.5rem] font-bold tracking-[-0.03em] text-ink">Level Up</h1>
      </header>

      <p className="mt-2 text-[0.9375rem] leading-relaxed text-ink-mute">
        {LEVEL_UP_DAYS} days of more room to trade. It is not a subscription
        that renews on its own — when the {LEVEL_UP_DAYS} days are up it simply
        ends, and you decide whether to buy it again.
      </p>

      {status.active && (
        <p className="mt-4 rounded-[var(--radius-inner)] border border-mint/30 bg-mint-wash px-4 py-3 text-[0.875rem] font-semibold text-ink">
          You already have this
          {status.daysLeft !== null && ` — ${status.daysLeft} ${status.daysLeft === 1 ? "day" : "days"} left`}.
          Buying again adds {LEVEL_UP_DAYS} days on top of what is left, rather
          than replacing it.
        </p>
      )}

      {/* ---- what it actually gets you, before anything about money ---- */}
      <section className="mt-8">
        <h2 className="label">What changes</h2>
        <ul className="mt-3 grid gap-2.5">
          {PERKS.map((p) => (
            <li
              key={p.title}
              className="glass-quiet rounded-[var(--radius-inner)] px-4 py-3"
            >
              <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
                <p className="text-[0.875rem] font-bold tracking-[-0.015em] text-ink">
                  {p.title}
                </p>
                <p className="font-mono text-[0.6875rem] tracking-[0.06em] text-ink-faint">
                  <span className="line-through">{p.free}</span>
                  <span className="mx-1.5" aria-hidden="true">→</span>
                  <span className="font-bold text-mint">{p.levelUp}</span>
                </p>
              </div>
              <p className="mt-1 text-[0.75rem] leading-relaxed text-ink-mute">
                {p.blurb}
              </p>
            </li>
          ))}
        </ul>

        {/* Not a footnote. It is the one sentence on this page that could stop
            somebody being robbed, so it is given the weight of a warning. */}
        <p className="mt-3 rounded-[var(--radius-inner)] border border-warn/30 bg-warn-wash px-4 py-3 text-[0.75rem] leading-relaxed text-ink-soft">
          <b className="font-bold text-ink">The mark is not a safety check.</b>{" "}
          {BADGE_IS_NOT_TRUST}
        </p>
      </section>

      {/* ---- the money ---- */}
      <section className="mt-8">
        <h2 className="label">What it costs</h2>

        {country === null ? <CountryPicker /> : <PriceFor country={country} />}
      </section>

      <p className="mt-8 text-[0.75rem] leading-relaxed text-ink-faint">
        Level Up changes how much you can post. It does not change what anything
        is worth, it gives you no standing in a dispute, and it buys no
        influence over reports or moderation.
      </p>
    </div>
  );
}

/**
 * Step one.
 *
 * A plain form with method="get", so choosing a country is a navigation to
 * `?country=XX`. Nothing about this needs to be interactive, and making it a
 * client component would mean the price could not be linked to.
 */
function CountryPicker() {
  return (
    <form method="get" className="mt-3">
      <label
        htmlFor="country"
        className="block text-[0.875rem] font-semibold text-ink"
      >
        Where are you?
      </label>
      <p className="mt-1 text-[0.75rem] leading-relaxed text-ink-mute">
        The price is different in different places, so this decides which one
        you are shown.
      </p>

      <div className="mt-3 flex flex-wrap gap-2">
        <select
          id="country"
          name="country"
          defaultValue=""
          required
          className="min-w-[13rem] flex-1 rounded-[10px] border border-line bg-surface px-3 py-2.5 text-[0.9375rem] text-ink outline-none focus:border-mint"
        >
          <option value="" disabled>
            Pick your country
          </option>
          {COUNTRIES.map((c) => (
            <option key={c.code} value={c.code}>
              {c.name}
            </option>
          ))}
        </select>
        <button type="submit" className="pill pill-mint py-2.5 text-[0.875rem]">
          Show the price
        </button>
      </div>
    </form>
  );
}

/** Step two. */
function PriceFor({ country }: { country: string }) {
  const price = priceFor(country);
  const note = priceNote(country);
  const checkout = checkoutUrlFor(country);

  return (
    <div className="mt-3">
      <div className="glass rounded-[var(--radius-panel)] px-5 py-4">
        <p className="text-[0.75rem] text-ink-mute">{countryName(country)}</p>
        <p className="mt-0.5 flex items-baseline gap-2">
          <span className="text-[2rem] font-bold tracking-[-0.03em] text-ink">
            {price.display}
          </span>
          <span className="text-[0.875rem] text-ink-mute">
            for {LEVEL_UP_DAYS} days
          </span>
        </p>

        {note && (
          <p className="mt-2 text-[0.75rem] leading-relaxed text-ink-mute">{note}</p>
        )}

        <p className="mt-2 text-[0.75rem] leading-relaxed text-ink-faint">
          One payment. It does not renew by itself and there is nothing to
          cancel — after {LEVEL_UP_DAYS} days it just stops.
        </p>

        {checkout ? (
          <>
            <a
              href={`/upgrade/go?country=${encodeURIComponent(country)}`}
              rel="nofollow"
              className="pill pill-mint mt-4 inline-flex py-2.5 text-[0.9375rem]"
            >
              Continue to payment →
            </a>
            <p className="mt-2 text-[0.6875rem] leading-relaxed text-ink-faint">
              Payment is handled by an outside company on their own page.
              MintPlaza never sees your card. The final amount is set from the
              card you use, so if it was issued somewhere other than{" "}
              {countryName(country)} you may be charged that country&rsquo;s
              price instead.
            </p>
          </>
        ) : (
          <p className="mt-4 rounded-[var(--radius-inner)] border border-warn/30 bg-warn-wash px-4 py-3 text-[0.8125rem] leading-relaxed text-ink-soft">
            {CHECKOUT_UNAVAILABLE}
          </p>
        )}
      </div>

      <Link
        href="/upgrade"
        className="mt-3 inline-flex text-[0.8125rem] font-semibold text-ink-mute hover:text-ink"
      >
        ← Pick a different country
      </Link>
    </div>
  );
}
