import Link from "next/link";
import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { GAMES, getGame, type ExploreTab, type Game, type Want } from "@/lib/games";
import { catalogFor } from "@/lib/items";
import { ExploreCatalog } from "@/components/ExploreCatalog";
import { SafetyNotice } from "@/components/SafetyNotice";
import { GameArt } from "@/components/GameArt";
import { DEMO_ENABLED, REASON_COPY, demoListings, type DemoListing } from "@/lib/demo";

export function generateStaticParams() {
  return GAMES.map((g) => ({ game: g.slug }));
}

export async function generateMetadata({
  params,
}: { params: Promise<{ game: string }> }): Promise<Metadata> {
  const game = getGame((await params).game);
  return { title: game ? `Explore ${game.shortName}` : "Explore" };
}

/* ------------------------------------------------------------------ */

function TabBar({ game, active }: { game: Game; active: ExploreTab }) {
  return (
    <div className="mt-6 border-b border-line">
      <nav aria-label="Explore sections" className="no-scrollbar -mb-px flex gap-1 overflow-x-auto">
        {game.exploreTabs.map((tab) => {
          const on = tab.id === active.id;
          return (
            <Link
              key={tab.id}
              href={`/app/${game.slug}/explore?tab=${tab.id}`}
              aria-current={on ? "page" : undefined}
              scroll={false}
              className={`shrink-0 whitespace-nowrap border-b-2 px-4 pb-3 pt-2 text-[0.9375rem] font-bold tracking-[-0.015em] transition-colors ${
                on
                  ? "border-mint text-ink"
                  : "border-transparent text-ink-mute hover:text-ink"
              }`}
            >
              {tab.label}
            </Link>
          );
        })}
      </nav>
    </div>
  );
}

/* ---- trade listings, shared shape with the dashboard ---- */

function ListingCard({ listing }: { listing: DemoListing }) {
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
        <button type="button" className="pill pill-ghost shrink-0 py-2 text-[0.8125rem]">Message</button>
      </div>
    </article>
  );
}

/* ---- request cards, generated from the registry's own wants ---- */

const KIND_LABEL: Record<Want["kind"], string> = {
  trade: "TRADE",
  group: "GROUP",
  help: "HELP",
  check: "VALUE CHECK",
};

function RequestCard({ want, game }: { want: Want; game: Game }) {
  return (
    <article className="glass flex flex-col rounded-[var(--radius-inner)] p-5">
      <div className="flex flex-wrap items-center gap-2">
        <span className="rounded-full border border-line bg-fill px-2.5 py-1 font-mono text-[0.5625rem] font-medium tracking-[0.09em] text-ink-mute">
          {KIND_LABEL[want.kind]}
        </span>
        {DEMO_ENABLED && (
          <span className="rounded-full border border-warn/30 bg-warn-wash px-2 py-1 font-mono text-[0.5625rem] font-medium tracking-[0.09em] text-warn">
            DEMO
          </span>
        )}
        <GameArt game={game} size={20} radius={6} />
      </div>

      <h3 className="mt-3 text-[1rem] font-bold leading-snug tracking-[-0.02em] text-ink">
        {want.label}
      </h3>
      {want.detail && (
        <p className="mt-1.5 text-[0.8125rem] leading-relaxed text-ink-mute">{want.detail}</p>
      )}

      <div className="mt-5 flex items-center justify-between gap-3 border-t border-line-soft pt-4">
        <span className="font-mono text-[0.625rem] tracking-[0.07em] text-ink-faint">OPEN</span>
        <button type="button" className="pill pill-ghost shrink-0 py-2 text-[0.8125rem]">Ask to join</button>
      </div>
    </article>
  );
}

function EmptyPanel({ title, body }: { title: string; body: string }) {
  return (
    <div className="glass-quiet rounded-[var(--radius-panel)] px-6 py-14 text-center">
      <p className="text-[1.0625rem] font-bold tracking-[-0.02em] text-ink">{title}</p>
      <p className="measure mx-auto mt-2 text-[0.875rem] leading-relaxed text-ink-mute">{body}</p>
    </div>
  );
}

