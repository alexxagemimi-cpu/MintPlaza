import Link from "next/link";
import { ItemTile } from "./ItemTile";
import { REASON_BLURB, REASON_LABEL, type TradeSuggestion } from "@/lib/match";
import { VERDICT_COPY, VERDICT_STYLE, type ListingItem } from "@/lib/trade";
import { formatValue, valueSourceFor } from "@/lib/values";

/**
 * One suggested trade.
 *
 * The difference between this and a listing card is what it is claiming. A
 * listing card says "here is something somebody posted". This says "here is a
 * deal you could do, and here is why we put it in front of you" — which is a
 * much stronger claim, and the card has to carry enough for a player to check
 * it rather than take it on faith.
 *
 * So three things are always on screen and never collapsed: exactly what you
 * would hand over, exactly what you would get back, and whether you can close
 * it today or are short an item. The ranking's reasoning is one tap away rather
 * than hidden — a score nobody can interrogate is a score they stop trusting
 * the first time it puts something strange at the top.
 */
export function SuggestionCard({
  suggestion,
  gameSlug,
}: {
  suggestion: TradeSuggestion;
  gameSlug: string;
}) {
  const { listing, reason, youGive, youGet, missing, canClose, verdict, calculation } =
    suggestion;
  const style = VERDICT_STYLE[verdict];
  const source = valueSourceFor(gameSlug);

  return (
    <article className="glass overflow-hidden rounded-[var(--radius-panel)]">
      {/* ---- who, and how well it fits ---- */}
      <header className="flex items-start gap-3 border-b border-line-soft px-4 py-3">
        <Avatar name={listing.username} />
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-1.5">
            <Link
              href={`/app/${gameSlug}/profile/${listing.username}`}
              className="min-w-0 truncate text-[0.875rem] font-bold tracking-[-0.015em] text-ink hover:text-mint"
            >
              {listing.displayName ?? listing.username}
            </Link>
            {listing.online && (
              <span className="flex shrink-0 items-center gap-1 text-[0.6875rem] font-semibold text-mint">
                <span className="h-1.5 w-1.5 rounded-full bg-mint-vivid" />
                Online
              </span>
            )}
          </div>
          <p className="mt-0.5 flex flex-wrap items-center gap-x-2 gap-y-0.5 text-[0.75rem] text-ink-mute">
            <span>
              {listing.deals} completed {listing.deals === 1 ? "deal" : "deals"}
            </span>
            <span aria-hidden="true">·</span>
            <span>{hoursAgo(listing.bumpedAt)}</span>
          </p>
        </div>

        <span
          className="shrink-0 rounded-lg px-2 py-1 font-mono text-[0.625rem] font-bold tracking-[0.07em]"
          style={{ color: style.fg, background: style.bg, boxShadow: `inset 0 0 0 1px ${style.ring}` }}
          title={VERDICT_COPY[verdict].long}
        >
          {VERDICT_COPY[verdict].short}
        </span>
      </header>

      {/* ---- the reason, in the engine's own words ---- */}
      <div className="flex items-center gap-2 bg-fill/60 px-4 py-2" title={REASON_BLURB[reason]}>
        <span
          className={`h-1.5 w-1.5 shrink-0 rounded-full ${canClose ? "bg-mint-vivid" : "bg-ink-faint"}`}
          aria-hidden="true"
        />
        <p className="min-w-0 text-[0.75rem] font-semibold text-ink-soft">
          {REASON_LABEL[reason]}
        </p>
      </div>

      {/* ---- the deal itself ---- */}
      <div className="grid gap-3 px-4 py-3.5 sm:grid-cols-2">
        <Side label="You give" entries={youGive} tone="give" />
        <Side label="You get" entries={youGet} tone="get" />
      </div>

      {/* ---- what stands between you and closing it ---- */}
      {missing.length > 0 && (
        <p className="mx-4 mb-3 rounded-[var(--radius-inner)] border border-warn/30 bg-warn-wash px-3 py-2 text-[0.75rem] leading-relaxed text-ink-soft">
          <span className="font-bold text-ink">Not yet.</span>{" "}
          You do not have {list(missing.map((e) => e.item.name))} on your have list.
        </p>
      )}

      {listing.note && (
        <p className="mx-4 mb-3 text-[0.8125rem] italic leading-relaxed text-ink-mute">
          &ldquo;{listing.note}&rdquo;
        </p>
      )}

      {/* ---- the totals, and why this is ranked here ---- */}
      <details className="group border-t border-line-soft">
        <summary className="flex cursor-pointer list-none items-center gap-2 px-4 py-2.5 text-[0.75rem] font-semibold text-ink-mute marker:hidden hover:text-ink [&::-webkit-details-marker]:hidden">
          <svg
            width="11" height="11" viewBox="0 0 16 16" fill="none" stroke="currentColor"
            strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"
            className="transition-transform group-open:rotate-90"
          >
            <path d="M6 3.5 10.5 8 6 12.5" />
          </svg>
          Why this is here
        </summary>

        <div className="px-4 pb-4">
          {/* The arithmetic, where there is any. An unpriced side is said so
              rather than summed around — see trade.ts. */}
          <dl className="mb-3 grid grid-cols-2 gap-2 text-[0.75rem]">
            <Total label="You give" total={calculation.outgoing.total} unpriced={calculation.outgoing.unpriced} unit={source?.unit} />
            <Total label="You get" total={calculation.incoming.total} unpriced={calculation.incoming.unpriced} unit={source?.unit} />
          </dl>

          <ul className="space-y-1">
            {suggestion.factors.map((f, i) => (
              <li key={i} className="flex items-baseline justify-between gap-3 text-[0.75rem]">
                <span className="min-w-0 text-ink-soft">{f.label}</span>
                <span
                  className={`shrink-0 font-mono tabular-nums ${f.points < 0 ? "text-bad" : "text-ink-mute"}`}
                >
                  {f.points > 0 ? "+" : ""}
                  {f.points}
                </span>
              </li>
            ))}
          </ul>
        </div>
      </details>
    </article>
  );
}

