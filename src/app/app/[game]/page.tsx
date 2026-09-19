import { notFound } from "next/navigation";
import Link from "next/link";
import type { Metadata } from "next";
import { GAMES, getGame, type Game } from "@/lib/games";
import { GameSwitcher } from "@/components/GameSwitcher";
import { SettingsButton } from "@/components/SettingsButton";
import type { SettingsProfile } from "@/components/SettingsSheet";
import { DEMO_ENABLED, demoListings } from "@/lib/demo";
import { TradeListingCard } from "@/components/TradeListingCard";
import { SuggestionCard } from "@/components/SuggestionCard";
import { ValuesCard } from "@/components/ValuesCard";
import { LevelUpCard } from "@/components/LevelUpCard";
import { readLevelUp } from "@/lib/data/level-up";
import type { LevelUpStatus } from "@/lib/level-up";
import { currentProfile } from "@/lib/supabase/server";
import { readProfile } from "@/lib/data/profile";
import { readAllowance, readSuggestions } from "@/lib/data/trades";
import { PROOFS_WANTED, proofsFor } from "@/lib/profile";
import {
  FREE_LISTING_HOURS, LEVEL_UP_LISTING_DAYS, LISTING_WINDOW_HOURS,
} from "@/lib/level-up";

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

function TopBar({
  game, settings, levelUp,
}: {
  game: Game;
  settings: SettingsProfile | null;
  levelUp: LevelUpStatus;
}) {
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
        <SettingsButton profile={settings} levelUp={levelUp} />
      </div>
    </div>
  );
}

/**
 * Honest about example content, every time it is on screen (§53).
 *
 * Conditioned on examples actually being rendered, not merely on demo mode
 * being switched on. Now that real suggestions take the panel whenever there
 * are any, a banner tied to the flag alone would sit above genuine listings
 * calling them placeholders — which is the same failure as the reverse, told
 * backwards.
 */
function DemoBanner({ showing }: { showing: boolean }) {
  if (!DEMO_ENABLED || !showing) return null;
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
 * Three listings per rolling three-hour window (§6), read from
 * listing_allowance() rather than assumed. It used to be a hardcoded zero, so
 * it told every player all three slots were free however many they had just
 * used — the one number on this screen somebody would plan around, and it was
 * never true. Signed out there is no allowance to read, and it shows the state
 * of a new account, which is what a signed-out visitor would get.
 */
function SlotMeter({ used, total, nextSlotAt }: {
  used: number;
  total: number;
  nextSlotAt: string | null;
}) {
  const left = Math.max(0, total - used);

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
        {left === 0 && nextSlotAt
          ? `All ${total} are in use. The next frees up ${relative(nextSlotAt)}.`
          : `Slots free up ${LISTING_WINDOW_HOURS} hours after each listing is posted. `
            + `Listings expire on their own after ${FREE_LISTING_HOURS} hours, `
            + `or ${LEVEL_UP_LISTING_DAYS} days with Level Up.`}
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
        href={`/app/${game.slug}/trades?tab=inventory`}
        className="pill pill-ghost mt-5 w-full justify-center py-2.5"
      >
        Add items
      </Link>
    </div>
  );
}

/**
 * The one nudge the dashboard makes.
 *
 * It asks for proof pictures rather than for a bio or a tag, because this is
 * the only thing on a profile that changes whether a stranger picks you. It
 * counts down — "1 more" reads as nearly done, "post some pictures" reads as a
 * chore — and it disappears for good at three rather than nagging on for six.
 *
 * Shown only to somebody signed in, and only for the game they are looking at,
 * since that is the account the screenshot has to be of.
 */
