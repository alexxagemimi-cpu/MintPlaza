import { notFound } from "next/navigation";
import Link from "next/link";
import type { Metadata } from "next";
import { GAMES, MODULE_LABELS, getGame, type Game } from "@/lib/games";
import { GameSwitcher } from "@/components/GameSwitcher";
import { DEMO_ENABLED, REASON_COPY, demoListings, type DemoListing } from "@/lib/demo";

export function generateStaticParams() {
  return GAMES.map((g) => ({ game: g.slug }));
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ game: string }>;
}): Promise<Metadata> {
  const game = getGame((await params).game);
  return { title: game ? game.name : "Dashboard" };
}

/* ------------------------------------------------------------------ */

function TopBar({ game }: { game: Game }) {
  return (
    <div className="mb-8 flex items-center justify-between gap-4">
      <div className="min-w-0">
        <p className="label">Dashboard</p>
        <h1 className="mt-1 truncate text-[1.5rem] font-extrabold tracking-[-0.035em] text-ink">
          {game.name}
        </h1>
      </div>

      <div className="flex shrink-0 items-center gap-2">
        <Link
          href={`/app/${game.slug}/explore`}
          className="glass-quiet grid h-10 w-10 place-items-center rounded-full text-ink-soft transition-colors hover:text-ink"
          aria-label={`Search ${game.name}`}
        >
          <svg width="17" height="17" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round">
            <circle cx="9" cy="9" r="6.5" />
            <path d="M17.5 17.5 13.7 13.7" />
          </svg>
        </Link>
        <Link
          href="/settings"
          aria-label="Your account"
          className="grid h-10 w-10 place-items-center rounded-full border border-line bg-fill text-[0.6875rem] font-bold text-ink-mute transition-colors hover:text-ink"
        >
          <svg width="17" height="17" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round">
            <circle cx="10" cy="7" r="3.2" />
            <path d="M4 16.5c.9-2.6 3.2-4 6-4s5.1 1.4 6 4" />
          </svg>
        </Link>
      </div>
    </div>
  );
}

/** Honest about example content, every time it is on screen (§53). */
function DemoBanner() {
  if (!DEMO_ENABLED) return null;
  return (
    <div className="mb-6 flex items-start gap-3 rounded-[var(--radius-inner)] border border-warn/30 bg-warn-wash px-4 py-3">
      <svg width="17" height="17" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.7" className="mt-px shrink-0 text-warn" strokeLinecap="round">
        <path d="M10 3.2 2.8 16h14.4L10 3.2ZM10 8.2v3.4M10 13.9h.01" />
      </svg>
      <p className="text-[0.8125rem] leading-relaxed text-ink-soft">
        <span className="font-bold text-ink">Example content.</span> These
        listings are placeholders so the interface can be reviewed before the
        database is connected. They are not real people and not real trades.
      </p>
    </div>
  );
}

/**
 * Listing slots.
 *
 * Three listings per rolling three-hour window (§6). With no account connected
 * yet this shows the true state of a new account — all three available — rather
 * than inventing usage.
 */
function SlotMeter() {
  const used = 0;
  const total = 3;
  const left = total - used;

  return (
    <div className="glass rounded-[var(--radius-panel)] p-5 sm:p-6">
      <div className="flex items-start justify-between gap-3">
        <p className="label">Listing slots</p>
        <span className="font-mono text-[0.625rem] tracking-[0.08em] text-ink-faint">3H WINDOW</span>
      </div>

      <div className="mt-4 flex items-baseline gap-2">
        <span className="numeral text-[2.75rem] leading-none text-ink">{left}</span>
        <span className="text-[0.875rem] font-semibold text-ink-mute">of {total} available</span>
      </div>

      <div className="mt-5 flex gap-1.5" aria-hidden="true">
        {Array.from({ length: total }, (_, i) => (
          <span
            key={i}
            className={`h-1.5 flex-1 rounded-full ${i < left ? "bg-mint-vivid" : "bg-line"}`}
          />
        ))}
      </div>

      <p className="mt-4 text-[0.8125rem] leading-relaxed text-ink-mute">
        Slots free up three hours after each listing is posted. Listings expire
        on their own after seven days.
      </p>
    </div>
  );
}

