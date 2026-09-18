import Link from "next/link";
import type { LevelUpStatus } from "@/lib/level-up";

/**
 * The Level Up card.
 *
 * Same component on the game home and in Settings, because the two would drift
 * otherwise and the one that drifted would be the one quoting the wrong price.
 *
 * ---------------------------------------------------------------------------
 * Three states, and the middle one is the one most sites get wrong
 * ---------------------------------------------------------------------------
 *
 *   SUBSCRIBED  — say what they have and when it ends. No upsell. Somebody who
 *                 has already paid does not need selling to, and a card that
 *                 keeps advertising at them reads as a site that has not
 *                 noticed.
 *
 *   LAPSED      — "it ran out on the 3rd" is a different sentence from "you
 *                 have never had this", and a player who paid once deserves the
 *                 first one. Quietly demoting them to the sales pitch is how a
 *                 site loses the customer it already had.
 *
 *   NEVER HAD IT — the pitch, with the price behind a country question rather
 *                 than in front of it, because there is no single right number
 *                 to print until the country is known.
 *
 * ---------------------------------------------------------------------------
 * What this card does NOT do
 * ---------------------------------------------------------------------------
 *
 * It does not name a price. Not "from ₹399", not "$6", not "starting at". The
 * price depends on where the player is, that is asked on the next screen, and a
 * teaser number here would be wrong for most of the people who read it — which
 * is a bad way to start a transaction. The button says what it costs to find
 * out: one tap.
 */
export function LevelUpCard({
  status,
  compact,
}: {
  status: LevelUpStatus;
  /** For the game sidebar, where the full pitch would crowd everything else. */
  compact?: boolean;
}) {
  if (status.active) {
    return (
      <div className="rounded-[var(--radius-panel)] border border-mint/30 bg-mint-wash px-4 py-3.5">
        <p className="text-[0.875rem] font-bold tracking-[-0.015em] text-ink">
          Level Up is on
        </p>
        <p className="mt-1.5 text-[0.75rem] leading-relaxed text-ink-mute">
          {status.daysLeft !== null && status.daysLeft > 0
            ? `${status.daysLeft} ${status.daysLeft === 1 ? "day" : "days"} left.`
            : "Active."}{" "}
          {status.expiresAt && `Ends ${formatDate(status.expiresAt)}.`}
        </p>
        <Link
          href="/upgrade"
          className="mt-2.5 inline-flex text-[0.75rem] font-semibold text-mint hover:underline"
        >
          What it gets you →
        </Link>
      </div>
    );
  }

  return (
    <div className="glass-quiet rounded-[var(--radius-panel)] px-4 py-3.5">
      <p className="text-[0.875rem] font-bold tracking-[-0.015em] text-ink">
        {status.lapsed ? "Level Up has ended" : "Level Up"}
      </p>

      <p className="mt-1.5 text-[0.75rem] leading-relaxed text-ink-mute">
        {status.lapsed ? (
          <>
            It ran out{status.expiresAt ? ` on ${formatDate(status.expiresAt)}` : ""}, so
            you are back on the free limits. Starting again picks up from today.
          </>
        ) : compact ? (
          <>Ten listings up at once instead of three, each lasting three days instead of one.</>
        ) : (
          <>
              60 days of more room on the board: ten listings up at once in a
            game instead of three, and each one lasting three days instead of a
            day.
          </>
        )}
      </p>

      <Link
        href="/upgrade"
        className="pill pill-mint mt-2.5 inline-flex py-1.5 text-[0.8125rem]"
      >
        {status.lapsed ? "Start it again" : "See what it costs"}
      </Link>
    </div>
  );
}

/**
 * There is no Level Up mark, and there will not be one.
 *
 * There was: a small chevron beside a paying player's name. It is gone because
 * on a site where strangers hand each other items worth months of grinding, a
 * mark you can buy for ₹399 is worth more to a scammer than to anybody honest.
 * They would be first in the queue, and the small print underneath saying it is
 * not a safety check does nothing about what it looks like at a glance.
 *
 * Level Up buys room on the board. It does not buy a way to look trustworthy.
 */

function formatDate(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  return d.toLocaleDateString(undefined, { day: "numeric", month: "long" });
}
