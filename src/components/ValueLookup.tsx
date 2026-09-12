import {
  PAID_LINK_DISCLOSURE,
  PLAIN_LINK_NOTE,
  referralFor,
  unpricedExplanation,
} from "@/lib/referrals";

/**
 * What to show where MintPlaza has no value.
 *
 * ---------------------------------------------------------------------------
 * Why an unpriced item gets a whole block instead of a dash
 * ---------------------------------------------------------------------------
 *
 * 10,117 of the catalogue's 10,191 rows have no published value, and that is
 * the honest state of these markets rather than a backlog: nobody prices ten
 * thousand items, and the sites that price any of them disagree on units and on
 * numbers. The calculator already refuses to guess — an unpriced item on either
 * side turns the verdict into "?" for the whole trade, which is the correct and
 * slightly infuriating answer.
 *
 * "Correct and infuriating" is where players leave. So the dead end gets a
 * door: name the items that could not be priced, say why, and hand off to the
 * site that might know. The verdict does not move. Nothing here is presented
 * as a value, because it is not one — it is a pointer to somebody else's
 * opinion, and it says so.
 *
 * The commercial arrangement rides on exactly this component and is the reason
 * it is worth building well rather than as a bare link. It is also why the
 * disclosure is not optional: see referrals.ts.
 */
export function ValueLookup({
  gameSlug,
  unpriced,
  itemId,
  compact,
}: {
  gameSlug: string;
  /** Names of the items that could not be priced. May be empty. */
  unpriced: readonly string[];
  /** Deep-links to one item, where the partner supports it. */
  itemId?: string;
  compact?: boolean;
}) {
  const referral = referralFor(gameSlug, itemId);

  // Repeats are common — the same fruit on both sides of a trade — and a list
  // that says "Kitsune, Kitsune, Leopard" reads like a bug.
  const names = Array.from(new Set(unpriced));

  return (
    // Compact drops the box entirely and separates with a rule instead. Inside
    // the catalogue footer this block already sits in a bordered panel, and a
    // bordered box inside a bordered box reads as a nesting mistake.
    <div
      className={
        compact
          ? "border-t border-line pt-2.5"
          : "rounded-[12px] border border-line bg-fill px-3 py-2.5"
      }
    >
      {names.length > 0 && (
        <p className="text-[0.8125rem] font-semibold text-ink">
          No published value for{" "}
          {names.length <= 3
            ? names.join(", ")
            : `${names.slice(0, 3).join(", ")} and ${names.length - 3} more`}
          .
        </p>
      )}

      <p className={`text-[0.6875rem] leading-relaxed text-ink-faint ${names.length ? "mt-1" : ""}`}>
        {unpricedExplanation(gameSlug, names.length)}
      </p>

      {referral.unavailable ? (
        <p className="mt-1.5 text-[0.6875rem] leading-relaxed text-ink-faint">
          {referral.unavailable}
        </p>
      ) : (
        <>
          <a
            href={referral.href}
            target="_blank"
            rel="noopener noreferrer nofollow sponsored"
            className="pill pill-ghost mt-2 inline-flex py-1.5 text-[0.8125rem]"
          >
            Check {referral.provider} →
          </a>
          <p className="mt-1.5 text-[0.625rem] leading-relaxed text-ink-faint">
            {referral.paid ? PAID_LINK_DISCLOSURE : PLAIN_LINK_NOTE}
          </p>
        </>
      )}
    </div>
  );
}
