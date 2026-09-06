import { ItemTile } from "./ItemTile";
import { REASON_COPY, type DemoListing, type ListingItem } from "@/lib/demo";
import {
  DEMAND_LABEL, DEMAND_STYLE, VALUE_SOURCE, formatValue, type Demand,
} from "@/lib/values";
import {
  VERDICT_COPY, VERDICT_STYLE, calculate, gapLabel,
  type Calculation, type Perspective, type SideTotal,
} from "@/lib/trade";

/**
 * A trade listing.
 *
 * Two constraints shape this, and they pull against each other.
 *
 * The first is density. A player scanning listings on a phone decides in about
 * a second each, and a card tall enough to show everything fits two per screen
 * — which means they never scan, they scroll, and they leave. So the resting
 * state is one compact row: who, what for what, and the verdict. Seven or eight
 * fit on a phone, and the two-column grid on a tablet doubles that again.
 *
 * The second is that the numbers behind the verdict have to be inspectable.
 * A calculator that shows only "LOSS" is a black box, and players do not trust
 * black boxes with items worth months of grinding. So every row opens into the
 * full arithmetic — every item, its price, its value, its demand, the subtotals
 * and the difference.
 *
 * A <details> element does both without a byte of JavaScript, which keeps this
 * a server component and makes it behave identically on every device.
 *
 * The verdict itself depends on who is looking. The trader who posted the
 * listing hands over what they offer; everyone else hands over what is wanted.
 * Same listing, opposite sides, opposite verdict — so the card is always told
 * whose eyes it is drawn through.
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

function VerdictChip({ calc }: { calc: Calculation }) {
  const s = VERDICT_STYLE[calc.verdict];
  const copy = VERDICT_COPY[calc.verdict];
  const gap = gapLabel(calc);
  return (
    <span
      title={gap.long ? `${copy.long} — ${gap.long}` : copy.long}
      className="shrink-0 rounded-full px-2 py-0.5 font-mono text-[0.5625rem] font-bold tracking-[0.08em] tabular-nums"
      style={{ color: s.fg, background: s.bg, boxShadow: `inset 0 0 0 1px ${s.ring}` }}
    >
      {copy.short}{gap.short && ` ${gap.short}`}
    </span>
  );
}

/**
 * Demand, as a word.
 *
 * Extreme gets solid red and a slow pulse. That is the one step where the
 * information is "drop what you are doing", and a trader scanning nine rows on
 * a phone should catch it without reading a single label.
 */