/** Inventory drives matching, so its empty state has to ask for something. */
function InventoryPrompt({ game }: { game: Game }) {
  return (
    <div className="glass-quiet rounded-[var(--radius-panel)] p-5 sm:p-6">
      <p className="label">Your {game.shortName} lists</p>
      <p className="mt-3 text-[0.9375rem] font-semibold leading-snug text-ink">
        Nothing declared yet.
      </p>
      <p className="mt-2 text-[0.8125rem] leading-relaxed text-ink-mute">
        Matching runs on what you have and what you want. Add a few of each and
        this dashboard starts working for you.
      </p>
      <Link
        href={`/app/${game.slug}/inventory`}
        className="pill pill-ghost mt-5 w-full justify-center py-2.5"
      >
        Add items
      </Link>
    </div>
  );
}

/* ------------------------------------------------------------------ */

function MatchCard({ listing }: { listing: DemoListing }) {
  const reciprocal = listing.reason === "RECIPROCAL_MATCH";

  return (
    <article className="glass rounded-[var(--radius-panel)] p-5">
      <div className="flex flex-wrap items-center gap-2">
        {listing.reason && (
          <span
            className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 font-mono text-[0.625rem] font-medium tracking-[0.06em] ${
              reciprocal
                ? "border border-mint/30 bg-mint-wash text-mint"
                : "border border-line bg-fill text-ink-mute"
            }`}
          >
            {reciprocal && <span className="h-1 w-1 rounded-full bg-mint" />}
            {reciprocal ? "POTENTIAL MATCH" : "SEEMS RELEVANT"}
          </span>
        )}
        <span className="rounded-full border border-warn/30 bg-warn-wash px-2 py-1 font-mono text-[0.5625rem] font-medium tracking-[0.09em] text-warn">
          DEMO
        </span>
        <span className="ml-auto font-mono text-[0.6875rem] text-ink-faint">
          {listing.postedHoursAgo}h ago
        </span>
      </div>

      <div className="mt-4 grid gap-3 sm:grid-cols-2">
        <div>
          <p className="text-[0.6875rem] font-semibold uppercase tracking-[0.08em] text-mint">Offering</p>
          <ul className="mt-1.5 space-y-1">
            {listing.offering.map((o) => (
              <li key={o} className="text-[0.9375rem] font-semibold leading-snug text-ink">{o}</li>
            ))}
          </ul>
        </div>
        <div>
          <p className="text-[0.6875rem] font-semibold uppercase tracking-[0.08em] text-ink-mute">Looking for</p>
          <ul className="mt-1.5 space-y-1">
            {listing.wanting.map((w) => (
              <li key={w} className="text-[0.9375rem] font-semibold leading-snug text-ink-soft">{w}</li>
            ))}
          </ul>
        </div>
      </div>

      {listing.note && (
        <p className="mt-4 text-[0.8125rem] leading-relaxed text-ink-mute">&ldquo;{listing.note}&rdquo;</p>
      )}

      <div className="mt-5 flex items-center justify-between gap-3 border-t border-line-soft pt-4">
        <p className="min-w-0 text-[0.75rem] leading-snug text-ink-faint">
          {listing.reason ? REASON_COPY[listing.reason] : "Recently posted"}
        </p>
        <button type="button" className="pill pill-ghost shrink-0 py-2 text-[0.8125rem]">
          Message
        </button>
      </div>
    </article>
  );
}

/** What the dashboard looks like before anyone has posted anything (§46). */
function NoMatchesYet({ game }: { game: Game }) {
  return (
    <div className="glass-quiet flex flex-col items-center rounded-[var(--radius-panel)] px-6 py-16 text-center">
      <span className="grid h-12 w-12 place-items-center rounded-full border border-line bg-fill text-ink-faint">
        <svg width="21" height="21" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round">
          <circle cx="9" cy="9" r="6.5" />
          <path d="M17.5 17.5 13.7 13.7" />
        </svg>
      </span>
      <p className="mt-5 text-[1.0625rem] font-bold tracking-[-0.02em] text-ink">
        No matches in {game.shortName} yet
      </p>
      <p className="measure mt-2 text-[0.875rem] leading-relaxed text-ink-mute">
        Nothing here is invented to fill the space. Once players start posting,
        anything that lines up with your lists shows up here with the reason it
        matched.
      </p>
      <Link href={`/app/${game.slug}/inventory`} className="pill pill-mint mt-7 py-2.5">
        Add what you have
      </Link>
    </div>
  );
}

/* ------------------------------------------------------------------ */

function ExploreGrid({ game }: { game: Game }) {
  const blurbs: Record<string, string> = {
    trades: "Browse everything on offer, filtered the way this game trades.",
    inventory: "What you have and what you want, with optional proof.",
    activities: game.activityKinds.slice(0, 3).join(", ") + " and more.",
    help: "Ask for a hand, or offer one to somebody else.",
    services: "Structured offers, kept separate from ordinary trades.",
  };

  return (
    <section className="mt-10">
      <div className="mb-4 flex items-center justify-between gap-4">
        <h2 className="text-[1.0625rem] font-bold tracking-[-0.025em] text-ink">
          Explore {game.shortName}
        </h2>
        <span className="label">{game.modules.length} areas</span>
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        {game.modules.map((m) => (
          <Link
            key={m}
            href={`/app/${game.slug}/${m === "activities" || m === "help" || m === "services" ? "explore" : m}`}
            className="glass-quiet group flex items-center gap-4 rounded-[var(--radius-inner)] p-5 transition-colors hover:border-line"
          >
            <span className="min-w-0 flex-1">
              <span className="block text-[0.9375rem] font-bold tracking-[-0.02em] text-ink">
                {MODULE_LABELS[m]}
              </span>
              <span className="mt-1 block text-[0.8125rem] leading-relaxed text-ink-mute">
                {blurbs[m]}
              </span>
            </span>
            <svg width="15" height="15" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.8" className="shrink-0 text-ink-faint transition-transform duration-200 group-hover:translate-x-0.5" strokeLinecap="round" strokeLinejoin="round">
              <path d="M6 3.5 10.5 8 6 12.5" />
            </svg>
          </Link>
        ))}
      </div>
    </section>
  );
}

/* ------------------------------------------------------------------ */

export default async function GameDashboard({
  params,
}: {
  params: Promise<{ game: string }>;
}) {
  const game = getGame((await params).game);
  if (!game) notFound();

  const listings = demoListings(game.slug);

  return (
    <div className="mx-auto max-w-6xl px-4 pt-8 sm:px-8 sm:pt-12">
      <TopBar game={game} />
      <DemoBanner />

      <div className="grid gap-4 lg:grid-cols-[21rem_minmax(0,1fr)] lg:items-start lg:gap-5">
        {/* ---- context column ---- */}
        <div className="flex flex-col gap-4 lg:sticky lg:top-8">
          <GameSwitcher current={game} />
          <SlotMeter />
          <InventoryPrompt game={game} />
        </div>

        {/* ---- main column ---- */}
        <div className="min-w-0">
          <div className="mb-4 flex items-center justify-between gap-4">
            <div>
              <h2 className="text-[1.0625rem] font-bold tracking-[-0.025em] text-ink">
                Recommended for you
              </h2>
              <p className="mt-0.5 text-[0.8125rem] text-ink-mute">
                Ranked by how well each one fits your lists
              </p>
            </div>
            <span className="glass-quiet hidden shrink-0 items-center gap-1.5 rounded-full px-3 py-2 font-mono text-[0.625rem] tracking-[0.07em] text-ink-mute sm:inline-flex">
              RELEVANCE
              <svg width="11" height="11" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M4 6.5 8 10.5l4-4" />
              </svg>
            </span>
          </div>

          {listings.length > 0 ? (
            <div className="grid gap-3">
              {listings.map((l) => (
                <MatchCard key={l.id} listing={l} />
              ))}
            </div>
          ) : (
            <NoMatchesYet game={game} />
          )}

          <ExploreGrid game={game} />
        </div>
      </div>
    </div>
  );
}
