"use client";

import Link from "next/link";
import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { acceptTerms } from "@/lib/actions/terms";
import { TERMS_EFFECTIVE } from "@/lib/legal";

/**
 * The tick box that has to be ticked.
 *
 * ---------------------------------------------------------------------------
 * Why this is a blocking screen and not a banner
 * ---------------------------------------------------------------------------
 *
 * A dismissible bar saying "by continuing you agree" records nothing and
 * proves nothing. The point of this screen is that the only way past it is a
 * deliberate act — reading two links, ticking a box, pressing a button — which
 * is what makes the record in the database mean something later.
 *
 * It is shown to signed-in players only. A visitor reading the board has not
 * been asked for anything and is not asked to agree to anything.
 *
 * ---------------------------------------------------------------------------
 * Three things it deliberately does
 * ---------------------------------------------------------------------------
 *
 * It states the three rules that matter most in the words they are written in,
 * rather than burying everything behind a link. Somebody who reads only this
 * screen still learns the things that will actually hurt them.
 *
 * It says the age rule out loud, because a site whose age limit is only in
 * clause 3 of a document nobody opened does not really have one.
 *
 * It offers a way OUT — signing out — as a real choice next to the button.
 * Consent that has no refusal option is not consent, it is a door.
 */
export function TermsGate({ username }: { username: string }) {
  const router = useRouter();
  const [ticked, setTicked] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [busy, start] = useTransition();

  return (
    <div className="fixed inset-0 z-[80] grid place-items-center overflow-y-auto bg-bg/95 p-4 backdrop-blur">
      <div className="glass w-full max-w-lg rounded-[var(--radius-panel)] p-6 sm:p-8">
        <p className="label">Before you start</p>
        <h1 className="mt-2 text-[1.375rem] font-bold tracking-[-0.03em] text-ink">
          Hi {username} — three things, then you&rsquo;re in
        </h1>

        <ul className="mt-4 space-y-3 text-[0.9375rem] leading-relaxed text-ink-soft">
          <li className="flex gap-2.5">
            <span aria-hidden="true" className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-mint" />
            <span>
              <strong className="font-semibold text-ink">MintPlaza is not part of your trade.</strong>{" "}
              Trades happen inside the game, between you and the other player. We
              never hold your items and cannot get anything back if it goes wrong.
            </span>
          </li>
          <li className="flex gap-2.5">
            <span aria-hidden="true" className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-mint" />
            <span>
              <strong className="font-semibold text-ink">Never swap game things for real money.</strong>{" "}
              No cash, no gift cards, no accounts. Roblox permanently bans people
              for it, and we remove them.
            </span>
          </li>
          <li className="flex gap-2.5">
            <span aria-hidden="true" className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-mint" />
            <span>
              <strong className="font-semibold text-ink">Nobody here will ever ask for your password</strong>{" "}
              or a one-time code. Anybody who does is stealing from you — report
              them.
            </span>
          </li>
        </ul>

        <label className="mt-6 flex cursor-pointer items-start gap-3 rounded-[var(--radius-inner)] border border-line bg-fill px-4 py-3">
          <input
            type="checkbox"
            checked={ticked}
            onChange={(e) => setTicked(e.target.checked)}
            className="mt-0.5 h-4 w-4 shrink-0 accent-[var(--color-mint)]"
          />
          <span className="text-[0.875rem] leading-relaxed text-ink-soft">
            I am <strong className="font-semibold text-ink">13 or older</strong>, and
            I agree to the{" "}
            <Link href="/terms" target="_blank" rel="noopener noreferrer" className="font-semibold underline">
              Terms of Service
            </Link>{" "}
            and{" "}
            <Link href="/privacy" target="_blank" rel="noopener noreferrer" className="font-semibold underline">
              Privacy Policy
            </Link>{" "}
            ({TERMS_EFFECTIVE}). If I am under 18, a parent or guardian knows I
            use this site.
          </span>
        </label>

        {error && (
          <p role="alert" className="mt-3 rounded-[10px] border border-bad/30 bg-bad-wash px-3 py-2 text-[0.8125rem] text-bad">
            {error}
          </p>
        )}

        <div className="mt-5 flex flex-wrap items-center gap-3">
          <button
            type="button"
            disabled={!ticked || busy}
            onClick={() => {
              setError(null);
              start(async () => {
                const result = await acceptTerms();
                if (!result.ok) {
                  setError(result.error ?? "That did not save.");
                  return;
                }
                router.refresh();
              });
            }}
            className="pill pill-mint py-2.5 text-[0.9375rem] disabled:opacity-40"
          >
            {busy ? "Saving…" : "Agree and continue"}
          </button>

          {/* Refusing has to be a real, visible option, or this is a door with
              a tick box on it rather than a choice. */}
          <Link
            href="/auth/signout"
            className="text-[0.8125rem] font-semibold text-ink-mute hover:text-ink"
          >
            No thanks — sign me out
          </Link>
        </div>
      </div>
    </div>
  );
}
