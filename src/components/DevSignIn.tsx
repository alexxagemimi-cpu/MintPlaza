"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { DEV_ACCOUNTS, DEV_LOGIN_ENABLED } from "@/lib/supabase/config";
import { devSignIn } from "@/lib/actions/dev-login";

/**
 * Sign in as a development account.
 *
 * Renders nothing unless the build is non-production AND the flag is set. That
 * hides the buttons; it is not what makes this safe. The password is held by
 * the server action this calls, because a value read here would be compiled
 * into the bundle and readable by anyone, buttons or no buttons. See
 * src/lib/actions/dev-login.ts — the same two conditions are re-checked there,
 * which is the side of the wire where they count.
 */
export function DevSignIn({ next = "/app" }: { next?: string }) {
  const router = useRouter();
  const [busy, setBusy] = useState<string | null>(null);
  const [failed, setFailed] = useState<string | null>(null);

  if (!DEV_LOGIN_ENABLED) return null;

  async function signIn(email: string) {
    setBusy(email);
    setFailed(null);

    // Only the email crosses the wire. The password never reaches the browser.
    const result = await devSignIn(email);

    if (!result.ok) {
      setBusy(null);
      setFailed(result.error);
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
