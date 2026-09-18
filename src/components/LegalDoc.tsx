import Link from "next/link";
import { TERMS_EFFECTIVE, TERMS_VERSION } from "@/lib/legal";

/**
 * The shell both legal documents sit in.
 *
 * ---------------------------------------------------------------------------
 * Written to be read, which is not the usual goal
 * ---------------------------------------------------------------------------
 *
 * Most terms pages are written to be agreed to and never opened. These are
 * written to be read by fourteen-year-olds, because that is who uses this site,
 * and a rule somebody cannot understand is a rule that does not protect them or
 * the person who wrote it.
 *
 * So: short sentences, no Latin, no "heretofore", one idea per paragraph, and
 * every section headed with the question it answers rather than a noun. Where
 * a plain-English summary would be a simplification, the plain English IS the
 * term — there is no second, realer version of this document in smaller type.
 *
 * The version and date are shown at the top rather than the bottom. Somebody
 * checking whether these changed should not have to scroll to find out.
 */
export function LegalDoc({
  title,
  summary,
  children,
}: {
  title: string;
  /** The one-paragraph version, for somebody who will not read the rest. */
  summary: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <div className="mx-auto max-w-3xl px-5 py-10 sm:px-8 sm:py-14">
      <Link href="/app" className="text-[0.8125rem] font-semibold text-ink-mute hover:text-ink">
        ← Back to MintPlaza
      </Link>

      <h1 className="mt-5 text-[1.75rem] font-bold tracking-[-0.03em] text-ink">{title}</h1>
      <p className="mt-1.5 font-mono text-[0.6875rem] tracking-[0.07em] text-ink-faint">
        IN EFFECT {TERMS_EFFECTIVE.toUpperCase()} · VERSION {TERMS_VERSION}
      </p>

      <div className="glass-quiet measure mt-5 rounded-[var(--radius-panel)] px-4 py-3.5">
        <p className="text-[0.8125rem] font-semibold text-ink">The short version</p>
        <div className="mt-1.5 space-y-2 text-[0.875rem] leading-relaxed text-ink-mute">
          {summary}
        </div>
      </div>

      <div className="measure mt-8 space-y-8">{children}</div>

      <div className="mt-12 flex flex-wrap gap-4 border-t border-line-soft pt-5 text-[0.8125rem]">
        <Link href="/terms" className="font-semibold text-ink-mute hover:text-ink">Terms of Service</Link>
        <Link href="/privacy" className="font-semibold text-ink-mute hover:text-ink">Privacy Policy</Link>
        <Link href="/support" className="font-semibold text-ink-mute hover:text-ink">Contact</Link>
      </div>
    </div>
  );
}

/** One numbered section. The heading is a question wherever a question fits. */
export function Section({
  n,
  title,
  children,
}: {
  n: number;
  title: string;
  children: React.ReactNode;
}) {
  const id = `s${n}`;
  return (
    <section id={id} className="scroll-mt-6">
      <h2 className="text-[1.0625rem] font-bold tracking-[-0.02em] text-ink">
        <a href={`#${id}`} className="hover:text-mint">
          <span className="font-mono text-[0.8125rem] text-ink-faint">{n}. </span>
          {title}
        </a>
      </h2>
      <div className="mt-2 space-y-3 text-[0.9375rem] leading-relaxed text-ink-soft">
        {children}
      </div>
    </section>
  );
}

/**
 * A point that changes what somebody should do, drawn so it cannot be skimmed
 * past. Used sparingly — four of these read as urgent, twenty read as
 * decoration.
 */
export function Important({ children }: { children: React.ReactNode }) {
  return (
    <p className="rounded-[var(--radius-inner)] border border-warn/30 bg-warn-wash px-4 py-3 text-[0.875rem] leading-relaxed text-ink-soft">
      {children}
    </p>
  );
}
