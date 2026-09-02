import Link from "next/link";

/**
 * An honest placeholder for a surface that is planned but not built.
 *
 * Preferred over an empty page or a fake one: it says what will be here and
 * where it sits in the build, so nothing on the site pretends to work.
 */
export function NotBuiltYet({
  title,
  step,
  children,
  backHref,
  backLabel,
}: {
  title: string;
  step: string;
  children: React.ReactNode;
  backHref: string;
  backLabel: string;
}) {
  return (
    <div className="mx-auto max-w-2xl px-5 py-20 sm:px-8 sm:py-28">
      <div className="glass rounded-[var(--radius-panel)] p-7 sm:p-10">
        <span className="label">Build step {step}</span>
        <h1 className="display mt-4 text-[1.75rem] sm:text-[2.1rem]">{title}</h1>
        <div className="mt-4 space-y-3 text-[0.9375rem] leading-relaxed text-ink-soft">
          {children}
        </div>
        <Link href={backHref} className="pill pill-ghost mt-8 py-2.5">
          <svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
            <path d="M10 3.5 5.5 8l4.5 4.5" />
          </svg>
          {backLabel}
        </Link>
      </div>
    </div>
  );
}
