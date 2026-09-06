import Link from "next/link";
import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { GAMES, getGame, type ExploreTab, type Game, type Want } from "@/lib/games";
import { catalogFor } from "@/lib/items";
import { ExploreCatalog } from "@/components/ExploreCatalog";
import { SafetyNotice } from "@/components/SafetyNotice";
import { GameArt } from "@/components/GameArt";
import { DEMO_ENABLED, demoListings } from "@/lib/demo";
import { getBoard } from "@/lib/data/board";
import { touchPresence } from "@/lib/actions/board";
import { TradeListingCard } from "@/components/TradeListingCard";
import { ServiceListingCard } from "@/components/ServiceListingCard";
import { PostListingButtons } from "@/components/PostListingButtons";
import { servicesFor, PARTIAL_SERVICES, listingState } from "@/lib/sessions";
import { currentProfile } from "@/lib/supabase/server";

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
    <div className="mt-6">
      <nav
        aria-label="Explore sections"
        className="no-scrollbar glass-quiet flex gap-1 overflow-x-auto rounded-full p-1"
      >
        {game.exploreTabs.map((tab) => {
          const on = tab.id === active.id;
          return (
            <Link
              key={tab.id}
              href={`/app/${game.slug}/explore?tab=${tab.id}`}
              aria-current={on ? "page" : undefined}
              scroll={false}
              className={`shrink-0 whitespace-nowrap rounded-full px-4 py-2.5 text-center text-[0.875rem] font-bold tracking-[-0.015em] transition-colors duration-150 sm:flex-1 ${
                on
                  ? "bg-ink text-white shadow-[0_6px_18px_-8px_rgba(13,22,19,0.5)]"
                  : "text-ink-mute hover:bg-fill hover:text-ink"
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
  // Reading the board is also when we mark the reader present, which is what
  // the green dots elsewhere are reading.
  const [serviceListings] = await Promise.all([
    getBoard(game.slug),
    touchPresence(),
  ]);
  const services = servicesFor(game.slug);
  const recruitTemplates = servicesFor(game.slug, "recruit");

  // One board, split by which template each post was built from. Splitting here
  // rather than in two queries keeps the two tabs reading the same rows, so a
  // post can never be live on one board and missing from the other.
  const recruitIds = new Set(recruitTemplates.map((t) => t.id));
  const isRecruit = (l: { serviceIds: readonly string[] }) =>
    l.serviceIds.some((id) => recruitIds.has(id));
  const recruitListings = serviceListings.filter(isRecruit);
  const helpListings = serviceListings.filter((l) => !isRecruit(l));
  // A listing reads differently to the player who posted it, so the card
  // needs to know which of the two it is drawing.
  const profile = await currentProfile();
  const items = catalogFor(game.slug);

  // Requests are generated from the registry's own wants, so the sections stay
  // consistent with what the homepage promises rather than inventing more.
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
              <div className="grid gap-2 md:grid-cols-2">
                {listings.map((l) => (
                  <TradeListingCard
                    key={l.id}
                    listing={l}
                    viewerUsername={profile?.username ?? undefined}
                  />
                ))}
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
            <ExploreCatalog items={items} gameSlug={game.slug} />
          </section>
        </div>
      )}

      {/* ---------- SERVICES ---------- */}
      {active.kind === "services" && (
        <div className="mt-7 grid gap-8">
          <section>
            <div className="mb-1 flex flex-wrap items-center justify-between gap-3">
              <h2 className="text-[1.0625rem] font-bold tracking-[-0.025em] text-ink">
                Live right now
              </h2>
              <PostListingButtons gameSlug={game.slug} gameName={game.shortName} />
            </div>
            <p className="mb-4 max-w-[62ch] text-[0.875rem] leading-relaxed text-ink-mute">
              Posts stay up for two hours, or until the deal is taken.
            </p>

            {helpListings.length > 0 ? (
              <div className="grid gap-2 md:grid-cols-2">
                {helpListings
                  .slice()
                  .sort((a, b) => {
                    // Live first, then whoever is online, then most voted.
                    const live = Number(listingState(b) === "live") - Number(listingState(a) === "live");
                    if (live !== 0) return live;
                    const on = Number(b.authorOnline) - Number(a.authorOnline);
                    if (on !== 0) return on;
                    return b.voters.length - a.voters.length;
                  })
                  .map((l) => <ServiceListingCard key={l.id} listing={l} />)}
              </div>
            ) : (
              <EmptyPanel
                title="Nothing live right now"
                body="When somebody offers help or gets stuck, their post appears here for two hours."
              />
            )}
          </section>

          {services.length > 0 && (
            <section>
              <h2 className="mb-1 text-[1.0625rem] font-bold tracking-[-0.025em] text-ink">
                What you can get help with
              </h2>
              <p className="mb-4 max-w-[62ch] text-[0.875rem] leading-relaxed text-ink-mute">
                Posts are built from this list rather than typed out, so the
                requirements come from the game rather than from whoever posted.
                {PARTIAL_SERVICES.includes(game.slug) &&
                  " This list is still short for this game."}
              </p>
              <ul className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
                {services.map((sv) => (
                  <li key={sv.id} className="glass-quiet rounded-[var(--radius-inner)] p-3">
                    <p className="text-[0.875rem] font-bold tracking-[-0.015em] text-ink">
                      {sv.name}
                    </p>
                    <p className="mt-0.5 font-mono text-[0.5625rem] tracking-[0.08em] text-ink-faint">
                      {sv.kind.toUpperCase()}
                      {sv.players ? ` · ${sv.players} PLAYERS` : ""}
                    </p>
                    {sv.needs && (
                      <p className="mt-1.5 text-[0.75rem] leading-relaxed text-ink-mute">
                        {sv.needs}
                      </p>
                    )}
                  </li>
                ))}
              </ul>
            </section>
          )}
        </div>
      )}

      {/* ---------- COMMUNITY / RECRUITMENT ---------- */}
      {active.kind === "community" && (
        <div className="mt-7 grid gap-8">
          <section>
            <div className="mb-1 flex flex-wrap items-center justify-between gap-3">
              <h2 className="text-[1.0625rem] font-bold tracking-[-0.025em] text-ink">
                Crews forming now
              </h2>
              <PostListingButtons gameSlug={game.slug} gameName={game.shortName}
                                  section="recruit" />
            </div>
            <p className="mb-4 max-w-[62ch] text-[0.875rem] leading-relaxed text-ink-mute">
              Forty minutes, then the post is gone. A crew call still up after an
              hour is a lie that wastes the time of everybody who answers it —
              so these run on a much shorter clock than the services board.
            </p>

            {recruitListings.length > 0 ? (
              <div className="grid gap-2 md:grid-cols-2">
                {recruitListings
                  .slice()
                  .sort((a, b) => {
                    const live = Number(listingState(b) === "live") - Number(listingState(a) === "live");
                    if (live !== 0) return live;
                    const on = Number(b.authorOnline) - Number(a.authorOnline);
                    if (on !== 0) return on;
                    // Then the crew closest to being full, because that is the
                    // one a person joining can actually get playing tonight.
                    return b.voters.length - a.voters.length;
                  })
                  .map((l) => <ServiceListingCard key={l.id} listing={l} />)}
              </div>
            ) : (
              <EmptyPanel
                title="No crews forming"
                body="When somebody needs a team for a raid, a sea event or an island hunt, it appears here for forty minutes."
              />
            )}
          </section>

          {recruitTemplates.length > 0 && (
            <section>
              <h2 className="mb-1 text-[1.0625rem] font-bold tracking-[-0.025em] text-ink">
                What needs a team
              </h2>
              <p className="mb-4 max-w-[62ch] text-[0.875rem] leading-relaxed text-ink-mute">
                Everything here takes three or more. Not because it is hard —
                because the game will not start it with fewer.
              </p>
              <ul className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
                {recruitTemplates.map((sv) => (
                  <li key={sv.id} className="glass-quiet rounded-[var(--radius-inner)] p-3">
                    <p className="text-[0.875rem] font-bold tracking-[-0.015em] text-ink">
                      {sv.name}
                    </p>
                    <p className="mt-0.5 font-mono text-[0.5625rem] tracking-[0.08em] text-ink-faint">
                      {sv.kind.toUpperCase()}
                      {sv.players ? ` · ${sv.players} PLAYERS` : ""}
                    </p>
                    {sv.needs && (
                      <p className="mt-1.5 text-[0.75rem] leading-relaxed text-ink-mute">
                        {sv.needs}
                      </p>
                    )}
                  </li>
                ))}
              </ul>
            </section>
          )}

          {communityWants.length > 0 && (
            <section>
              <h2 className="mb-4 text-[1.0625rem] font-bold tracking-[-0.025em] text-ink">
                Asking for help
              </h2>
              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                {communityWants.map((w) => <RequestCard key={w.label} want={w} game={game} />)}
              </div>
            </section>
          )}
        </div>
      )}
    </div>
  );
}