function ProofPrompt({ game, count }: { game: Game; count: number }) {
  const left = PROOFS_WANTED - count;
  return (
    <div className="glass-quiet rounded-[var(--radius-panel)] p-5 sm:p-6">
      <p className="label">Your profile</p>
      <p className="mt-3 text-[0.9375rem] font-semibold leading-snug text-ink">
        {count === 0
          ? `Show your ${game.shortName} account`
          : `${left} more ${left === 1 ? "picture" : "pictures"} to go`}
      </p>
      <p className="mt-2 text-[0.8125rem] leading-relaxed text-ink-mute">
        {count === 0
          ? `Post ${PROOFS_WANTED} screenshots of your in-game profile. Nobody has to take your word for who you are, and people pick the players they can see.`
          : `You have posted ${count}. Three of the same account is the point where it starts being worth reading.`}
      </p>
      <Link
        href={`/app/${game.slug}/profile`}
        className="pill pill-ghost mt-5 w-full justify-center py-2.5"
      >
        {count === 0 ? "Add pictures" : "Add another"}
      </Link>
    </div>
  );
}

/* ------------------------------------------------------------------ */

/** What the dashboard looks like before anyone has posted anything (§46). */
function NoMatchesYet({ game, hasLists }: { game: Game; hasLists: boolean }) {
  return (
    <div className="glass-quiet flex flex-col items-center rounded-[var(--radius-panel)] px-6 py-16 text-center">
      <span className="grid h-12 w-12 place-items-center rounded-full border border-line bg-fill text-ink-faint">
        <svg width="21" height="21" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round">
          <circle cx="9" cy="9" r="6.5" />
          <path d="M17.5 17.5 13.7 13.7" />
        </svg>
      </span>
      <p className="mt-5 text-[1.0625rem] font-bold tracking-[-0.02em] text-ink">
        {hasLists
          ? `Nothing on the ${game.shortName} board fits yet`
          : `No matches in ${game.shortName} yet`}
      </p>
      <p className="measure mt-2 text-[0.875rem] leading-relaxed text-ink-mute">
        {hasLists
          ? "Nothing here is invented to fill the space. Your lists are in — as soon as somebody posts something that lines up with them, it appears here with the reason it matched."
          : "Matching runs on what you have and what you want. Add a few of each and anything that lines up shows up here with the reason it matched."}
      </p>
      <Link href={`/app/${game.slug}/trades?tab=inventory`} className="pill pill-mint mt-7 py-2.5">
        {hasLists ? "Add more to your lists" : "Add what you have"}
      </Link>
    </div>
  );
}

/* ------------------------------------------------------------------ */

/**
 * The Explore card.
 *
 * One entry point whose description changes with the game — Blox Fruits
 * advertises raid help and Leviathan hunts, Garden advertises weather pings
 * and server help. Same card, same place, different promise, all read from the
 * registry rather than written per game.
 */
