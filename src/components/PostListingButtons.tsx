"use client";

import { useState } from "react";
import { PostListing } from "./PostListing";
import { LIVE_PER_GAME, type Section } from "@/lib/sessions";

/**
 * The two ways in, the form they open, and how many posts you have left.
 *
 * The count is the whole reason this takes a prop. Posting a crew call used to
 * change nothing on the screen: the only meter on the game page counts TRADE
 * slots, and a crew call does not spend one — so the number sat at three while
 * the board filled up, and the limit announced itself as an error on the fourth
 * attempt. A limit nobody can see is a trap, not a limit.
 */
export function PostListingButtons({
  gameSlug, gameName, section = "services", liveOwn = 0,
}: {
  gameSlug: string;
  gameName: string;
  section?: Section;
  /** How many live posts this player already has on this game, both boards. */
  liveOwn?: number;
}) {
  const [open, setOpen] = useState<null | "request" | "offer">(null);
  const left = Math.max(0, LIVE_PER_GAME - liveOwn);
  const full = left === 0;

  return (
    <>
      {/* Recruitment has one direction only.
          A crew call is not two-sided the way a favour is: the person who posts
          is the person starting it, and everybody else answers by voting. An
          "I'll join" post would be somebody advertising availability into the
          void with no raid attached — a post nobody can act on. */}
      <div className="flex flex-wrap items-center gap-2">
        <span
          className={`font-mono text-[0.5625rem] tracking-[0.08em] ${
            full ? "text-bad" : "text-ink-faint"
          }`}
        >
          {full
            ? `ALL ${LIVE_PER_GAME} POSTS UP — TAKE ONE DOWN`
            : `${left} OF ${LIVE_PER_GAME} LEFT`}
        </span>
        {section === "recruit" ? (
          <button type="button" onClick={() => setOpen("request")} disabled={full}
                  title={full ? `You already have ${LIVE_PER_GAME} posts up on this game.` : undefined}
                  className="pill pill-mint py-2.5 text-[0.8125rem] disabled:opacity-40">
            Start a crew
          </button>
        ) : (
          <>
            <button type="button" onClick={() => setOpen("request")} disabled={full}
                    title={full ? `You already have ${LIVE_PER_GAME} posts up on this game.` : undefined}
                    className="pill pill-ghost py-2.5 text-[0.8125rem] disabled:opacity-40">
              I need help
            </button>
            <button type="button" onClick={() => setOpen("offer")} disabled={full}
                    title={full ? `You already have ${LIVE_PER_GAME} posts up on this game.` : undefined}
                    className="pill pill-mint py-2.5 text-[0.8125rem] disabled:opacity-40">
              I can help
            </button>
          </>
        )}
      </div>
      {open && (
        <PostListing gameSlug={gameSlug} gameName={gameName} section={section}
                     onClose={() => setOpen(null)} />
      )}
    </>
  );
}
