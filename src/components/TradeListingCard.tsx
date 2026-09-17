import { ItemTile } from "./ItemTile";
import { ValuesCard } from "./ValuesCard";
import { REASON_LABEL, type CardListing } from "@/lib/match";
import type { ListingItem } from "@/lib/trade";

/**
 * A trade listing.
 *
 * Two constraints shape this, and they pull against each other.
 *
 * The first is density. A player scanning listings on a phone decides in about
 * a second each, and a card tall enough to show everything fits two per screen
 * — which means they never scan, they scroll, and they leave. So the resting
 * state is one compact row: who, and what for what. Seven or eight fit on a
 * phone, and the two-column grid on a tablet doubles that again.
 *
 * The second is that what is actually on the table has to be readable in full.
 * Three tiles and a "+2" is enough to skip a listing, not enough to act on one,
 * so every row opens into both sides written out — every item, its form, and
 * how many.
 *
 * A <details> element does both without a byte of JavaScript, which keeps this
 * a server component and makes it behave identically on every device.
 *
 * ---------------------------------------------------------------------------
 * Why there is no W/F/L on this card
 * ---------------------------------------------------------------------------
 *
 * There used to be. It sat on the resting row as a three-letter chip, and it
 * was the first thing anybody looked at — which is exactly why it had to go.
 * That chip was only ever as good as the value table behind it, MintPlaza no
 * longer keeps one, and it never covered enough of the catalogue to deserve the
 * confidence players read into it. A chip that says LOSS is a strong claim, and
 * this site is not in a position to make it.
 *
 * So the card states what changes hands and gets out of the way, with the
 * calculator that community actually uses one tap below. The reasoning in full
 * is in referrals.ts. What the card still does say, loudly, is when the two
 * sides name different games — that is not a value judgement, it is against the
 * rules of every game on the roster, and it is worth a warning.
 *
 * Which side is "yours" still depends on who is looking: the trader who posted
 * the listing hands over what they offer, everyone else hands over what is
 * wanted. Same listing, opposite sides — so the card is always told whose eyes
 * it is drawn through.
 */

function Avatar({ name, size = 34 }: { name: string; size?: number }) {
  // Stable hue from the name, so the same trader keeps the same colour.
  let h = 0;
  for (let i = 0; i < name.length; i++) h = (h * 31 + name.charCodeAt(i)) % 360;
  return (
    <span
      aria-hidden="true"
      className="grid shrink-0 place-items-center rounded-full font-bold"
      style={{
        width: size, height: size, fontSize: size * 0.32,
        color: `hsl(${h} 42% 32%)`,
        background: `hsl(${h} 46% 93%)`,
        boxShadow: `inset 0 0 0 1px hsl(${h} 40% 82%)`,
      }}
    >
      {name.slice(0, 2).toUpperCase()}
    </span>
  );
}

/** The item tiles on the resting row. Small, and capped so the row cannot grow. */
function MiniSide({ entries }: { entries: readonly ListingItem[] }) {
  if (entries.length === 0) {
    return (
      <span className="font-mono text-[0.5625rem] tracking-[0.07em] text-ink-faint">
        ANY OFFER
      </span>
    );
  }
  const shown = entries.slice(0, 3);
  return (
    <span className="flex items-center gap-1">
      {shown.map((e) => (
        <span key={`${e.item.id}-${e.variant ?? ""}`} className="relative">
          <ItemTile item={e.item} size={22} />
          {e.quantity > 1 && (
            <span className="absolute -bottom-1 -right-1 grid h-[13px] min-w-[13px] place-items-center rounded-full border border-line bg-surface px-[2px] font-mono text-[0.4375rem] font-bold text-ink">
              {e.quantity}
            </span>
          )}
        </span>
      ))}
      {entries.length > shown.length && (
        <span className="font-mono text-[0.5625rem] text-ink-faint">
          +{entries.length - shown.length}
        </span>
      )}
    </span>
  );
}

