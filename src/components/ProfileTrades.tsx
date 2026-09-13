import Link from "next/link";
import { ItemTile } from "./ItemTile";
import { SuggestionCard } from "./SuggestionCard";
import { RarityChip } from "./ItemTile";
import { findItem, type Rarity } from "@/lib/items";
import { readInventory } from "@/lib/actions/inventory";
import { holdingsOf, type InventoryRow } from "@/lib/inventory";
import { readListingsOf, readSuggestions } from "@/lib/data/trades";
import { suggestTrades, type BoardListing, type TradeSuggestion } from "@/lib/match";

/**
 * Trading, on a profile.
 *
 * Two different questions depending on whose profile it is, and conflating them
 * would get the privacy wrong in a way nobody would notice until it mattered.
 *
 * On your own profile it is a summary: what you have declared, and the trades
 * that came out of it. Your lists are yours, the inventory_own policy says so,
 * and this is the one page entitled to show them.
 *
 * On somebody else's it is emphatically NOT their lists. Their inventory is
 * private and stays private — the site tells every player that when they build
 * it, and quietly relaxing it here to fill a section would make that a lie. So
 * what shows is their LISTINGS, which are public by definition because they
 * posted them to a board, and then the genuinely useful thing: the trades you
 * could do with this person, ranked, computed from your lists against their
 * listings. That needs no access to their side at all.
 */
export async function ProfileTrades({
  gameSlug,
  gameName,
  userId,
  username,
  isMe,
}: {
  gameSlug: string;
  gameName: string;
  userId: string;
  username: string;
  isMe: boolean;
}) {
  return isMe ? (
    <OwnTrades gameSlug={gameSlug} gameName={gameName} />
  ) : (
    <TheirTrades
      gameSlug={gameSlug}
      gameName={gameName}
      userId={userId}
      username={username}
    />
  );
}

/* ------------------------------------------------------------------ */

async function OwnTrades({ gameSlug, gameName }: { gameSlug: string; gameName: string }) {
  const { trades, inventory, haveCount, wantCount } = await readSuggestions(gameSlug, 3);
  const have = inventory.filter((r) => r.kind === "have");
  const want = inventory.filter((r) => r.kind === "want");

  return (
    <>
      <section className="mt-8">
        <div className="flex items-baseline justify-between gap-3">
          <h2 className="text-[1.0625rem] font-extrabold tracking-[-0.025em] text-ink">
            Your {gameName} lists
          </h2>
          <Link
            href={`/app/${gameSlug}/trades?tab=inventory`}
            className="shrink-0 text-[0.8125rem] font-semibold text-mint hover:underline"
          >
            Edit
          </Link>
        </div>
        <p className="mt-1 text-[0.75rem] text-ink-faint">
          Private. Nobody else can read these — they exist so matching can find
          the people whose lists point back at yours.
        </p>

        {haveCount === 0 && wantCount === 0 ? (
          <p className="mt-3 rounded-[var(--radius-inner)] border border-dashed border-line px-4 py-8 text-center text-[0.875rem] text-ink-mute">
            Nothing declared yet.
          </p>
        ) : (
          <div className="mt-3 grid gap-2.5 sm:grid-cols-2">
            <ListSummary title="What you have" rows={have} tone="have" />
            <ListSummary title="What you want" rows={want} tone="want" />
          </div>
        )}
      </section>

      <section className="mt-8">
        <div className="flex items-baseline justify-between gap-3">
          <h2 className="text-[1.0625rem] font-extrabold tracking-[-0.025em] text-ink">
            Suggested for you
          </h2>
          {trades.length > 0 && (
            <Link
              href={`/app/${gameSlug}/trades`}
              className="shrink-0 text-[0.8125rem] font-semibold text-mint hover:underline"
            >
              See all
            </Link>
          )}
        </div>

        {trades.length === 0 ? (
          <p className="mt-3 rounded-[var(--radius-inner)] border border-dashed border-line px-4 py-8 text-center text-[0.875rem] text-ink-mute">
            {haveCount === 0 && wantCount === 0
              ? "Build your lists and matches appear here."
              : `Nothing on the ${gameName} board fits your lists yet.`}
          </p>
        ) : (
          <div className="mt-3 grid gap-3">
            {trades.map((s) => (
              <SuggestionCard key={s.listing.id} suggestion={s} gameSlug={gameSlug} />
            ))}
          </div>
        )}
      </section>
    </>
  );
}

/* ------------------------------------------------------------------ */

