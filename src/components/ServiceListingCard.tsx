"use client";

import { useState, useTransition } from "react";
import { findItem } from "@/lib/items";
import {
  findService, findRef, listingState, timeLeftCopy, expiresAt,
  pickedVoters, agreedVoters, votingFull,
  type ServiceListing, type Voter,
} from "@/lib/sessions";
import { VoterStack, OnlineDot } from "./VoterStack";
import { LiveCountdown } from "./LiveCountdown";
import { VotersSheet, ReplyMark, Face } from "./VotersSheet";
import { CommentThread } from "./CommentThread";
import { ReportButton } from "./ReportButton";
import { RefTile } from "./RefTile";
import { ServiceArt } from "./ServiceArt";
import { toggleVote, sendRequest, lockIn, deleteListing } from "@/lib/actions/board";

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
  const [error, setError] = useState<string | null>(null);
  const [busy, start] = useTransition();

  const reference = findRef(listing.serviceIds, listing.refId);

  const services = listing.serviceIds
    .map(findService)
    .filter((s): s is NonNullable<typeof s> => Boolean(s));

  // A listing can name a template that no longer exists — removed from the
  // catalogue while it was up. Rendering nothing would be worse than rendering
  // something plain: the post still holds one of the author's three live slots
  // and still collects votes, so it has to stay visible and deletable rather
  // than becoming an invisible row only the database knows about.
  const orphaned = services.length === 0;

  const state = listingState(listing);
  const isOffer = listing.side === "offer";
  // A crew call is not a favour, so it does not get the favour's vocabulary:
  // nobody on the recruitment board is helping anybody, they are turning up.
  const recruiting = services[0]?.section === "recruit";
  const headline = orphaned
    ? "No longer listed"
    : isOffer
      ? services.length === 1
        ? services[0].name
        : `${services[0].name} + ${services.length - 1} more`
      : services[0].name;

  const termsItem =
    listing.terms.kind === "item" ? findItem(listing.terms.itemId) : undefined;

  /**
   * Vote, or take it back.
   *
   * The screen moves first and rolls back if the server says no. On a board
   * where a raid is starting in ten minutes, a button that waits on a round
   * trip before acknowledging a tap feels broken — but a button that lies is
   * worse, so a refusal puts it straight back and says why.
   */
  function onVote() {
    if (busy) return;
    const was = voted;
    setError(null);
    setVoted(!was);
    setVoteCount((n) => n + (was ? -1 : 1));

    // Example listings have no row behind them, so there is nothing to save.
    // They still behave, because the point of example content is to show how
    // the thing works — but they never pretend to have reached a server.
    if (listing.isDemo) return;

    start(async () => {
      const result = await toggleVote(listing.id);
      if (!result.ok) {
        setVoted(was);
        setVoteCount((n) => n + (was ? 1 : -1));
        setError(result.error);
      }
    });
  }

  /** The poster picked a team and asked them. */
  function onSendRequest(chosen: string[]) {
    setSheet(null);
    setError(null);
    const before = voters;
    setVoters((prev) =>
      prev.map((v) =>
        chosen.includes(v.username) ? { ...v, reply: "waiting" as const } : v,
      ),
    );
    setStage("requested");
    if (listing.isDemo) return;

    start(async () => {
      const result = await sendRequest(listing.id, chosen);
      if (!result.ok) { setVoters(before); setStage(listing.stage); setError(result.error); }
    });
  }

  function onLockIn() {
    setError(null);
    const before = stage;
    setStage("locked");
    if (listing.isDemo) return;
    start(async () => {
      const result = await lockIn(listing.id);
      if (!result.ok) { setStage(before); setError(result.error); }
    });
  }

  function onDelete() {
    setError(null);
    if (listing.isDemo) return;
    start(async () => {
      const result = await deleteListing(listing.id);
      if (!result.ok) setError(result.error);
    });
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
        {/* What this post is about, ranked by what identifies it fastest.
            A reference picture first, because a V3 listing is a different job
            for an Angel than for a Ghoul. Then, on a crew call, the raid
            itself: nobody joins the Leviathan because of who posted it, and
            the silhouette is recognised before the words are read. Only on the
            services board does the poster lead, because there the question
            genuinely is who is offering. */}
        {reference ? (
          <RefTile item={reference} size={34} />
        ) : recruiting && services[0] ? (
          <ServiceArt service={services[0]} size={44} rounded={11} />
        ) : (
          <Avatar name={listing.author} url={listing.authorAvatarUrl} />
        )}

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
            {/* A crew call reads as its own kind of thing: red rather than the
                services board's amber, and the crew size on the badge, because
                "needs 5" is the single fact that decides whether somebody
                scrolling can actually help. */}
            <span
              className="shrink-0 rounded-[5px] px-1.5 py-0.5 font-mono text-[0.5rem] font-bold tracking-[0.07em]"
              style={
                recruiting
                  ? { color: "#A93226", background: "#FBEDEB" }
                  : isOffer
                    ? { color: "#0B6157", background: "#DFF3F1" }
                    : { color: "#8A5A12", background: "#FBF1E0" }
              }
            >
              {recruiting
                ? `CREW OF ${services[0]?.players ?? "?"}`
                : isOffer ? "CAN HELP" : "NEEDS HELP"}
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
          {listing.isDemo && (
            <span className="rounded-[5px] border border-warn/30 bg-warn-wash px-1.5 py-0.5 font-mono text-[0.5rem] tracking-[0.07em] text-warn">
              DEMO
            </span>
          )}
        </p>

        {/* ---- what, with the game's own requirement on each ---- */}
        <p className="mb-2 font-mono text-[0.5625rem] font-medium tracking-[0.1em] text-ink-faint">
          {recruiting
            ? "GATHERING FOR"
            : isOffer ? "CAN RUN THESE" : "STUCK ON"}
        </p>
        {orphaned && (
          <p className="rounded-[12px] border border-dashed border-line bg-fill px-3 py-2.5 text-[0.8125rem] leading-relaxed text-ink-mute">
            What this post was about is no longer on the list. It will clear
            itself when the two hours are up, or you can delete it now.
          </p>
        )}
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

        {reference && (
          <p className="mt-3 flex items-center gap-2.5 rounded-[12px] border border-line-soft bg-fill px-3 py-2.5">
            <RefTile item={reference} size={32} />
            <span className="min-w-0">
              <span className="block font-mono text-[0.5625rem] tracking-[0.1em] text-ink-faint">
                ABOUT
              </span>
              <span className="block text-[0.875rem] font-bold text-ink">{reference.label}</span>
            </span>
          </p>
        )}

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
            onClick={onVote}
            disabled={
              state !== "live" || stage === "locked" ||
              // Full, and you are not already in it. Somebody who did get in
              // must still be able to take their hand back down.
              (!voted && votingFull({ ...listing, voteCount }))
            }
            aria-pressed={voted}
            className={`pill flex items-center gap-1.5 py-1.5 text-[0.8125rem] disabled:opacity-50 ${
              voted ? "pill-mint" : "pill-ghost"
            }`}
          >
            <svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor"
                 strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <path d="M8 13.5V4M4.5 7.5 8 4l3.5 3.5" />
            </svg>
            {voted
              ? "You're in"
              : votingFull({ ...listing, voteCount }) ? "Full" : "I want in"}
            {voteCount > 0 &&
              ` · ${voteCount}${listing.voteCap ? `/${listing.voteCap}` : ""}`}
          </button>
          <ReportButton what="listing" subject={`${listing.author} — ${headline}`} subjectId={listing.id} />
        </div>

        {error && (
          <p role="alert" className="mt-2 rounded-[10px] border border-bad/30 bg-bad-wash px-3 py-2 text-[0.8125rem] text-bad">
            {error}
          </p>
        )}

        {/* ---- the thread, for people who put their hand up ---- */}
        {state === "live" && (
          <CommentThread
            listingId={listing.id}
            isDemo={listing.isDemo}
            comments={listing.comments}
            youVoted={voted}
            onVote={onVote}
          />
        )}

        {/* ---- what the poster said their limits are ----

            "12 voted" means something completely different when ten will be
            taken than when one will, so the odds go on the card rather than
            leaving people to wait and find out. */}
        {(listing.slots || listing.voteCap) && (
          <p className="mt-2.5 flex flex-wrap items-center gap-x-3 gap-y-1 font-mono text-[0.5625rem] tracking-[0.08em] text-ink-faint">
            {listing.slots && (
              <span className="text-ink-mute">
                PICKING {listing.slots}
                {voteCount > 0 && ` OF ${voteCount}`}
              </span>
            )}
            {listing.voteCap && (
              <span>
                {votingFull({ ...listing, voteCount })
                  ? "VOTING CLOSED"
                  : `${listing.voteCap - voteCount} SPOT${
                      listing.voteCap - voteCount === 1 ? "" : "S"
                    } LEFT`}
              </span>
            )}
          </p>
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
                  onClick={onLockIn}
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
              onClick={onDelete}
              disabled={busy}
              className="pill py-2 text-[0.8125rem] text-bad disabled:opacity-50"
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
        onSendRequest={sheet === "choose" ? onSendRequest : undefined}
        onClose={() => setSheet(null)}
      />
    )}
    </>
  );
}
