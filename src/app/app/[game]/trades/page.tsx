import Link from "next/link";
import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { GAMES, getGame as registryGame } from "@/lib/games";
import { getGame, getCatalog } from "@/lib/data/games";
import { readInventory } from "@/lib/actions/inventory";
import { readAllowance, readMyListings, readSuggestions } from "@/lib/data/trades";
import { currentProfile } from "@/lib/supabase/server";
import { touchPresence } from "@/lib/actions/board";
import { GameSwitcher } from "@/components/GameSwitcher";
import { InventoryEditor } from "@/components/InventoryEditor";
import { SuggestionCard } from "@/components/SuggestionCard";
import { PostTradeListing } from "@/components/PostTradeListing";
import { MyTradeListings } from "@/components/MyTradeListings";

/**
 * Trading, in one screen with two halves.
 *
 * Inventory is what you declare; Suggested is what that declaration is worth.
 * They are subtabs of one screen rather than two places in the rail because
 * they are a loop — you read a suggestion, notice you never added the thing it
 * is asking for, add it, and come straight back. Splitting them across the rail
 * would put a navigation between the two halves of a single thought.
 *
 * The tab is in the URL rather than in component state so the back button works
 * the way a player expects, a link can point at either half, and both render on
 * the server with no hydration step before the content is readable.
 */

export function generateStaticParams() {
  return GAMES.map((g) => ({ game: g.slug }));
}

export async function generateMetadata({
  params,
}: { params: Promise<{ game: string }> }): Promise<Metadata> {
  const game = await getGame((await params).game);
  return { title: game ? `${game.shortName} trades` : "Trades" };
}

type Tab = "suggested" | "inventory";

export default async function TradesPage({
  params,
  searchParams,
}: {
  params: Promise<{ game: string }>;
  searchParams: Promise<{ tab?: string }>;
}) {
  const slug = (await params).game;
  const game = await getGame(slug);
  if (!game) notFound();

  const tab: Tab = (await searchParams).tab === "inventory" ? "inventory" : "suggested";
  const profile = await currentProfile();

  if (!profile) {
    return (
      <Shell slug={slug} tab={tab}>
        <SignedOut slug={slug} tab={tab} />
      </Shell>
    );
  }

  await touchPresence();

  return (
    <Shell slug={slug} tab={tab}>
      {tab === "inventory" ? (
        <InventoryTab slug={slug} shortName={game.shortName} />
      ) : (
        <SuggestedTab slug={slug} shortName={game.shortName} me={profile.username} />
      )}
    </Shell>
  );
}

/* ------------------------------------------------------------------ */

function Shell({
  slug, tab, children,
}: {
  slug: string;
  tab: Tab;
  children: React.ReactNode;
}) {
  // The registry row, not the database one, because the switcher lists every
  // game from the registry and the current one has to be the same object shape
  // as its neighbours in that list.
  const game = registryGame(slug)!;

  return (
    <div className="mx-auto max-w-5xl px-4 pt-8 sm:px-8 sm:pt-12">
      {/* The heading is the game picker. Somebody editing their Blox Fruits
          lists who wants their PS99 lists is not navigating away — they are
          changing which lists they are looking at — so the switch happens here
          and lands on the same subtab rather than bouncing via the dashboard. */}
      <div className="mb-6">
        <GameSwitcher
          current={game}
          variant="bar"
          label="Trades"
          suffix={`/trades?tab=${tab}`}
        />
      </div>

      <SubTabs slug={slug} tab={tab} />
      {children}
    </div>
  );
}

/** Two pills, the way every trading game does it. Links, so no JavaScript. */
function SubTabs({ slug, tab }: { slug: string; tab: Tab }) {
  const tabs: { id: Tab; label: string }[] = [
    { id: "suggested", label: "Suggested trades" },
    { id: "inventory", label: "Inventory" },
  ];
  return (
    <nav aria-label="Trades sections" className="mb-6 flex gap-1.5">
      {tabs.map((t) => (
        <Link
          key={t.id}
          href={`/app/${slug}/trades?tab=${t.id}`}
          aria-current={tab === t.id ? "page" : undefined}
          scroll={false}
          className={`rounded-full border px-4 py-2 text-[0.875rem] font-semibold transition-colors ${
            tab === t.id
              ? "border-mint bg-mint/10 text-mint"
              : "border-line bg-surface text-ink-soft hover:border-mint"
          }`}
        >
          {t.label}
        </Link>
      ))}
    </nav>
  );
}

/* ------------------------------------------------------------------ */

