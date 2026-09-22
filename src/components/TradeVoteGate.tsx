"use client";

import { useState, useTransition } from "react";
import { MessageButton } from "./MessageButton";
import { toggleTradeVote } from "@/lib/actions/trades";

/**
 * Put your hand up, then message.
 *
 * The card used to carry a Message button on its own. That made every trade a
 * private conversation the board never saw: a listing eleven people wanted
 * looked exactly like one nobody had touched, the poster had no idea anyone was
 * there until a DM arrived, and the whole thing worked like a Discord channel
 * with extra steps.
 *
 * Voting first fixes both halves. It is public, so the board shows interest.
 * It is cheap, so nobody has to open a conversation to signal it. And it gives
 * the poster a list of who is interested instead of an inbox.
 *
 * Messaging stays available immediately AFTER the vote rather than behind any
 * further step — the gate exists to make interest visible, not to slow anybody
 * down. One tap, then talk.
 */
export function TradeVoteGate({
  listingId, username, voteCount, youVoted, isDemo,
}: {
  listingId: string;
  username: string;
  voteCount: number;
  youVoted: boolean;
  /** Example rows have no listing behind them, so nothing is saved. */
  isDemo?: boolean;
}) {
  const [voted, setVoted] = useState(youVoted);
  const [count, setCount] = useState(voteCount);
  const [error, setError] = useState<string | null>(null);
  const [busy, start] = useTransition();

  function onVote() {
    if (busy) return;
    const was = voted;
    setError(null);
    // The screen moves first and rolls back if the server refuses. A button
    // that waits on a round trip before acknowledging a tap reads as broken.
    setVoted(!was);
    setCount((n) => n + (was ? -1 : 1));
    if (isDemo) return;

    start(async () => {
      const result = await toggleTradeVote(listingId);
      if (!result.ok) {
        setVoted(was);
        setCount((n) => n + (was ? 1 : -1));
        setError(result.error);
      }
    });
  }

  return (
    <div className="flex flex-col items-end gap-1.5">
      <div className="flex items-center gap-2">
        <button
          type="button"
          onClick={onVote}
          aria-pressed={voted}
          className={`pill flex items-center gap-1.5 py-1.5 text-[0.8125rem] ${
            voted ? "pill-mint" : "pill-ghost"
          }`}
        >
          <svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor"
               strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <path d="M8 13.5V4M4.5 7.5 8 4l3.5 3.5" />
          </svg>
          {voted ? "You're in" : "I want this"}
          {count > 0 && ` · ${count}`}
        </button>
        {/* Only after voting. Before it, the button is not hidden but absent —
            a greyed-out Message with no explanation reads as a broken card,
            and the line below says what to do instead. */}
        {voted && <MessageButton username={username} listingId={listingId} />}
      </div>

      {!voted && (
        <p className="text-right text-[0.6875rem] leading-snug text-ink-faint">
          Tap to say you want it. Messaging opens once you have.
        </p>
      )}

      {error && (
        <p role="alert" className="rounded-[10px] border border-bad/30 bg-bad-wash px-2.5 py-1.5 text-[0.75rem] text-bad">
          {error}
        </p>
      )}
    </div>
  );
}
