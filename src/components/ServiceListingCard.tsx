"use client";

import { useState } from "react";
import { findItem } from "@/lib/items";
import {
  findService, listingState, timeLeftCopy, expiresAt,
  pickedVoters, agreedVoters,
  type ServiceListing, type Voter,
} from "@/lib/sessions";
import { VoterStack, OnlineDot } from "./VoterStack";
import { LiveCountdown } from "./LiveCountdown";
import { VotersSheet, ReplyMark, Face } from "./VotersSheet";
import { CommentThread } from "./CommentThread";
import { ReportButton } from "./ReportButton";

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

export function ServiceListingCard({
  listing,
  /** Shows the poster's own controls. Used by My lists. */
  showOwnerControls = false,
}: {
  listing: ServiceListing;
  showOwnerControls?: boolean;
}) {
  const [voted, setVoted] = useState(listing.youVoted);
  const [voteCount, setVoteCount] = useState(listing.voteCount);
  const [sheet, setSheet] = useState<null | "view" | "choose">(null);
  const [voters, setVoters] = useState<readonly Voter[]>(listing.voters);
  const [stage, setStage] = useState(listing.stage);

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

  function toggleVote() {
    setVoted((was) => {
      setVoteCount((n) => n + (was ? -1 : 1));
      return !was;
    });
  }

  /** The poster picked a team and asked them. */
  function sendRequest(chosen: string[]) {
    setVoters((prev) =>
      prev.map((v) =>
        chosen.includes(v.username) ? { ...v, reply: "waiting" as const } : v,
      ),
    );
    setStage("requested");
    setSheet(null);
  }

  const picked = pickedVoters({ ...listing, voters });
  const agreed = agreedVoters({ ...listing, voters });

  return (
    <>
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
              voters={voters}
              total={voteCount}
              online={listing.votersOnline}
              onOpen={() => setSheet("view")}
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

        {listing.detail && (
          <p className="mt-3 rounded-[12px] border border-line-soft bg-surface px-3 py-2.5 text-[0.875rem] leading-relaxed text-ink">
            {listing.detail}
          </p>
        )}

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

        {/* ---- who is going, once the poster has chosen ---- */}
        {picked.length > 0 && (
          <div className="mt-3 rounded-[12px] border border-line-soft bg-surface p-3">
            <p className="mb-2 font-mono text-[0.5625rem] font-medium tracking-[0.1em] text-ink-faint">
              {stage === "locked" ? "GOING" : "ASKED TO JOIN"}
              {" · "}
              <span className="text-mint">{agreed.length} IN</span>
            </p>
            <ul className="grid gap-2">
              {picked.map((v) => (
                <li key={v.username} className="flex items-center gap-2.5">
                  <Face voter={v} size={26} />
                  <span className="min-w-0 flex-1 truncate text-[0.875rem] font-semibold text-ink">
                    {v.username}
                  </span>
                  <ReplyMark reply={v.reply} />
                </li>
              ))}
            </ul>
          </div>
        )}

        {/* ---- the one rule that matters on this tab ---- */}
        <p className="mt-3 text-[0.6875rem] leading-relaxed text-ink-faint">
          Play it yourself. Nobody should ever ask for your account, your password
          or your login — a run done on your account is not a service, it is how
          accounts get taken.
        </p>

        <div className="mt-3 flex flex-wrap items-center justify-between gap-2">
          <button
            type="button"
            onClick={toggleVote}
            disabled={state !== "live" || stage === "locked"}
            aria-pressed={voted}
            className={`pill flex items-center gap-1.5 py-1.5 text-[0.8125rem] disabled:opacity-50 ${
              voted ? "pill-mint" : "pill-ghost"
            }`}
          >
            <svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor"
                 strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <path d="M8 13.5V4M4.5 7.5 8 4l3.5 3.5" />
            </svg>
            {voted ? "You're in" : "I want in"}
            {voteCount > 0 && ` · ${voteCount}`}
          </button>
          <ReportButton what="listing" subject={`${listing.author} — ${headline}`} />
        </div>

        {/* ---- the thread, for people who put their hand up ---- */}
        {state === "live" && (
          <CommentThread
            comments={listing.comments}
            youVoted={voted}
            onVote={toggleVote}
          />
        )}

        {/* ---- the poster's own controls ---- */}
        {showOwnerControls && (
          <div className="mt-3 flex flex-wrap gap-2 border-t border-line-soft pt-3">
            {stage === "voting" && (
              <button
                type="button"
                onClick={() => setSheet("choose")}
                disabled={voteCount === 0}
                className="pill pill-mint py-2 text-[0.8125rem] disabled:opacity-40"
              >
                Choose who joins
              </button>
            )}
            {stage === "requested" && (
              <>
                <button
                  type="button"
                  onClick={() => setSheet("choose")}
                  className="pill pill-ghost py-2 text-[0.8125rem]"
                >
                  Ask more people
                </button>
                <button
                  type="button"
                  onClick={() => setStage("locked")}
                  disabled={agreed.length === 0}
                  className="pill pill-mint py-2 text-[0.8125rem] disabled:opacity-40"
                  title={
                    agreed.length === 0
                      ? "Nobody has said yes yet"
                      : `Lock it in with ${agreed.length}`
                  }
                >
                  Lock it in{agreed.length > 0 && ` · ${agreed.length}`}
                </button>
              </>
            )}
            {stage === "locked" && (
              <p className="text-[0.8125rem] font-semibold text-mint">
                Locked in with {agreed.length}. This closes when the two hours are up.
              </p>
            )}
            <button
              type="button"
              className="pill py-2 text-[0.8125rem] text-bad"
              style={{ borderColor: "currentColor" }}
            >
              Delete
            </button>
          </div>
        )}
      </div>
    </details>

    {/* Outside the <details> on purpose. A closed details hides everything but
        its summary, and the face stack that opens this sits in the summary — so
        rendering the sheet inside would make it invisible exactly when it is
        most likely to be opened. */}
    {sheet && (
      <VotersSheet
        voters={voters}
        total={voteCount}
        title={sheet === "choose" ? "Choose who joins" : "Everyone who wants in"}
        onSendRequest={sheet === "choose" ? sendRequest : undefined}
        onClose={() => setSheet(null)}
      />
    )}
    </>
  );
}