/* ------------------------------------------------------------------ */

function Side({
  label,
  entries,
  tone,
}: {
  label: string;
  entries: readonly ListingItem[];
  tone: "give" | "get";
}) {
  return (
    <div>
      <p className={`label ${tone === "get" ? "text-mint" : ""}`}>{label}</p>
      {entries.length === 0 ? (
        <p className="mt-2 text-[0.8125rem] text-ink-mute">
          {/* An empty want side is the listing saying "make me an offer", which
              is a real state and not a missing one. */}
          Nothing named — they are open to offers.
        </p>
      ) : (
        <ul className="mt-2 space-y-1.5">
          {entries.map((e, i) => (
            <li key={`${e.item.id}-${e.variant ?? ""}-${i}`} className="flex items-center gap-2">
              <ItemTile item={e.item} size={30} />
              <span className="min-w-0 flex-1">
                <span className="block truncate text-[0.8125rem] font-semibold text-ink">
                  {e.item.name}
                </span>
                {e.variant && (
                  <span className="font-mono text-[0.5625rem] tracking-[0.07em] text-mint">
                    {e.variant.toUpperCase()}
                  </span>
                )}
              </span>
              {e.quantity > 1 && (
                <span className="shrink-0 font-mono text-[0.6875rem] tabular-nums text-ink-mute">
                  ×{e.quantity}
                </span>
              )}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function Total({
  label, total, unpriced, unit,
}: {
  label: string;
  total: number;
  unpriced: readonly string[];
  unit?: string;
}) {
  return (
    <div className="rounded-[var(--radius-inner)] border border-line-soft px-2.5 py-2">
      <dt className="font-mono text-[0.5625rem] tracking-[0.08em] text-ink-faint">
        {label.toUpperCase()}
      </dt>
      <dd className="mt-0.5 text-[0.875rem] font-bold text-ink">
        {unpriced.length > 0 ? (
          <span className="text-[0.75rem] font-semibold text-ink-mute">
            {/* Never a partial sum presented as a total. One unpriced item and
                the number would read as the value of the whole side. */}
            {unpriced.length} without a published value
          </span>
        ) : (
          <>
            {formatValue(total)}
            {unit && (
              <span className="ml-1 font-mono text-[0.5625rem] font-medium tracking-[0.06em] text-ink-faint">
                {unit.toUpperCase()}
              </span>
            )}
          </>
        )}
      </dd>
    </div>
  );
}

function Avatar({ name, size = 32 }: { name: string; size?: number }) {
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

function hoursAgo(iso: string): string {
  const h = Math.floor((Date.now() - new Date(iso).getTime()) / 3_600_000);
  if (h < 1) return "just now";
  if (h < 24) return `${h}h ago`;
  const d = Math.floor(h / 24);
  return `${d}d ago`;
}

function list(names: readonly string[]): string {
  if (names.length === 1) return names[0];
  if (names.length === 2) return `${names[0]} or ${names[1]}`;
  return `${names.slice(0, -1).join(", ")} or ${names[names.length - 1]}`;
}