/* ------------------------------------------------------------------ */

export default async function ExplorePage({
  params,
  searchParams,
}: {
  params: Promise<{ game: string }>;
  searchParams: Promise<{ tab?: string }>;
}) {
  const game = getGame((await params).game);
  if (!game) notFound();

  const requested = (await searchParams).tab;
  const active =
    game.exploreTabs.find((t) => t.id === requested) ?? game.exploreTabs[0];

  const listings = demoListings(game.slug);
  const items = catalogFor(game.slug);

  // Requests are generated from the registry's own wants, so the sections stay
  // consistent with what the homepage promises rather than inventing more.
  const serviceWants = game.wants.filter((w) => w.kind === "group");
  const communityWants = game.wants.filter((w) => w.kind === "help" || w.kind === "check");

  return (
    <div className="mx-auto max-w-6xl px-4 pt-8 sm:px-8 sm:pt-12">
      {/* The notice belongs to the services section only. */}
      {active.kind === "services" && <SafetyNotice />}

      <div className="flex items-center gap-4">
        <GameArt game={game} size={48} />
        <div className="min-w-0">
          <p className="label">Explore</p>
          <h1 className="mt-0.5 truncate text-[1.5rem] font-extrabold tracking-[-0.035em] text-ink">
            {game.name}
          </h1>
        </div>
      </div>

      <TabBar game={game} active={active} />

      <p className="mt-5 max-w-[62ch] text-[0.9375rem] leading-relaxed text-ink-soft">
        {active.blurb}
      </p>

      {/* ---------- TRADE & OFFERS ---------- */}
      {active.kind === "trades" && (
        <div className="mt-7 grid gap-8">
          <section>
            <h2 className="mb-3 text-[1.0625rem] font-bold tracking-[-0.025em] text-ink">
              Open listings
            </h2>
            {listings.length > 0 ? (
              <div className="grid gap-3 lg:grid-cols-2">
                {listings.map((l) => <ListingCard key={l.id} listing={l} />)}
              </div>
            ) : (
              <EmptyPanel
                title="No listings yet"
                body="Nothing is invented to fill this space. The first real listing for this game will appear here."
              />
            )}
          </section>

          <section>
            <h2 className="mb-1 text-[1.0625rem] font-bold tracking-[-0.025em] text-ink">
              Browse {game.shortName} items
            </h2>
            <p className="mb-4 max-w-[62ch] text-[0.875rem] leading-relaxed text-ink-mute">
              Listings are built from this catalogue rather than typed out, so
              the same item means the same thing to both sides of a trade.
            </p>
            <ExploreCatalog items={items} />
          </section>
        </div>
      )}

      {/* ---------- SERVICES ---------- */}
      {active.kind === "services" && (
        <div className="mt-7">
          <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
            <h2 className="text-[1.0625rem] font-bold tracking-[-0.025em] text-ink">Open requests</h2>
            <button type="button" className="pill pill-mint py-2.5">Post a request</button>
          </div>

          {serviceWants.length > 0 ? (
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {serviceWants.map((w) => <RequestCard key={w.label} want={w} game={game} />)}
            </div>
          ) : (
            <EmptyPanel
              title="Nothing open right now"
              body="When somebody needs players for this game, their request shows up here with what it actually requires."
            />
          )}
        </div>
      )}

      {/* ---------- COMMUNITY ---------- */}
      {active.kind === "community" && (
        <div className="mt-7">
          <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
            <h2 className="text-[1.0625rem] font-bold tracking-[-0.025em] text-ink">Asking for help</h2>
            <button type="button" className="pill pill-mint py-2.5">Ask for help</button>
          </div>

          {communityWants.length > 0 ? (
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {communityWants.map((w) => <RequestCard key={w.label} want={w} game={game} />)}
            </div>
          ) : (
            <EmptyPanel
              title="Nobody has asked yet"
              body="Requests for help, value checks and company appear here as players post them."
            />
          )}
        </div>
      )}
    </div>
  );
}