function ExploreCard({ game }: { game: Game }) {
  return (
    <Link
      href={`/app/${game.slug}/explore`}
      className="glass-lift group relative block overflow-hidden rounded-[var(--radius-panel)] p-6 transition-transform duration-200 ease-[var(--ease-out-soft)] hover:-translate-y-px sm:p-7"
    >
      <span
        aria-hidden="true"
        className="pointer-events-none absolute inset-0"
        style={{ background: `radial-gradient(26rem 14rem at 92% -30%, ${game.hue}1F, transparent 70%)` }}
      />

      <span className="relative flex items-start justify-between gap-4">
        <span className="min-w-0">
          <span className="label block">Explore</span>
          <span className="mt-1.5 block text-[1.375rem] font-extrabold tracking-[-0.035em] text-ink">
            {game.shortName}
          </span>
        </span>
        <span className="grid h-10 w-10 shrink-0 place-items-center rounded-full border border-line bg-fill text-ink-soft transition-all duration-200 group-hover:border-mint group-hover:text-mint">
          <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round">
            <path d="M6 3.5 10.5 8 6 12.5" />
          </svg>
        </span>
      </span>

      <span className="relative mt-4 flex flex-wrap gap-1.5">
        {game.exploreHighlights.map((h) => (
          <span
            key={h}
            className="rounded-full border border-line bg-surface px-2.5 py-1 text-[0.75rem] font-semibold text-ink-soft"
          >
            {h}
          </span>
        ))}
        <span className="rounded-full px-1.5 py-1 text-[0.75rem] font-semibold text-ink-faint">
          and more
        </span>
      </span>

      <span className="relative mt-4 block text-[0.8125rem] leading-relaxed text-ink-mute">
        {game.exploreTabs.map((t) => t.label).join(" · ")}
      </span>
    </Link>
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

  // A listing reads differently to the player who posted it, so the card
  // needs to know which of the two it is drawing.
  const profile = await currentProfile();

  // Real suggestions first. The examples are a review aid for a site with no
  // database attached — they are off in production by construction — so they
  // fill the panel only when there is genuinely nothing real to put in it.
  const [{ trades, haveCount, wantCount }, allowance, levelUp] = await Promise.all([
    readSuggestions(game.slug, 8),
    readAllowance(game.slug),
    readLevelUp(),
  ]);
  const examples = trades.length === 0 ? demoListings(game.slug) : [];
  const hasLists = haveCount > 0 || wantCount > 0;

  // Only the fields the panel actually renders cross into the client. A profile
  // row carries more than the settings screen needs, and sending the whole
  // thing would put it in the page source for no reason.
  // Read once for the nudge below. Only for somebody signed in — there is no
  // point asking a signed-out visitor to prove an account they have not linked.
  const me = profile ? await readProfile(profile.username) : null;
  const proofCount = me ? proofsFor(me, game.slug).length : 0;

  const settings: SettingsProfile | null = profile
    ? {
        username: profile.username,
        displayName: profile.display_name ?? null,
        avatarUrl: profile.avatar_url ?? null,
        robloxUserId: profile.roblox_user_id,
        hidePresence: profile.hide_presence ?? false,
      }
    : null;

  return (
    <div className="mx-auto max-w-6xl px-4 pt-8 sm:px-8 sm:pt-12">
      <TopBar game={game} settings={settings} levelUp={levelUp} />
      <DemoBanner showing={examples.length > 0} />

      <div className="grid gap-4 lg:grid-cols-[21rem_minmax(0,1fr)] lg:items-start lg:gap-5">
        {/* ---- context column ---- */}
        <div className="flex flex-col gap-4 lg:sticky lg:top-8">
          <GameSwitcher current={game} />
          <SlotMeter
            used={allowance?.used ?? 0}
            total={allowance ? allowance.used + allowance.remaining : 3}
            nextSlotAt={allowance?.nextSlotAt ?? null}
          />
          {me && proofCount < PROOFS_WANTED && (
            <ProofPrompt game={game} count={proofCount} />
          )}
          <InventoryPrompt game={game} />
          {/* Directly under the slot meter, which is the one place on the site
              where somebody is looking at a limit rather than being told about
              one. A player who has just seen "0 slots left" is the only person
              for whom this card is useful rather than noise. */}
          <LevelUpCard status={levelUp} compact />
          {/* Values live off-site, so the way to them has to be somewhere a
              player can find without being mid-trade first. The listing cards
              and the catalogue footer both carry the compact version; this is
              the one that explains why. */}
          <ValuesCard gameSlug={game.slug} />
        </div>

        {/* ---- main column ---- */}
        <div className="min-w-0">
          <div className="mb-4">
            <ExploreCard game={game} />
          </div>

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

          {trades.length > 0 ? (
            <div className="grid gap-3">
              {trades.map((s) => (
                <SuggestionCard key={s.listing.id} suggestion={s} gameSlug={game.slug} />
              ))}
            </div>
          ) : examples.length > 0 ? (
            // Rows, not cards. Eight fit on a phone; the second column on a
            // wide screen doubles that again.
            <div className="grid gap-2 xl:grid-cols-2">
              {examples.map((l) => (
                <TradeListingCard
                  key={l.id}
                  listing={l}
                  viewerUsername={profile?.username ?? undefined}
                />
              ))}
            </div>
          ) : (
            <NoMatchesYet game={game} hasLists={hasLists} />
          )}

          
        </div>
      </div>
    </div>
  );
}

/** "in about 2 hours" — only ever shown beside a slot count that is zero. */
function relative(iso: string): string {
  const mins = Math.round((new Date(iso).getTime() - Date.now()) / 60_000);
  if (mins <= 1) return "any moment";
  if (mins < 60) return `in ${mins} minutes`;
  const h = Math.round(mins / 60);
  return `in about ${h} ${h === 1 ? "hour" : "hours"}`;
}
