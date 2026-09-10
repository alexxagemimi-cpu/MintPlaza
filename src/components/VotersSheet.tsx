"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import type { Voter } from "@/lib/sessions";
import { MAX_TEAM } from "@/lib/sessions";
import { ReportButton } from "./ReportButton";

/**
 * Everyone who put their hand up.
 *
 * Opens from the face stack, which is a button rather than decoration — three
 * circles and "+141" is a summary, and the whole point of a summary is that
 * tapping it gets you the real thing.
 *
 * It does two jobs with one list. Anybody can open it to see who is interested.
 * The person who posted opens the same list to choose their team, and then the
 * rows grow a Select button. Two screens that differ by one column would be two
 * screens to keep in step, and this one never disagrees with itself.
 *
 * The action bar is pinned to the top, not the bottom. On a listing with a
 * hundred voters, a button under the last row is a button nobody reaches.
 */

export function Face({ voter, size = 34 }: { voter: Voter; size?: number }) {
  let h = 0;
  for (let i = 0; i < voter.username.length; i++) {
    h = (h * 31 + voter.username.charCodeAt(i)) % 360;
  }
  return (
    <span className="relative shrink-0">
      <span
        className="grid place-items-center overflow-hidden rounded-full font-bold"
        style={{
          width: size, height: size, fontSize: size * 0.32,
          color: `hsl(${h} 42% 30%)`,
          background: `hsl(${h} 46% 92%)`,
        }}
      >
        {voter.avatarUrl ? (
          /* eslint-disable-next-line @next/next/no-img-element */
          <img src={voter.avatarUrl} alt="" className="h-full w-full object-cover" />
        ) : (
          voter.username.slice(0, 2).toUpperCase()
        )}
      </span>
      {voter.online && (
        <span
          aria-hidden="true"
          className="absolute -bottom-px -right-px h-[9px] w-[9px] rounded-full bg-mint"
          style={{ boxShadow: "0 0 0 2px var(--surface)" }}
        />
      )}
    </span>
  );
}

const REPLY_MARK: Record<Voter["reply"], { label: string; fg: string; bg: string } | null> = {
  "not-picked": null,
  waiting: { label: "Waiting", fg: "#8A5A12", bg: "#FBF1E0" },
  agreed: { label: "In", fg: "#1F7A54", bg: "#E6F4EC" },
  denied: { label: "No", fg: "#A93226", bg: "#FBEDEB" },
};

/** A tick, a cross, or nothing yet — the end of a picked player's row. */
export function ReplyMark({ reply }: { reply: Voter["reply"] }) {
  if (reply === "not-picked") return null;
  if (reply === "waiting") {
    return (
      <span
        title="Waiting for their answer"
        className="grid h-6 w-6 shrink-0 place-items-center rounded-full border border-dashed border-line text-ink-faint"
      >
        <span className="h-1.5 w-1.5 rounded-full bg-current" />
      </span>
    );
  }
  const agreed = reply === "agreed";
  return (
    <span
      title={agreed ? "They said yes" : "They said no"}
      className="grid h-6 w-6 shrink-0 place-items-center rounded-full"
      style={{
        background: agreed ? "#E6F4EC" : "#FBEDEB",
        color: agreed ? "#1F7A54" : "#A93226",
      }}
    >
      <svg width="13" height="13" viewBox="0 0 16 16" fill="none" stroke="currentColor"
           strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
        {agreed ? <path d="M3.5 8.5 6.5 11.5l6-7" /> : <path d="M4 4l8 8M12 4l-8 8" />}
      </svg>
    </span>
  );
}