function DemandChip({ demand }: { demand: Demand }) {
  const s = DEMAND_STYLE[demand];
  return (
    <span
      className={`rounded-[5px] px-1.5 py-0.5 font-mono text-[0.5rem] font-medium tracking-[0.07em] ${
        s.glow ? "demand-extreme font-bold" : ""
      }`}
      style={{ color: s.fg, background: s.bg }}
    >
      {DEMAND_LABEL[demand].toUpperCase()} DEMAND
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

/** One side of the breakdown table. */
function SideBreakdown({
  label, side, tone,
}: {
  label: string;
  side: SideTotal;
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

      {side.lines.length === 0 ? (
        <p className="text-[0.8125rem] text-ink-mute">Nothing specific — open to offers.</p>
      ) : (
        <ul className="grid gap-1.5">
          {side.lines.map((l, n) => (
            <li key={`${l.name}-${l.variant ?? ""}-${n}`} className="flex items-baseline gap-2">
              <span className="min-w-0 flex-1">
                <span className="block truncate text-[0.8125rem] font-semibold text-ink">
                  {l.quantity > 1 && <span className="text-ink-mute">{l.quantity}× </span>}
                  {l.name}
                </span>
                <span className="mt-0.5 flex flex-wrap items-center gap-1">
                  {l.variant && (
                    <span className="rounded-[5px] border border-line bg-fill px-1.5 py-0.5 font-mono text-[0.5rem] font-medium tracking-[0.06em] text-ink-soft">
                      {l.variant.toUpperCase()}
                    </span>
                  )}
                  {l.demand !== undefined && <DemandChip demand={l.demand} />}
                  {l.price && (
                    <span
                      title={`What the game charges. Value is what players trade it for.`}
                      className="font-mono text-[0.5rem] tracking-[0.07em] text-ink-faint"
                    >
                      PRICE {l.price.unit === "Robux" ? "R$" : ""}
                      {formatValue(l.price.amount)}
                      {l.price.unit === "Beli" ? " BELI" : ""}
                    </span>
                  )}
                </span>
              </span>
              <span className="shrink-0 text-right font-mono text-[0.75rem] tabular-nums">
                {l.subtotal === undefined ? (
                  <span className="text-warn">no value</span>
                ) : (
                  <>
                    <span className="font-bold text-ink">{formatValue(l.subtotal)}</span>
                    {l.quantity > 1 && (
                      <span className="block text-[0.625rem] text-ink-faint">
                        {formatValue(l.unit!)} each
                      </span>
                    )}
                  </>
                )}
              </span>
            </li>
          ))}
        </ul>
      )}

      <p className="mt-2 flex items-baseline justify-between gap-2 border-t border-line-soft pt-1.5 font-mono text-[0.75rem] tabular-nums">
        <span className="tracking-[0.07em] text-ink-faint">TOTAL</span>
        <span className="font-bold text-ink">
          {formatValue(side.total)}
          {side.unpriced.length > 0 && <span className="text-warn"> +?</span>}
        </span>
      </p>
    </div>
  );
}

export function TradeListingCard({
  listing,
  viewerUsername,
}: {
  listing: DemoListing;
  /**
   * The signed-in player's name. When it matches the poster the listing is
   * calculated from their side instead, which flips the verdict.
   */
  viewerUsername?: string;
}) {
  const perspective: Perspective =
    viewerUsername && viewerUsername === listing.username ? "owner" : "viewer";
  const calc = calculate(listing.offering, listing.wanting, perspective);

  // What the viewer receives and gives, in their own terms.
  const youGet = perspective === "owner" ? listing.wanting : listing.offering;
  const youGive = perspective === "owner" ? listing.offering : listing.wanting;
  const gap = gapLabel(calc);

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
            {perspective === "owner" && (
              <span className="shrink-0 rounded-[5px] bg-fill px-1.5 py-0.5 font-mono text-[0.5rem] font-medium tracking-[0.07em] text-ink-mute">
                YOURS
              </span>
            )}
            <span className="shrink-0 rounded-[5px] border border-warn/30 bg-warn-wash px-1.5 py-0.5 font-mono text-[0.5rem] font-medium tracking-[0.07em] text-warn">
              DEMO
            </span>
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
              <VerdictChip calc={calc} />
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

      {/* ---- the arithmetic, on demand and identical on every device ---- */}
      <div className="border-t border-line-soft px-3 pb-3 pt-3">
        <p className="mb-3 font-mono text-[0.5625rem] font-medium tracking-[0.1em] text-ink-faint">
          SHOW CALCULATIONS
          {perspective === "owner"
            ? " — FROM YOUR SIDE, AS THE POSTER"
            : " — FROM YOUR SIDE, NOT THEIRS"}
        </p>

        <p className="mb-3 text-[0.6875rem] leading-relaxed text-ink-faint">
          <b className="font-semibold text-ink-mute">Price</b> is what the game
          charges. <b className="font-semibold text-ink-mute">Value</b> is what
          players actually trade it for. Portal costs 1.9M Beli and trades near
          10M — every total below is value, never price.
        </p>

        <div className="grid gap-4 sm:grid-cols-2">
          <SideBreakdown label="YOU RECEIVE" side={calc.incoming} tone="in" />
          <SideBreakdown label="YOU GIVE" side={calc.outgoing} tone="out" />
        </div>

        {/* ---- the verdict, spelled out ---- */}
        <div className="mt-3 flex flex-wrap items-center gap-x-3 gap-y-1.5 rounded-[12px] bg-fill px-3 py-2.5">
          <VerdictChip calc={calc} />
          <span className="text-[0.8125rem] font-semibold text-ink">
            {calc.openToOffers
              ? "They have not said what they want, so there is nothing to weigh this against."
              : calc.verdict === "?"
                ? "Some items here have no published value, so this is not a call anyone should trade on."
                : `${formatValue(calc.incoming.total)} in, ${formatValue(calc.outgoing.total)} out — ` +
                  `a ${calc.difference >= 0 ? "gain" : "shortfall"} of ` +
                  `${formatValue(Math.abs(calc.difference))}` +
                  `${gap.long ? ` — ${gap.long}` : ""}.`}
          </span>
        </div>

        {listing.note && (
          <p className="mt-3 text-[0.8125rem] leading-relaxed text-ink-mute">
            &ldquo;{listing.note}&rdquo;
          </p>
        )}

        {/* ---- provenance. A value nobody can source is a rumour. ---- */}
        <p className="mt-3 text-[0.6875rem] leading-relaxed text-ink-faint">
          Value and demand are community estimates from{" "}
          <a href={VALUE_SOURCE.url} target="_blank" rel="noopener noreferrer" className="underline">
            {VALUE_SOURCE.name}
          </a>
          , read {VALUE_SOURCE.checked}. They are not official, they move daily, and
          they are a starting point for a conversation rather than a price.
        </p>

        <div className="mt-3 flex flex-wrap items-center justify-between gap-2">
          <p className="flex min-w-0 items-center gap-2 text-[0.6875rem] text-ink-faint">
            {listing.reason === "RECIPROCAL_MATCH" && (
              <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-mint" />
            )}
            <span className="truncate">{REASON_COPY[listing.reason]}</span>
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