/** One side of the trade, written out. */
function SideList({
  label, entries, tone,
}: {
  label: string;
  entries: readonly ListingItem[];
  tone: "in" | "out";
}) {
  return (
    <div className="min-w-0">
      <p
        className={`mb-1.5 font-mono text-[0.5625rem] font-medium tracking-[0.1em] ${
          tone === "in" ? "text-mint" : "text-ink-mute"
        }`}
      >
        {label}
      </p>

      {entries.length === 0 ? (
        <p className="text-[0.8125rem] text-ink-mute">Nothing specific — open to offers.</p>
      ) : (
        <ul className="grid gap-1.5">
          {entries.map((e, n) => (
            <li key={`${e.item.id}-${e.variant ?? ""}-${n}`} className="flex items-center gap-2">
              <ItemTile item={e.item} size={26} />
              <span className="min-w-0 flex-1">
                <span className="block truncate text-[0.8125rem] font-semibold text-ink">
                  {e.quantity > 1 && <span className="text-ink-mute">{e.quantity}× </span>}
                  {e.item.name}
                </span>
                <span className="mt-0.5 flex flex-wrap items-center gap-1">
                  {e.variant && (
                    <span className="rounded-[5px] border border-line bg-fill px-1.5 py-0.5 font-mono text-[0.5rem] font-medium tracking-[0.06em] text-ink-soft">
                      {e.variant.toUpperCase()}
                    </span>
                  )}
                  {/* Rarity is the game's own tier, printed in the game and on
                      the wiki. Unlike a value it does not move, so it is the
                      one piece of "how good is this" the card can state
                      without keeping anything up to date. */}
                  {e.item.rarity && (
                    <span className="font-mono text-[0.5rem] tracking-[0.07em] text-ink-faint">
                      {e.item.rarity.toUpperCase()}
                    </span>
                  )}
                </span>
              </span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

export function TradeListingCard({
  listing,
  viewerUsername,
}: {
  listing: CardListing;
  /**
   * The signed-in player's name. When it matches the poster, the sides are
   * drawn from their side instead — they give what they offered.
   */
  viewerUsername?: string;
}) {
  const isOwner = Boolean(viewerUsername && viewerUsername === listing.username);

  // What the viewer receives and gives, in their own terms.
  const youGet = isOwner ? listing.wanting : listing.offering;
  const youGive = isOwner ? listing.offering : listing.wanting;

  const openToOffers = listing.wanting.length === 0;

  // Cross-game is a rules problem, not a pricing one, so it survived the
  // calculator: trading items between two Roblox games is bannable in every
  // game on this roster, and a listing that names two is either a mistake or
  // somebody about to lose an account.
  const crossGame =
    new Set(
      [...listing.offering, ...listing.wanting]
        .map((e) => e.item.gameSlug)
        .filter(Boolean),
    ).size > 1;

  return (
    <details className="glass group overflow-hidden rounded-[var(--radius-panel)] [&[open]]:bg-surface">
      {/* ---- the resting row: everything needed to skip or open ---- */}
      <summary className="flex cursor-pointer list-none items-center gap-2.5 px-3 py-2.5 marker:hidden [&::-webkit-details-marker]:hidden">
        <Avatar name={listing.username} />

        <span className="min-w-0 flex-1">
          <span className="flex items-center gap-1.5">
            <span className="min-w-0 truncate text-[0.8125rem] font-bold tracking-[-0.015em] text-ink">
              {listing.username}
            </span>
            {isOwner && (
              <span className="shrink-0 rounded-[5px] bg-fill px-1.5 py-0.5 font-mono text-[0.5rem] font-medium tracking-[0.07em] text-ink-mute">
                YOURS
              </span>
            )}
            {listing.isDemo && (
              <span className="shrink-0 rounded-[5px] border border-warn/30 bg-warn-wash px-1.5 py-0.5 font-mono text-[0.5rem] font-medium tracking-[0.07em] text-warn">
                DEMO
              </span>
            )}
            <span className="ml-auto shrink-0 font-mono text-[0.625rem] text-ink-faint">
              {listing.postedHoursAgo}h
            </span>
          </span>

          <span className="mt-1 flex items-center gap-2">
            <MiniSide entries={youGet} />
            <svg
              width="12" height="12" viewBox="0 0 16 16" fill="none" stroke="currentColor"
              strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round"
              className="shrink-0 text-ink-faint" aria-hidden="true"
            >
              <path d="M2 5.5h9.5M9 3l2.5 2.5L9 8" />
              <path d="M14 10.5H4.5M7 13l-2.5-2.5L7 8" />
            </svg>
            <MiniSide entries={youGive} />
            <span className="ml-auto flex shrink-0 items-center gap-1.5">
              {crossGame && (
                <span
                  title="This names items from two different games"
                  className="shrink-0 rounded-full bg-warn-wash px-2 py-0.5 font-mono text-[0.5625rem] font-bold tracking-[0.08em] text-warn"
                >
                  CROSS-GAME
                </span>
              )}
              <svg
                width="13" height="13" viewBox="0 0 16 16" fill="none" stroke="currentColor"
                strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"
                className="text-ink-faint transition-transform group-open:rotate-90"
                aria-hidden="true"
              >
                <path d="M6 3.5 10.5 8 6 12.5" />
              </svg>
            </span>
          </span>
        </span>
      </summary>

      {/* ---- both sides in full, identical on every device ---- */}
      <div className="border-t border-line-soft px-3 pb-3 pt-3">
        <p className="mb-3 font-mono text-[0.5625rem] font-medium tracking-[0.1em] text-ink-faint">
          WHAT CHANGES HANDS
          {isOwner ? " — FROM YOUR SIDE, AS THE POSTER" : " — FROM YOUR SIDE, NOT THEIRS"}
        </p>

        <div className="grid gap-4 sm:grid-cols-2">
          <SideList label="YOU RECEIVE" entries={youGet} tone="in" />
          <SideList label="YOU GIVE" entries={youGive} tone="out" />
        </div>

        {crossGame && (
          <p className="mt-3 rounded-[12px] border border-warn/30 bg-warn-wash px-3 py-2.5 text-[0.8125rem] font-semibold leading-relaxed text-warn">
            This listing names items from two different games. Trading across
            games is against the rules of every game MintPlaza covers and is a
            common way accounts get banned — and the items are not comparable in
            any case.
          </p>
        )}

        {openToOffers && !crossGame && (
          <p className="mt-3 text-[0.8125rem] leading-relaxed text-ink-mute">
            They have not said what they want. Send an offer and see.
          </p>
        )}

        {/* ---- where the W/F/L lives now ----
             Every game on the roster has a partner and the proof script keeps
             it that way, so this is never a dead end. See referrals.ts. ---- */}
        {!crossGame && (
          <div className="mt-3">
            <ValuesCard gameSlug={listing.gameSlug} compact />
          </div>
        )}

        {listing.note && (
          <p className="mt-3 text-[0.8125rem] leading-relaxed text-ink-mute">
            &ldquo;{listing.note}&rdquo;
          </p>
        )}

        <div className="mt-3 flex flex-wrap items-center justify-between gap-2">
          <p className="flex min-w-0 items-center gap-2 text-[0.6875rem] text-ink-faint">
            {listing.reason === "RECIPROCAL_MATCH" && (
              <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-mint" />
            )}
            <span className="truncate">{REASON_LABEL[listing.reason]}</span>
          </p>
          <div className="flex shrink-0 gap-2">
            <button type="button" className="pill pill-ghost py-1.5 text-[0.8125rem]">Message</button>
            <button type="button" className="pill pill-mint py-1.5 text-[0.8125rem]">Make offer</button>
          </div>
        </div>
      </div>
    </details>
  );
}