async function TheirTrades({
  gameSlug, gameName, userId, username,
}: {
  gameSlug: string;
  gameName: string;
  userId: string;
  username: string;
}) {
  const [listings, mine] = await Promise.all([
    readListingsOf(userId, gameSlug),
    readInventory(gameSlug),
  ]);

  if (listings.length === 0) {
    return (
      <section className="mt-8">
        <h2 className="text-[1.0625rem] font-extrabold tracking-[-0.025em] text-ink">
          {gameName} listings
        </h2>
        <p className="mt-3 rounded-[var(--radius-inner)] border border-dashed border-line px-4 py-8 text-center text-[0.875rem] text-ink-mute">
          {username} has nothing on the {gameName} board right now.
        </p>
      </section>
    );
  }

  // The same engine as everywhere else, pointed at one person's listings. That
  // is the whole trick: their side is public, your side is yours, and nothing
  // has to reach across.
  const between: TradeSuggestion[] = suggestTrades(
    listings,
    holdingsOf(mine, "have"),
    holdingsOf(mine, "want"),
  );

  return (
    <>
      {between.length > 0 && (
        <section className="mt-8">
          <h2 className="text-[1.0625rem] font-extrabold tracking-[-0.025em] text-ink">
            Trades you could do with {username}
          </h2>
          <p className="mt-1 text-[0.75rem] text-ink-faint">
            Worked out from your lists against what they have posted. They cannot
            see your lists.
          </p>
          <div className="mt-3 grid gap-3">
            {between.map((s) => (
              <SuggestionCard key={s.listing.id} suggestion={s} gameSlug={gameSlug} />
            ))}
          </div>
        </section>
      )}

      <section className="mt-8">
        <h2 className="text-[1.0625rem] font-extrabold tracking-[-0.025em] text-ink">
          Everything {username} has up
        </h2>
        <ul className="mt-3 space-y-2">
          {listings.map((l) => (
            <ListingRow key={l.id} listing={l} />
          ))}
        </ul>
      </section>
    </>
  );
}

/* ------------------------------------------------------------------ */

function ListSummary({
  title, rows, tone,
}: {
  title: string;
  rows: readonly InventoryRow[];
  tone: "have" | "want";
}) {
  return (
    <div className="rounded-[var(--radius-inner)] border border-line bg-surface p-3.5">
      <div className="flex items-baseline justify-between gap-2">
        <p className="label">{title}</p>
        <span
          className={`font-mono text-[0.625rem] tracking-[0.08em] ${tone === "have" ? "text-mint" : "text-ink-mute"}`}
        >
          {rows.length}
        </span>
      </div>

      {rows.length === 0 ? (
        <p className="mt-2.5 text-[0.8125rem] text-ink-mute">Nothing here yet.</p>
      ) : (
        <ul className="mt-2.5 space-y-1.5">
          {rows.slice(0, 6).map((row) => {
            const item = row.itemId ? findItem(row.itemId) : undefined;
            return (
              <li key={row.id} className="flex items-center gap-2">
                {item && <ItemTile item={item} size={26} />}
                <span className="min-w-0 flex-1 truncate text-[0.8125rem] font-semibold text-ink">
                  {row.name}
                </span>
                {row.rarity && <RarityChip rarity={row.rarity as Rarity} />}
                {row.quantity > 1 && (
                  <span className="shrink-0 font-mono text-[0.625rem] tabular-nums text-ink-mute">
                    ×{row.quantity}
                  </span>
                )}
              </li>
            );
          })}
          {rows.length > 6 && (
            <li className="pt-0.5 text-[0.75rem] text-ink-faint">
              and {rows.length - 6} more
            </li>
          )}
        </ul>
      )}
    </div>
  );
}

function ListingRow({ listing }: { listing: BoardListing }) {
  return (
    <li className="rounded-[var(--radius-inner)] border border-line bg-surface p-3.5">
      <div className="grid gap-3 sm:grid-cols-2">
        <div>
          <p className="label">Offering</p>
          <ul className="mt-1.5 space-y-1">
            {listing.offering.map((e, i) => (
              <li key={i} className="flex items-center gap-2">
                <ItemTile item={e.item} size={26} />
                <span className="min-w-0 flex-1 truncate text-[0.8125rem] font-semibold text-ink">
                  {e.item.name}
                </span>
                {e.quantity > 1 && (
                  <span className="shrink-0 font-mono text-[0.625rem] tabular-nums text-ink-mute">
                    ×{e.quantity}
                  </span>
                )}
              </li>
            ))}
          </ul>
        </div>
        <div>
          <p className="label">Asking for</p>
          {listing.wanting.length === 0 ? (
            <p className="mt-1.5 text-[0.8125rem] text-ink-mute">Open to offers.</p>
          ) : (
            <ul className="mt-1.5 space-y-1">
              {listing.wanting.map((e, i) => (
                <li key={i} className="flex items-center gap-2">
                  <ItemTile item={e.item} size={26} />
                  <span className="min-w-0 flex-1 truncate text-[0.8125rem] font-semibold text-ink">
                    {e.item.name}
                  </span>
                  {e.quantity > 1 && (
                    <span className="shrink-0 font-mono text-[0.625rem] tabular-nums text-ink-mute">
                      ×{e.quantity}
                    </span>
                  )}
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>

      {listing.note && (
        <p className="mt-3 text-[0.8125rem] italic leading-relaxed text-ink-mute">
          &ldquo;{listing.note}&rdquo;
        </p>
      )}
    </li>
  );
}
