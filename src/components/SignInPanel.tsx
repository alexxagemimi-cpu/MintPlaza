"use client";

import Link from "next/link";
import { useState } from "react";
import { browserSupabase } from "@/lib/supabase/client";
import { ROBLOX_PROVIDER, SUPABASE_READY } from "@/lib/supabase/config";
import { TERMS_COOKIE, TERMS_VERSION } from "@/lib/legal";

/**
 * Sign in with Roblox, behind a tick box.
 *
 * ---------------------------------------------------------------------------
 * Why the agreement is here and not after
 * ---------------------------------------------------------------------------
 *
 * The consent screen used to appear once somebody was already inside. That
 * works, and it is still there as a backstop, but it is the wrong moment: the
 * account exists, the session is live, and the question reads as a formality
 * on the way to somewhere. Asking before the only door means there is no
 * version of "signed in but has not agreed" for an ordinary player to be in.
 *
 * The button is genuinely disabled rather than styled to look it. A disabled
 * button cannot be clicked, cannot be triggered by Enter, and is announced as
 * disabled by a screen reader — where a grey-looking enabled button is a lie
 * that works until somebody taps it.
 *
 * ---------------------------------------------------------------------------
 * How the tick survives the trip to Roblox
 * ---------------------------------------------------------------------------
 *
 * Sign-in leaves this site entirely, goes to Roblox, and comes back to
 * /auth/callback. Nothing in React survives that. So ticking the box writes a
 * short-lived cookie naming the version agreed to, and the callback turns that
 * into the database record once there is an account to attach it to.
 *
 * The cookie is not a security control and is not treated as one. A person
 * could set it by hand — but all they would be doing is agreeing to the terms,
 * by a more laborious route than the tick box. What it cannot do is agree to
 * anything other than the CURRENT version: the callback compares it against
 * the server's own TERMS_VERSION and ignores anything else.
 *
 * The real guarantee is elsewhere and does not depend on any of this: the
 * database refuses to let an account post or message until an acceptance row
 * exists. See mintplaza.has_agreed().
 */
export function SignInPanel({ next = "/app" }: { next?: string }) {
  const [agreed, setAgreed] = useState(false);
  const [busy, setBusy] = useState(false);
  const [failed, setFailed] = useState<string | null>(null);

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

  async function signIn() {
    // Checked again here, not only on the button. The handler is the thing that
    // actually starts sign-in, so it is the thing that has to hold.
    if (!agreed) return;

    const supabase = browserSupabase();
    if (!supabase) {
      setFailed("Sign-in is not connected yet.");
      return;
    }
    setBusy(true);
    setFailed(null);

    // Ten minutes: long enough for a slow Roblox sign-in on a bad connection,
    // short enough that a shared or forgotten device is not still carrying an
    // agreement tomorrow. Lax survives the redirect back from Roblox, which
    // Strict would not.
    document.cookie =
      `${TERMS_COOKIE}=${encodeURIComponent(TERMS_VERSION)}; Max-Age=600; Path=/; SameSite=Lax`;

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

  return (
    <div>
      <label className="flex cursor-pointer items-start gap-3 rounded-[var(--radius-inner)] border border-line bg-fill px-4 py-3.5">
        <input
          type="checkbox"
          checked={agreed}
          onChange={(e) => setAgreed(e.target.checked)}
          className="mt-0.5 h-[18px] w-[18px] shrink-0 accent-[var(--color-mint)]"
        />
        <span className="text-[0.875rem] leading-relaxed text-ink-soft">
          I am <strong className="font-semibold text-ink">13 or older</strong> and I
          agree to the{" "}
          <Link
            href="/terms"
            target="_blank"
            rel="noopener noreferrer"
            className="font-semibold text-ink underline"
          >
            Terms of Service
          </Link>{" "}
          and{" "}
          <Link
            href="/privacy"
            target="_blank"
            rel="noopener noreferrer"
            className="font-semibold text-ink underline"
          >
            Privacy Policy
          </Link>
          . If I am under 18, a parent or guardian knows I use MintPlaza.
        </span>
      </label>

      <button
        type="button"
        onClick={signIn}
        disabled={!agreed || busy}
        aria-describedby={!agreed ? "signin-blocked" : undefined}
        className="pill pill-mint mt-4 w-full justify-center py-4 text-[0.9375rem] disabled:cursor-not-allowed disabled:opacity-40"
      >
        {busy ? "Taking you to Roblox…" : "Continue with Roblox"}
      </button>

      {!agreed && (
        <p id="signin-blocked" className="mt-2 text-center text-[0.75rem] text-ink-faint">
          Tick the box above to continue.
        </p>
      )}

      {failed && (
        <p role="alert" className="mt-3 text-[0.8125rem] leading-relaxed text-bad">
          {failed}
        </p>
      )}
    </div>
  );
}
