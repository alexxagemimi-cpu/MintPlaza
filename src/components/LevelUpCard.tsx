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
        <div className="flex items-center gap-2">
          <LevelUpMark />
          <p className="text-[0.875rem] font-bold tracking-[-0.015em] text-ink">
            Level Up is on
          </p>
        </div>
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
      <div className="flex items-center gap-2">
        <LevelUpMark muted />
        <p className="text-[0.875rem] font-bold tracking-[-0.015em] text-ink">
          {status.lapsed ? "Level Up has ended" : "Level Up"}
        </p>
      </div>

      <p className="mt-1.5 text-[0.75rem] leading-relaxed text-ink-mute">
        {status.lapsed ? (
          <>
            It ran out{status.expiresAt ? ` on ${formatDate(status.expiresAt)}` : ""}, so
            you are back on the free limits. Starting again picks up from today.
          </>
        ) : compact ? (
          <>Post more often, keep more listings up, and have them last three times as long.</>
        ) : (
          <>
            60 days of more room to trade: eight listing slots every three hours
            instead of three, twenty-five live listings per game instead of ten,
            listings that last 21 days instead of 7, and a bump every 8 hours
            instead of once a day.
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
 * The mark itself.
 *
 * Deliberately not a tick, not a shield, and not a badge with a check in it.
 * Every one of those shapes reads as "verified" at a glance, and on a site
 * where strangers hand each other valuable items, a mark that can be bought and
 * looks like a verification is worth more to a scammer than to anybody else.
 * An upward chevron says "more", which is what was actually sold.
 */
export function LevelUpMark({ muted, size = 16 }: { muted?: boolean; size?: number }) {
  return (
    <span
      aria-label="Level Up"
      title="Level Up — this player pays for MintPlaza. It is not a safety check."
      className={`grid shrink-0 place-items-center rounded-[5px] ${
        muted ? "bg-fill text-ink-mute" : "bg-mint text-white"
      }`}
      style={{ width: size, height: size }}
    >
      <svg
        width={size * 0.66} height={size * 0.66} viewBox="0 0 16 16" fill="none"
        stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round"
        aria-hidden="true"
      >
        <path d="M4 9.5 8 5.5l4 4" />
      </svg>
    </span>
  );
}

function formatDate(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  return d.toLocaleDateString(undefined, { day: "numeric", month: "long" });
}