export function VotersSheet({
  voters,
  total,
  title,
  /** When set, rows can be selected and the poster can send a request. */
  onSendRequest,
  onClose,
}: {
  voters: readonly Voter[];
  total: number;
  title: string;
  onSendRequest?: (chosen: string[]) => void;
  onClose: () => void;
}) {
  const [chosen, setChosen] = useState<string[]>([]);
  const choosing = Boolean(onSendRequest);
  // Read off the URL rather than threaded down through three components: this
  // sheet is only ever open inside a game, and the alternative is a prop that
  // every card in between has to carry for one link at the bottom.
  const gameSlug = usePathname().split("/")[2] ?? "";
  const atLimit = chosen.length >= MAX_TEAM;

  const toggle = (name: string) =>
    setChosen((prev) =>
      prev.includes(name)
        ? prev.filter((n) => n !== name)
        : prev.length >= MAX_TEAM
          ? prev
          : [...prev, name],
    );

  return (
    <div
      className="fixed inset-0 z-[70] grid place-items-end sm:place-items-center"
      role="dialog"
      aria-modal="true"
      aria-label={title}
    >
      <button type="button" aria-label="Close" onClick={onClose}
              className="absolute inset-0 bg-ink/30" />

      <div className="glass-overlay relative flex max-h-[85vh] w-full max-w-md flex-col rounded-t-[var(--radius-panel)] sm:rounded-[var(--radius-panel)]">
        {/* ---- pinned head: title, close, and the action ---- */}
        <div className="shrink-0 border-b border-line-soft px-4 pb-3 pt-4">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <h2 className="text-[1.0625rem] font-bold tracking-[-0.025em] text-ink">
                {title}
              </h2>
              <p className="mt-0.5 font-mono text-[0.625rem] tracking-[0.07em] text-ink-faint">
                {total} VOTED
                {voters.length < total && ` · SHOWING ${voters.length}`}
                {choosing && ` · ${chosen.length} PICKED`}
              </p>
            </div>
            <button
              type="button" onClick={onClose} aria-label="Close"
              className="grid h-8 w-8 shrink-0 place-items-center rounded-full border border-line text-ink-mute"
            >
              <svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor"
                   strokeWidth="2" strokeLinecap="round" aria-hidden="true">
                <path d="M4 4l8 8M12 4l-8 8" />
              </svg>
            </button>
          </div>

          {/* Appears the moment one person is picked, and stays at the top so a
              hundred-voter list never means scrolling to the bottom to act. */}
          {choosing && chosen.length > 0 && (
            <button
              type="button"
              onClick={() => onSendRequest?.(chosen)}
              className="pill pill-mint mt-3 w-full py-2.5 text-[0.875rem]"
            >
              Send request to {chosen.length}{" "}
              {chosen.length === 1 ? "player" : "players"}
            </button>
          )}
          {choosing && atLimit && (
            <p className="mt-2 text-[0.75rem] text-warn">
              That is the most you can pick for one deal.
            </p>
          )}
        </div>

        {/* ---- the list ---- */}
        <ul className="min-h-0 flex-1 overflow-y-auto p-3">
          {voters.map((v) => {
            const mark = REPLY_MARK[v.reply];
            const isChosen = chosen.includes(v.username);
            return (
              <li
                key={v.username}
                className="flex items-center gap-3 rounded-[12px] px-2 py-2.5"
              >
                <Face voter={v} />
                <span className="min-w-0 flex-1">
                  {/* The name is the way in to the profile. This is the moment
                      proofs are actually worth something: somebody about to
                      hand a fruit to a stranger, deciding. */}
                  {gameSlug ? (
                    <Link
                      href={`/app/${gameSlug}/profile/${encodeURIComponent(v.username)}`}
                      className="block truncate text-[0.9375rem] font-bold tracking-[-0.015em] text-ink hover:underline"
                    >
                      {v.username}
                    </Link>
                  ) : (
                    <span className="block truncate text-[0.9375rem] font-bold tracking-[-0.015em] text-ink">
                      {v.username}
                    </span>
                  )}
                  <span className="flex flex-wrap items-center gap-1.5 font-mono text-[0.5625rem] tracking-[0.07em]">
                    {v.online ? (
                      <span className="text-mint">ONLINE NOW</span>
                    ) : (
                      <span className="text-ink-faint">
                        VOTED {v.votedMinutesAgo}M AGO
                      </span>
                    )}
                    {mark && (
                      <span
                        className="rounded-[5px] px-1.5 py-0.5"
                        style={{ color: mark.fg, background: mark.bg }}
                      >
                        {mark.label.toUpperCase()}
                      </span>
                    )}
                    <ReportButton what="player" subject={v.username} subjectId={v.userId} compact />
                  </span>
                </span>

                {choosing ? (
                  <button
                    type="button"
                    onClick={() => toggle(v.username)}
                    aria-pressed={isChosen}
                    disabled={!isChosen && atLimit}
                    className={`pill shrink-0 py-1.5 text-[0.8125rem] disabled:opacity-40 ${
                      isChosen ? "pill-mint" : "pill-ghost"
                    }`}
                  >
                    {isChosen ? "Picked" : "Select"}
                  </button>
                ) : (
                  <ReplyMark reply={v.reply} />
                )}
              </li>
            );
          })}
        </ul>
      </div>
    </div>
  );
}
