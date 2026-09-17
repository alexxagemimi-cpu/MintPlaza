import Link from "next/link";
import type { Metadata } from "next";
import { SupportComposer } from "@/components/SupportComposer";
import { SUPPORT_EMAIL } from "@/lib/support";
import { currentProfile } from "@/lib/supabase/server";

export const metadata: Metadata = {
  title: "Tell us your problem",
  description: "Something broken, confusing, or not working? Tell us here.",
};

/**
 * Where a player says the site is broken.
 *
 * Its own route rather than a panel, because the reason somebody comes here is
 * usually that the screen they were on did not work — putting the escape hatch
 * inside that screen assumes the screen is fine.
 *
 * Signed out, the composer is disabled rather than hidden. Hiding it would
 * leave a person who cannot sign in staring at a page that appears to offer
 * nothing; disabled, with the email address underneath, tells them what the
 * route actually is.
 */
export default async function SupportPage({
  searchParams,
}: {
  searchParams: Promise<{ from?: string }>;
}) {
  const [profile, { from }] = await Promise.all([
    currentProfile(),
    searchParams,
  ]);

  return (
    <div className="mx-auto flex min-h-dvh max-w-xl flex-col justify-center px-5 py-16">
      <Link
        href="/app"
        className="mb-8 inline-flex items-baseline text-[1.0625rem] font-extrabold tracking-[-0.04em]"
      >
        <span className="text-ink">Mint</span><span className="text-mint">Plaza</span>
      </Link>

      <h1 className="display text-[2rem] sm:text-[2.4rem]">Tell us your problem</h1>
      <p className="measure mt-4 text-[0.9375rem] leading-relaxed text-ink-soft">
        Something broken, something confusing, a value that looks wrong, or
        anything you cannot work out. Write it how you would say it — there is
        no form to fill in and nobody is grading the spelling.
      </p>

      <div className="mt-8">
        <SupportComposer
          signedIn={profile !== null}
          context={from?.slice(0, 200)}
        />
      </div>

      {!profile && (
        <p className="mt-5 text-[0.8125rem] leading-relaxed text-ink-mute">
          You are signed out, so the box above is closed —{" "}
          <Link href="/login?next=/support" className="font-semibold text-mint hover:underline">
            sign in
          </Link>{" "}
          to use it, or email{" "}
          <a href={`mailto:${SUPPORT_EMAIL}`} className="font-semibold text-mint hover:underline">
            {SUPPORT_EMAIL}
          </a>{" "}
          instead. A message needs an account attached or there is no way to
          reply to it.
        </p>
      )}

      <ul className="mt-10 space-y-2.5 text-[0.8125rem] leading-relaxed text-ink-mute">
        {[
          "It goes straight to the person who built MintPlaza. Not a queue, not a bot.",
          "Include what you were doing and which game — it is usually the whole answer.",
          "Scammed or harassed? Use the Report button on their profile or listing instead, so it reaches moderation with the evidence attached.",
        ].map((line) => (
          <li key={line} className="flex gap-2.5">
            <svg
              width="15" height="15" viewBox="0 0 16 16" fill="none" stroke="currentColor"
              strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round"
              className="mt-0.5 shrink-0 text-mint" aria-hidden="true"
            >
              <path d="m3.5 8.5 3 3 6-6.5" />
            </svg>
            {line}
          </li>
        ))}
      </ul>
    </div>
  );
}
