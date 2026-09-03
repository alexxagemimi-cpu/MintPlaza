import Link from "next/link";
import { redirect } from "next/navigation";
import type { Metadata } from "next";
import { RobloxSignIn } from "@/components/RobloxSignIn";
import { currentProfile } from "@/lib/supabase/server";

export const metadata: Metadata = { title: "Sign in" };

const ERRORS: Record<string, string> = {
  not_configured: "Sign-in is not connected yet.",
  missing_code: "Roblox did not send back a sign-in code. Please try again.",
  access_denied: "You cancelled the sign-in.",
};

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string; next?: string }>;
}) {
  if (await currentProfile()) redirect("/app");

  const { error, next } = await searchParams;
  const message = error ? (ERRORS[error] ?? error) : null;

  return (
    <div className="mx-auto flex min-h-dvh max-w-lg flex-col justify-center px-5 py-16">
      <Link href="/" className="mb-8 inline-flex items-baseline text-[1.0625rem] font-extrabold tracking-[-0.04em]">
        <span className="text-ink">Mint</span><span className="text-mint">Plaza</span>
      </Link>

      <h1 className="display text-[2rem] sm:text-[2.4rem]">Sign in with Roblox</h1>
      <p className="mt-4 text-[0.9375rem] leading-relaxed text-ink-soft">
        One tap through Roblox&rsquo;s own sign-in. MintPlaza never asks for your
        password, your cookie, or a session token — and never will.
      </p>

      {message && (
        <p role="alert" className="mt-5 rounded-[var(--radius-inner)] border border-bad/30 bg-bad/[0.06] px-4 py-3 text-[0.875rem] text-bad">
          {message}
        </p>
      )}

      <div className="mt-8">
        <RobloxSignIn next={next ?? "/app"} className="pill pill-mint w-full justify-center py-4 text-[0.9375rem]" />
      </div>

      <ul className="mt-9 space-y-2.5 text-[0.8125rem] leading-relaxed text-ink-mute">
        {[
          "Roblox requires a 13+ account to authorise an app, so everyone here is 13 or over.",
          "MintPlaza reads your username, avatar and account age. Nothing else, and never your inventory.",
          "It cannot post, trade, or act in any game on your behalf.",
        ].map((line) => (
          <li key={line} className="flex gap-2.5">
            <svg width="15" height="15" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.7" className="mt-0.5 shrink-0 text-mint" strokeLinecap="round" strokeLinejoin="round">
              <path d="m3.5 8.5 3 3 6-6.5" />
            </svg>
            {line}
          </li>
        ))}
      </ul>

      <p className="mt-9 text-[0.75rem] leading-relaxed text-ink-faint">
        Not affiliated with, endorsed by, or sponsored by Roblox Corporation.
      </p>
    </div>
  );
}
