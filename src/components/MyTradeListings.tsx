"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import type { BoardListing } from "@/lib/match";
import { bumpTradeListing, cancelTradeListing } from "@/lib/actions/trades";

/**
 * Your own listings, with the two things you can do to them.
 *
 * Bump is offered only when the database says it is allowed — the RPC refuses a
 * second lift inside twenty-four hours, and a button that looks live and then
 * fails teaches people to distrust every other button on the page. `bumpable`
 * is computed server-side on the row itself, so what the button shows and what
 * the database will accept are the same fact.
 */
export function MyTradeListings({
  gameSlug,
  listings,
}: {
  gameSlug: string;
  listings: readonly BoardListing[];
}) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  if (listings.length === 0) return null;

  function act(fn: () => Promise<{ ok: boolean; error?: string }>) {
    setError(null);
    startTransition(async () => {
      const result = await fn();
      if (!result.ok) setError(result.error ?? "That did not work.");
      else router.refresh();
    });
  }

  return (
    <section className="glass rounded-[var(--radius-panel)] p-5">
      <div className="mb-1 flex items-baseline justify-between gap-3">
        <h2 className="text-[1.0625rem] font-bold tracking-[-0.025em] text-ink">
          On the board
        </h2>
        <span className="font-mono text-[0.625rem] tracking-[0.08em] text-ink-faint">
          {listings.length}
        </span>
      </div>
      <p className="mb-4 text-[0.8125rem] text-ink-mute">
        Your active listings, as other players see them.
      </p>

      {error && (
        <p role="alert" className="mb-3 rounded-[var(--radius-inner)] border border-bad/30 bg-bad/[0.06] px-3 py-2 text-[0.8125rem] text-bad">
          {error}
        </p>
      )}

      <ul className="space-y-2">
        {listings.map((l) => (
          <li key={l.id} className="rounded-[var(--radius-inner)] border border-line-soft bg-surface p-3">
            <p className="text-[0.8125rem] font-semibold leading-snug text-ink">
              {l.offering.map((e) => e.item.name).join(", ")}
              <span className="mx-1.5 text-ink-faint" aria-hidden="true">
                →
              </span>
              <span className="text-ink-soft">
                {l.wanting.length > 0
                  ? l.wanting.map((e) => e.item.name).join(", ")
                  : "open to offers"}
              </span>
            </p>

            <div className="mt-2.5 flex items-center gap-2">
              <span className="font-mono text-[0.625rem] tracking-[0.07em] text-ink-faint">
                {daysLeft(l.expiresAt)}
              </span>
              <span className="ml-auto flex gap-1.5">
                <button
                  type="button"
                  disabled={pending || !l.bumpable}
                  onClick={() => act(() => bumpTradeListing(gameSlug, l.id))}
                  title={l.bumpable ? "Move it back to the top" : "One lift a day"}
                  className="pill pill-ghost py-1 text-[0.6875rem] disabled:opacity-35"
                >
                  Lift
                </button>
                <button
                  type="button"
                  disabled={pending}
                  onClick={() => act(() => cancelTradeListing(gameSlug, l.id))}
                  className="pill pill-ghost py-1 text-[0.6875rem] hover:border-bad hover:text-bad disabled:opacity-50"
                >
                  Take down
                </button>
              </span>
            </div>
          </li>
        ))}
      </ul>
    </section>
  );
}

function daysLeft(iso: string): string {
  const ms = new Date(iso).getTime() - Date.now();
  if (ms <= 0) return "EXPIRED";
  const days = Math.floor(ms / 86_400_000);
  if (days >= 1) return `${days}D LEFT`;
  return `${Math.max(1, Math.floor(ms / 3_600_000))}H LEFT`;
}
