"use client";

import { useState } from "react";
import { browserSupabase } from "@/lib/supabase/client";
import { ROBLOX_PROVIDER, SUPABASE_READY } from "@/lib/supabase/config";

/**
 * The only way into MintPlaza.
 *
 * Roblox's own OAuth, so no password, cookie or token is ever asked for. It
 * also means every account is 13+, because Roblox requires that to authorise
 * an app — a stronger age gate than anything this site could enforce itself.
 */
export function RobloxSignIn({
  next = "/app",
  className = "pill pill-mint px-7 py-4 text-[0.9375rem]",
  label = "Continue with Roblox",
}: {
  next?: string;
  className?: string;
  label?: string;
}) {
  const [busy, setBusy] = useState(false);
  const [failed, setFailed] = useState<string | null>(null);

  async function signIn() {
    const supabase = browserSupabase();
    if (!supabase) {
      setFailed("Sign-in is not connected yet.");
      return;
    }
    setBusy(true);
    setFailed(null);

    const { error } = await supabase.auth.signInWithOAuth({
      provider: ROBLOX_PROVIDER as never,
      options: {
        redirectTo: `${window.location.origin}/auth/callback?next=${encodeURIComponent(next)}`,
        scopes: "openid profile",
      },
    });

    if (error) {
      setBusy(false);
      setFailed(error.message);
    }
    // On success the browser leaves for Roblox, so there is nothing to reset.
  }

  if (!SUPABASE_READY) {
    return (
      <div className="glass-quiet rounded-[var(--radius-inner)] px-5 py-4 text-left">
        <p className="text-[0.9375rem] font-bold text-ink">Sign-in isn&rsquo;t connected yet</p>
        <p className="mt-1.5 text-[0.8125rem] leading-relaxed text-ink-mute">
          MintPlaza needs its database keys before anyone can sign in. Everything
          else on the site works; nothing here is pretending to.
        </p>
      </div>
    );
  }

  return (
    <div>
      <button type="button" onClick={signIn} disabled={busy} className={className}>
        {busy ? "Taking you to Roblox…" : label}
      </button>
      {failed && (
        <p role="alert" className="mt-3 text-[0.8125rem] leading-relaxed text-bad">
          {failed}
        </p>
      )}
    </div>
  );
}
