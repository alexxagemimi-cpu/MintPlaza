"use client";

import { useState, useTransition } from "react";
import { submitReport } from "@/lib/actions/board";

/**
 * Report something, or someone.
 *
 * Put wherever the thing being reported is, rather than buried in a settings
 * page: next to a comment, on a profile, on a listing. Somebody who has just
 * read something wrong should not have to go looking — the moment they have to
 * hunt for it is the moment they give up and the behaviour goes unreported.
 *
 * The reasons are a fixed list because free text alone is unsortable, and the
 * two that matter most on this site sit at the top: asking for an account, and
 * asking for real money. Both are outright banned, and both are how players
 * actually get hurt here.
 */

const REASONS = [
  "Asked for my account or password",
  "Asked for real money",
  "Took the items and left",
  "Abusive or threatening",
  "Scam or fake offer",
  "Something else",
] as const;

export function ReportButton({
  what,
  subject,
  subjectId,
  compact = false,
}: {
  /** What is being reported. */
  what: "comment" | "listing" | "player";
  /** Who or what it belongs to, shown back so the reporter is sure. */
  subject: string;
  /** What the report points at. Falls back to the subject text. */
  subjectId?: string;
  compact?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const [sent, setSent] = useState(false);
  const [, start] = useTransition();

  if (sent) {
    return (
      <span className="font-mono text-[0.5625rem] tracking-[0.07em] text-ink-faint">
        REPORTED
      </span>
    );
  }

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className={
          compact
            ? "font-semibold text-ink-faint transition-colors hover:text-bad"
            : "pill pill-ghost py-1.5 text-[0.8125rem] text-ink-mute"
        }
      >
        Report
      </button>

      {open && (
        <div
          className="fixed inset-0 z-[80] grid place-items-end sm:place-items-center"
          role="dialog"
          aria-modal="true"
          aria-label={`Report this ${what}`}
        >
          <button
            type="button"
            aria-label="Close"
            onClick={() => setOpen(false)}
            className="absolute inset-0 bg-ink/30"
          />
          <div className="glass-overlay relative w-full max-w-sm rounded-t-[var(--radius-panel)] p-5 sm:rounded-[var(--radius-panel)]">
            <div className="mb-1 flex items-start justify-between gap-3">
              <h2 className="text-[1.0625rem] font-bold tracking-[-0.025em] text-ink">
                Report this {what}
              </h2>
              <button
                type="button"
                onClick={() => setOpen(false)}
                aria-label="Close"
                className="grid h-8 w-8 shrink-0 place-items-center rounded-full border border-line text-ink-mute"
              >
                <svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor"
                     strokeWidth="2" strokeLinecap="round" aria-hidden="true">
                  <path d="M4 4l8 8M12 4l-8 8" />
                </svg>
              </button>
            </div>
            <p className="mb-4 text-[0.875rem] text-ink-mute">{subject}</p>

            <ul className="grid gap-1.5">
              {REASONS.map((r) => (
                <li key={r}>
                  <button
                    type="button"
                    onClick={() => {
                      // Marked sent straight away and never un-marked. A
                      // reporter must not be able to learn anything from what
                      // happens next, including whether it saved.
                      setSent(true);
                      setOpen(false);
                      start(async () => {
                        await submitReport(what, subjectId ?? subject, r);
                      });
                    }}
                    className="w-full rounded-[12px] border border-line bg-surface px-3 py-3 text-left text-[0.9375rem] font-semibold text-ink transition-colors hover:border-bad hover:text-bad"
                  >
                    {r}
                  </button>
                </li>
              ))}
            </ul>

            <p className="mt-3 text-[0.75rem] leading-relaxed text-ink-faint">
              Nobody on MintPlaza will ever need your account, your password or
              your login. If somebody asks, report it — that is the one thing we
              most want to know about.
            </p>
          </div>
        </div>
      )}
    </>
  );
}