async function InventoryTab({ slug, shortName }: { slug: string; shortName: string }) {
  const [catalog, inventory, allowance, mine] = await Promise.all([
    getCatalog(slug),
    readInventory(slug),
    readAllowance(slug),
    readMyListings(slug),
  ]);

  return (
    <div>
      <p className="measure mb-6 text-[0.9375rem] leading-relaxed text-ink-soft">
        Matching runs on these two lists. When somebody offers what you want and
        wants what you have, that is a reciprocal match — and it is ranked above
        everything else.
      </p>

      <InventoryEditor
        gameSlug={slug}
        gameName={shortName}
        // Inventory feeds matching, and matching leads to a trade, so a row the
        // game will not let players swap has no business being in here.
        catalog={catalog.filter((i) => i.tradeable !== false)}
        initial={inventory}
      />

      <div className="mt-4 grid gap-4 lg:grid-cols-2">
        <PostTradeListing
          gameSlug={slug}
          inventory={inventory}
          remaining={allowance?.remaining ?? 0}
          nextSlotAt={allowance?.nextSlotAt ?? null}
        />
        <MyTradeListings gameSlug={slug} listings={mine} />
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */

async function SuggestedTab({
  slug, shortName, me,
}: {
  slug: string;
  shortName: string;
  me: string;
}) {
  const { trades, haveCount, wantCount } = await readSuggestions(slug);

  if (haveCount === 0 && wantCount === 0) {
    return (
      <Empty
        title="Nothing to match on yet"
        body={`Suggestions come out of your lists. Add a few things you have and a few you are after, and anything on the ${shortName} board that lines up shows up here with the reason it matched.`}
        cta={{ href: `/app/${slug}/trades?tab=inventory`, label: "Build your lists" }}
      />
    );
  }

  if (trades.length === 0) {
    return (
      <Empty
        title={`Nothing on the ${shortName} board fits yet`}
        body="Nothing here is invented to fill the space. Your lists are in — as soon as somebody posts a listing that lines up with them, it appears here, ranked by how well it fits and what it is worth to you."
        cta={{ href: `/app/${slug}/trades?tab=inventory`, label: "Add more to your lists" }}
      />
    );
  }

  return (
    <div>
      <div className="mb-4 flex items-baseline justify-between gap-4">
        <p className="text-[0.8125rem] text-ink-mute">
          {trades.length} {trades.length === 1 ? "trade" : "trades"} that fit your
          lists, best first.
        </p>
        <Link
          href={`/app/${slug}/trades?tab=inventory`}
          className="shrink-0 text-[0.8125rem] font-semibold text-mint hover:underline"
        >
          Edit lists
        </Link>
      </div>

      <div className="grid gap-3 xl:grid-cols-2">
        {trades.map((s) => (
          <SuggestionCard key={s.listing.id} suggestion={s} gameSlug={slug} />
        ))}
      </div>

      <p className="mt-6 text-[0.75rem] leading-relaxed text-ink-faint">
        Ranked on what you would give against what you would get, using the
        published values — never on who paid for placement. Open any card to see
        every point that moved it. Signed in as {me}.
      </p>
    </div>
  );
}

/* ------------------------------------------------------------------ */

function Empty({
  title, body, cta,
}: {
  title: string;
  body: string;
  cta: { href: string; label: string };
}) {
  return (
    <div className="glass-quiet flex flex-col items-center rounded-[var(--radius-panel)] px-6 py-16 text-center">
      <span className="grid h-12 w-12 place-items-center rounded-full border border-line bg-fill text-ink-faint">
        <svg width="21" height="21" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round">
          <path d="M3 6.5h11M11.5 4 14 6.5 11.5 9M17 13.5H6M8.5 11 6 13.5 8.5 16" />
        </svg>
      </span>
      <p className="mt-5 text-[1.0625rem] font-bold tracking-[-0.02em] text-ink">{title}</p>
      <p className="measure mt-2 text-[0.875rem] leading-relaxed text-ink-mute">{body}</p>
      <Link href={cta.href} className="pill pill-mint mt-7 py-2.5">
        {cta.label}
      </Link>
    </div>
  );
}

function SignedOut({ slug, tab }: { slug: string; tab: Tab }) {
  return (
    <div className="glass-quiet rounded-[var(--radius-panel)] px-6 py-14 text-center">
      <p className="text-[1.0625rem] font-bold tracking-[-0.02em] text-ink">
        Sign in to trade
      </p>
      <p className="measure mx-auto mt-2 text-[0.875rem] leading-relaxed text-ink-mute">
        Your lists are private — nobody else can read them. They exist so
        MintPlaza can find the people whose lists point back at yours.
      </p>
      <Link href={`/login?next=/app/${slug}/trades?tab=${tab}`} className="pill pill-mint mt-7 py-2.5">
        Sign in
      </Link>
    </div>
  );
}
