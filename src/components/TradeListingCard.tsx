import { ItemTile } from "./ItemTile";
import { RARITY_STYLE } from "@/lib/items";
import { REASON_COPY, type DemoListing, type ListingItem } from "@/lib/demo";

/**
 * A trade listing.
 *
 * Built the way trading sites present one, because that layout is load-bearing
 * rather than decorative: both sides visible at a glance, every item shown as a
 * tile with its variant stated on it, and the trader's standing next to their
 * name. A player scanning fifty of these decides in about a second each, and
 * anything that forces them to read a paragraph costs them that second.
 */

function Avatar({ name }: { name: string }) {
  // Stable hue from the name, so the same trader keeps the same colour.
  let h = 0;
  for (let i = 0; i < name.length; i++) h = (h * 31 + name.charCodeAt(i)) % 360;
  return (
    <span
      aria-hidden="true"
      className="grid h-9 w-9 shrink-0 place-items-center rounded-full text-[0.75rem] font-bold"
      style={{
        color: `hsl(${h} 42% 32%)`,
        background: `hsl(${h} 46% 93%)`,
        boxShadow: `inset 0 0 0 1px hsl(${h} 40% 82%)`,
      }}
    >
      {name.slice(0, 2).toUpperCase()}
    </span>
  );
}

function ItemRow({ entry }: { entry: ListingItem }) {
  const { item, variant, quantity } = entry;
  const style = item.rarity ? RARITY_STYLE[item.rarity] : RARITY_STYLE.Common;

  return (
    <li className="flex items-center gap-2.5 rounded-[12px] border border-line-soft bg-surface p-2">
      <span className="relative">
        <ItemTile item={item} size={38} />
        {quantity > 1 && (
          <span className="absolute -bottom-1 -right-1 grid h-[18px] min-w-[18px] place-items-center rounded-full border border-line bg-surface px-1 font-mono text-[0.5625rem] font-bold text-ink">
            {quantity}
          </span>
        )}
      </span>

      <span className="min-w-0 flex-1">
        <span className="block truncate text-[0.875rem] font-bold leading-tight tracking-[-0.015em] text-ink">
          {item.name}
        </span>
        <span className="mt-1 flex flex-wrap items-center gap-1">
          {variant && (
            <span className="rounded-[5px] border border-line bg-fill px-1.5 py-0.5 font-mono text-[0.5625rem] font-medium tracking-[0.06em] text-ink-soft">
              {variant.toUpperCase()}
            </span>
          )}
          {item.rarity && (
            <span
              className="rounded-[5px] px-1.5 py-0.5 font-mono text-[0.5625rem] font-medium tracking-[0.06em]"
              style={{ color: style.fg, background: style.bg }}
            >
              {item.rarity.toUpperCase()}
            </span>
          )}
          {item.category !== "Fruit" && (
            <span className="font-mono text-[0.5625rem] tracking-[0.07em] text-ink-faint">
              {item.category.toUpperCase()}
            </span>
          )}
        </span>
      </span>
    </li>
  );
}

function Side({
  label,
  entries,
  tone,
}: {
  label: string;
  entries: ListingItem[];
  tone: "give" | "want";
}) {
  return (
    <div className="min-w-0">
      <p
        className={`mb-2 font-mono text-[0.625rem] font-medium tracking-[0.1em] ${
          tone === "give" ? "text-mint" : "text-ink-mute"
        }`}
      >
        {label}
      </p>
      {entries.length > 0 ? (
        <ul className="grid gap-1.5">
          {entries.map((e) => (
            <ItemRow key={`${e.item.id}-${e.variant ?? ""}`} entry={e} />
          ))}
        </ul>
      ) : (
        <div className="flex items-center gap-2 rounded-[12px] border border-dashed border-line bg-fill px-3 py-4">
          <svg width="16" height="16" viewBox="0 0 18 18" fill="none" stroke="currentColor" strokeWidth="1.6" className="text-ink-faint" strokeLinecap="round">
            <circle cx="9" cy="9" r="7" />
            <path d="M9 5.6v3.8M9 12.2h.01" />
          </svg>
          <span className="text-[0.8125rem] font-semibold text-ink-mute">Open to offers</span>
        </div>
      )}
    </div>
  );
}

export function TradeListingCard({ listing }: { listing: DemoListing }) {
  const reciprocal = listing.reason === "RECIPROCAL_MATCH";

  return (
    <article className="glass flex h-full flex-col overflow-hidden rounded-[var(--radius-panel)]">
      {/* ---- trader ---- */}
      <header className="flex items-center gap-3 border-b border-line-soft px-5 py-3.5">
        <Avatar name={listing.username} />
        <div className="min-w-0 flex-1">
          <p className="truncate text-[0.9375rem] font-bold tracking-[-0.015em] text-ink">
            {listing.username}
          </p>
          <p className="font-mono text-[0.625rem] tracking-[0.06em] text-ink-faint">
            {listing.trades === 0
              ? "NEW HERE"
              : `${listing.trades} COMPLETED TRADE${listing.trades === 1 ? "" : "S"}`}
          </p>
        </div>
        <span className="shrink-0 rounded-full border border-warn/30 bg-warn-wash px-2 py-1 font-mono text-[0.5625rem] font-medium tracking-[0.09em] text-warn">
          DEMO
        </span>
        <span className="shrink-0 font-mono text-[0.6875rem] text-ink-faint">
          {listing.postedHoursAgo}h
        </span>
      </header>

      {/* ---- the two sides ---- */}
      <div className="grid flex-1 gap-4 px-5 py-4 sm:grid-cols-[1fr_auto_1fr] sm:gap-3">
        <Side label="OFFERING" entries={listing.offering} tone="give" />

        <div aria-hidden="true" className="flex items-center justify-center sm:px-1">
          <span className="grid h-7 w-7 place-items-center rounded-full border border-line bg-surface text-ink-faint">
            <svg width="13" height="13" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
              <path d="M2 5.5h9.5M9 3l2.5 2.5L9 8" />
              <path d="M14 10.5H4.5M7 13l-2.5-2.5L7 8" />
            </svg>
          </span>
        </div>

        <Side label="LOOKING FOR" entries={listing.wanting} tone="want" />
      </div>

      {listing.note && (
        <p className="px-5 pb-3 text-[0.8125rem] leading-relaxed text-ink-mute">
          &ldquo;{listing.note}&rdquo;
        </p>
      )}

      {/* ---- why it surfaced, and what to do ---- */}
      <footer className="mt-auto flex flex-wrap items-center justify-between gap-3 border-t border-line-soft px-5 py-3.5">
        <p className="flex min-w-0 items-center gap-2 text-[0.75rem] leading-snug text-ink-faint">
          {reciprocal && <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-mint" />}
          <span className="truncate">{REASON_COPY[listing.reason]}</span>
        </p>
        <div className="flex shrink-0 gap-2">
          <button type="button" className="pill pill-ghost py-2 text-[0.8125rem]">Message</button>
          <button type="button" className="pill pill-mint py-2 text-[0.8125rem]">Make offer</button>
        </div>
      </footer>
    </article>
  );
}
