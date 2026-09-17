import {
  PAID_LINK_DISCLOSURE,
  PLAIN_LINK_NOTE,
  VALUES_POLICY,
  valuesLink,
} from "@/lib/referrals";

/**
 * Where a player goes to find out what something is worth.
 *
 * ---------------------------------------------------------------------------
 * Why this is a card and not an apology
 * ---------------------------------------------------------------------------
 *
 * This block replaced a value table and a W/F/L calculator that MintPlaza used
 * to run itself. The first draft of the replacement read like a confession —
 * "no published value for this", "we could not price this side" — which is what
 * you write when you think of the missing calculator as a hole. It is not a
 * hole. Nobody needs a seventh value list; they need the one their community
 * already quotes, and being sent straight to it is a better answer than a
 * number MintPlaza read off that same site three weeks ago.
 *
 * So the card is written as a destination, not a shortfall. It names the site,
 * it says whose numbers they are, and where the partner has a real calculator
 * it offers that separately, because "what is this worth" and "is this trade
 * fair" are two different questions and landing on the wrong page costs the
 * player a search.
 *
 * The commercial arrangement rides on exactly this component, which is why the
 * disclosure is not optional and why it changes wording depending on whether
 * the link is actually paid. See referrals.ts.
 */
export function ValuesCard({
  gameSlug,
  compact,
  /** Shown above the buttons on the full card. Defaults to the policy line. */
  lead,
}: {
  gameSlug: string;
  compact?: boolean;
  lead?: string;
}) {
  const values = valuesLink(gameSlug, "values");
  const calculator = valuesLink(gameSlug, "calculator");

  // Only reachable for a slug that is not on the roster, which the proof script
  // makes impossible for a real game. Rendering nothing beats rendering a
  // broken link.
  if (!values) return null;

  const disclosure = values.paid ? PAID_LINK_DISCLOSURE : PLAIN_LINK_NOTE;

  // Inside a listing card there is no room for a heading and a policy
  // paragraph, and the player is mid-decision rather than browsing. One line,
  // one button, straight to the calculator where there is one.
  if (compact) {
    const primary = values.hasCalculator ? calculator! : values;
    return (
      <div className="border-t border-line pt-2.5">
        <a
          href={primary.href}
          target="_blank"
          rel="noopener noreferrer nofollow sponsored"
          className="pill pill-ghost inline-flex py-1.5 text-[0.8125rem]"
        >
          {values.hasCalculator ? "Check W/F/L" : "Check values"} on {primary.provider} →
        </a>
        <p className="mt-1.5 text-[0.625rem] leading-relaxed text-ink-faint">
          {disclosure}
        </p>
      </div>
    );
  }

  return (
    <div className="rounded-[12px] border border-line bg-fill px-3 py-2.5">
      <p className="text-[0.8125rem] font-semibold text-ink">
        Values &amp; W/F/L for this game
      </p>
      <p className="mt-1 text-[0.6875rem] leading-relaxed text-ink-faint">
        {lead ?? VALUES_POLICY}
      </p>

      <div className="mt-2 flex flex-wrap gap-1.5">
        <a
          href={values.href}
          target="_blank"
          rel="noopener noreferrer nofollow sponsored"
          className="pill pill-ghost inline-flex py-1.5 text-[0.8125rem]"
        >
          {values.provider} value list →
        </a>
        {values.hasCalculator && calculator && (
          <a
            href={calculator.href}
            target="_blank"
            rel="noopener noreferrer nofollow sponsored"
            className="pill pill-ghost inline-flex py-1.5 text-[0.8125rem]"
          >
            W/F/L calculator →
          </a>
        )}
      </div>

      <p className="mt-1.5 text-[0.625rem] leading-relaxed text-ink-faint">
        {disclosure}
      </p>
    </div>
  );
}
