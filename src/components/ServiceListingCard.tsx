import { findItem } from "@/lib/items";
import {
  findService, listingState, timeLeftCopy, expiresAt,
  type ServiceListing,
} from "@/lib/sessions";
import { VoterStack, OnlineDot } from "./VoterStack";
import { LiveCountdown } from "./LiveCountdown";

/**
 * One listing on the Raids & Services board.
 *
 * Two sides share this shape. An OFFER is one helper advertising everything
 * they can run; a REQUEST is one player stuck on one thing. They are drawn the
 * same because the decision is the same — can this person help me, or can I
 * help them — and a board where the two halves look different is a board people
 * read twice.
 *
 * The resting row carries the four things that decide it: who, what, whether
 * they are online right now, and how long is left. Everything else waits.
 *
 * Voting is interest, not commitment. Somebody stuck votes on a helper's offer;
 * a helper votes on a request they could take. The faces are the point — on a
 * board of strangers, seeing three people already interested and thirty-eight
 * more behind them is faster than any number.
 */

function Avatar({ name, url }: { name: string; url?: string }) {
  let h = 0;
  for (let i = 0; i < name.length; i++) h = (h * 31 + name.charCodeAt(i)) % 360;
  return (
    <span
      aria-hidden="true"
      className="grid h-[34px] w-[34px] shrink-0 place-items-center overflow-hidden rounded-full text-[0.6875rem] font-bold"
      style={{
        color: `hsl(${h} 42% 32%)`,
        background: `hsl(${h} 46% 93%)`,
        boxShadow: `inset 0 0 0 1px hsl(${h} 40% 82%)`,
      }}
    >
      {url
        ? /* eslint-disable-next-line @next/next/no-img-element */
          <img src={url} alt="" className="h-full w-full object-cover" />
        : name.slice(0, 2).toUpperCase()}
    </span>
  );
}

const KIND_TONE: Record<string, string> = {
  Raid: "#8A5A12", Trial: "#6B4CA8", Puzzle: "#2C6C9E",
  Boss: "#A93226", Unlock: "#0F766E", Grind: "#2F7D57", Island: "#A8501E",
};

