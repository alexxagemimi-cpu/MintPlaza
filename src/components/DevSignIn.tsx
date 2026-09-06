"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { browserSupabase } from "@/lib/supabase/client";
import { DEV_ACCOUNTS, DEV_LOGIN_ENABLED } from "@/lib/supabase/config";

/**
 * Sign in as a development account.
 *
 * Renders nothing unless the build is non-production AND the flag is set, so
 * there is no path by which this reaches a real player.
 */
export function DevSignIn({ next = "/app" }: { next?: string }) {
  const router = useRouter();
  const [busy, setBusy] = useState<string | null>(null);
  const [failed, setFailed] = useState<string | null>(null);

  if (!DEV_LOGIN_ENABLED) return null;

  async function signIn(email: string) {
    const supabase = browserSupabase();
    if (!supabase) return;
    setBusy(email);
    setFailed(null);

    const { error } = await supabase.auth.signInWithPassword({
      email,
      password: process.env.NEXT_PUBLIC_DEV_PASSWORD ?? "",
    });

    if (error) {
      setBusy(null);
      setFailed(error.message);
      return;
    }
    router.push(next);
    router.refresh();
  }

  return (
    <div className="mt-8 rounded-[var(--radius-inner)] border border-dashed border-warn/40 bg-warn-wash p-5">
      <p className="font-mono text-[0.625rem] tracking-[0.1em] text-warn">DEVELOPMENT ONLY</p>
      <p className="mt-2 text-[0.875rem] leading-relaxed text-ink-soft">
        Two accounts for testing the signed-in half of the site without
        going out to Roblox and back every time. They never appear in a
        production build, and switching NEXT_PUBLIC_DEV_LOGIN to off removes
        them here too.
      </p>
      <div className="mt-4 flex flex-wrap gap-2">
        {DEV_ACCOUNTS.map((a) => (
          <button
            key={a.email}
            type="button"
            onClick={() => signIn(a.email)}
            disabled={busy !== null}
            className="pill pill-ghost py-2.5 text-[0.8125rem]"
          >
            {busy === a.email ? "Signing in…" : `Sign in as ${a.label}`}
          </button>
        ))}
      </div>
      {failed && (
        <p role="alert" className="mt-3 text-[0.8125rem] text-bad">{failed}</p>
      )}
    </div>
  );
}