export function ServiceListingCard({ listing }: { listing: ServiceListing }) {
  const services = listing.serviceIds
    .map(findService)
    .filter((s): s is NonNullable<typeof s> => Boolean(s));
  if (services.length === 0) return null;

  const state = listingState(listing);
  const isOffer = listing.side === "offer";
  const headline = isOffer
    ? services.length === 1
      ? services[0].name
      : `${services[0].name} + ${services.length - 1} more`
    : services[0].name;

  const termsItem =
    listing.terms.kind === "item" ? findItem(listing.terms.itemId) : undefined;

  return (
    <details
      className={`glass group overflow-hidden rounded-[var(--radius-panel)] [&[open]]:bg-surface ${
        state === "live" ? "" : "opacity-70"
      }`}
    >
      <summary className="flex cursor-pointer list-none items-center gap-2.5 px-3 py-2.5 marker:hidden [&::-webkit-details-marker]:hidden">
        <Avatar name={listing.author} url={listing.authorAvatarUrl} />

        <span className="min-w-0 flex-1">
          {/* Line one is the title's alone. Everything that competed with it
              for width moved down a line, because a truncated service name is
              the one thing on this row nobody can work around. */}
          <span className="flex items-center gap-1.5">
            <span className="min-w-0 flex-1 truncate text-[0.8125rem] font-bold tracking-[-0.015em] text-ink">
              {headline}
            </span>
            <OnlineDot online={listing.authorOnline} />
            <span
              className={`shrink-0 font-mono text-[0.625rem] tabular-nums ${
                state === "live" ? "text-ink-faint" : "text-warn"
              }`}
            >
              {state === "taken" ? (
                "TAKEN"
              ) : (
                <LiveCountdown
                  expiresAt={expiresAt(listing)}
                  initial={timeLeftCopy(listing)}
                />
              )}
            </span>
          </span>

          <span className="mt-1 flex items-center gap-2">
            <span
              className="shrink-0 rounded-[5px] px-1.5 py-0.5 font-mono text-[0.5rem] font-bold tracking-[0.07em]"
              style={
                isOffer
                  ? { color: "#0B6157", background: "#DFF3F1" }
                  : { color: "#8A5A12", background: "#FBF1E0" }
              }
            >
              {isOffer ? "CAN HELP" : "NEEDS HELP"}
            </span>
            <VoterStack
              voters={listing.voters}
              total={listing.voteCount}
              online={listing.votersOnline}
            />
            <svg
              width="13" height="13" viewBox="0 0 16 16" fill="none" stroke="currentColor"
              strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"
              className="ml-auto shrink-0 text-ink-faint transition-transform group-open:rotate-90"
              aria-hidden="true"
            >
              <path d="M6 3.5 10.5 8 6 12.5" />
            </svg>
          </span>
        </span>
      </summary>

      <div className="border-t border-line-soft px-3 pb-3 pt-3">
        {/* ---- who ---- */}
        <p className="mb-3 flex flex-wrap items-center gap-x-2 gap-y-1 text-[0.875rem]">
          <span className="font-bold text-ink">{listing.author}</span>
          <OnlineDot online={listing.authorOnline} />
          {listing.authorOnline && (
            <span className="font-mono text-[0.5625rem] tracking-[0.07em] text-mint">
              ONLINE NOW
            </span>
          )}
          <span className="font-mono text-[0.625rem] text-ink-faint">
            {listing.completed === 0 ? "NEW HERE" : `${listing.completed} HELPED`}
          </span>
          <span className="rounded-[5px] border border-warn/30 bg-warn-wash px-1.5 py-0.5 font-mono text-[0.5rem] tracking-[0.07em] text-warn">
            DEMO
          </span>
        </p>

        {/* ---- what, with the game's own requirement on each ---- */}
        <p className="mb-2 font-mono text-[0.5625rem] font-medium tracking-[0.1em] text-ink-faint">
          {isOffer ? "CAN RUN THESE" : "STUCK ON"}
        </p>
        <ul className="grid gap-2">
          {services.map((s) => {
            const tone = KIND_TONE[s.kind] ?? "#465650";
            return (
              <li key={s.id} className="rounded-[12px] border border-line-soft bg-fill px-3 py-2.5">
                <p className="flex flex-wrap items-center gap-1.5">
                  <span className="text-[0.875rem] font-bold tracking-[-0.015em] text-ink">
                    {s.name}
                  </span>
                  <span
                    className="rounded-[5px] px-1.5 py-0.5 font-mono text-[0.5rem] font-medium tracking-[0.07em]"
                    style={{ color: tone, background: `${tone}14` }}
                  >
                    {s.kind.toUpperCase()}
                  </span>
                  {s.players && (
                    <span className="font-mono text-[0.5rem] tracking-[0.07em] text-ink-faint">
                      {s.players} PLAYERS
                    </span>
                  )}
                </p>
                {s.needs && (
                  <p className="mt-1 text-[0.8125rem] leading-relaxed text-ink-soft">
                    {s.needs}
                  </p>
                )}
                {s.gives && (
                  <p className="mt-1 text-[0.75rem] leading-relaxed text-ink-mute">
                    Gets you: {s.gives}
                  </p>
                )}
              </li>
            );
          })}
        </ul>

        <p className="mt-3 text-[0.875rem]">
          <span className="font-mono text-[0.5625rem] tracking-[0.1em] text-ink-faint">
            IN RETURN{" "}
          </span>
          <span className="font-semibold text-ink">
            {listing.terms.kind === "free" && "Nothing"}
            {listing.terms.kind === "split" && "Split whatever drops"}
            {listing.terms.kind === "item" && (termsItem?.name ?? "An item")}
          </span>
        </p>

        {listing.note && (
          <p className="mt-2 text-[0.8125rem] leading-relaxed text-ink-mute">
            &ldquo;{listing.note}&rdquo;
          </p>
        )}

        <p className="mt-3 text-[0.6875rem] leading-relaxed text-ink-faint">
          Play it yourself. Nobody should ever ask for your account, your password
          or your login — a run done on your account is not a service, it is how
          accounts get taken.
        </p>

        <div className="mt-3 flex flex-wrap items-center justify-between gap-2">
          <button
            type="button"
            disabled={state !== "live"}
            className="pill pill-ghost flex items-center gap-1.5 py-1.5 text-[0.8125rem] disabled:opacity-50"
          >
            <svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor"
                 strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <path d="M8 13.5V4M4.5 7.5 8 4l3.5 3.5" />
            </svg>
            Vote {listing.voteCount > 0 && `· ${listing.voteCount}`}
          </button>
          <button
            type="button"
            disabled={state !== "live"}
            className="pill pill-mint py-1.5 text-[0.8125rem] disabled:opacity-50"
          >
            {state === "taken" ? "Already taken" : isOffer ? "Ask them" : "Offer to help"}
          </button>
        </div>
      </div>
    </details>
  );
}
