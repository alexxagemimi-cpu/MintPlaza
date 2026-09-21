import { NextResponse, type NextRequest } from "next/server";
import { serverSupabase } from "@/lib/supabase/server";
import { internalPath } from "@/lib/redirect";
import { TERMS_COOKIE, TERMS_VERSION } from "@/lib/legal";

/**
 * Where Roblox sends the player back.
 *
 * Supabase exchanges the code for a session and validates the ID token against
 * Roblox's JWKS; the profile row is created by the database trigger in
 * supabase/schema.sql, not here, so it happens exactly once regardless of which
 * path created the user.
 */
export async function GET(request: NextRequest) {
  const url = new URL(request.url);
  const code = url.searchParams.get("code");
  const error = url.searchParams.get("error");

  // Only same-origin paths, so the callback cannot be used as an open
  // redirect. Resolved and compared by origin rather than read as a string —
  // see internalPath(), and the `/\evil.com` case that got past the string
  // version.
  const next = internalPath(url.searchParams.get("next"), url.origin, "/app");

  if (error) {
    return NextResponse.redirect(new URL(`/login?error=${encodeURIComponent(error)}`, url.origin));
  }
  if (!code) {
    return NextResponse.redirect(new URL("/login?error=missing_code", url.origin));
  }

  const supabase = await serverSupabase();
  if (!supabase) {
    return NextResponse.redirect(new URL("/login?error=not_configured", url.origin));
  }

  const { error: exchangeError } = await supabase.auth.exchangeCodeForSession(code);
  if (exchangeError) {
    return NextResponse.redirect(
      new URL(`/login?error=${encodeURIComponent(exchangeError.message)}`, url.origin),
    );
  }

  // Supabase will not always permit a trigger on auth.users, so the profile
  // row is guaranteed here instead. Idempotent: a no-op when the trigger ran.
  const { error: profileError } = await supabase.rpc("ensure_profile");
  if (profileError) {
    // Not fatal — the session is valid and the profile can be created later.
    console.error("ensure_profile failed after sign-in:", profileError.message);
  }

  // ---- turn the tick on the sign-in screen into a record ------------------
  //
  // The box was ticked before leaving for Roblox, which is before there was an
  // account to attach the agreement to. The cookie carried it across; this is
  // where it becomes a row.
  //
  // The version is compared against the server's own TERMS_VERSION and
  // anything else is ignored. A hand-set cookie can therefore agree to the
  // current terms — which is what ticking the box does anyway — and cannot
  // agree to some older, softer version that is no longer served.
  const response = NextResponse.redirect(new URL(next, url.origin));

  const ticked = request.cookies.get(TERMS_COOKIE)?.value;
  if (ticked === TERMS_VERSION) {
    const { error: acceptError } = await supabase.rpc("accept_terms", {
      p_version: TERMS_VERSION,
    });
    if (acceptError) {
      // Not fatal. The consent screen inside the app is the backstop, and the
      // database refuses posting and messaging until a row exists — so the
      // worst case is being asked once more rather than slipping through.
      console.error("accept_terms failed after sign-in:", acceptError.message);
    }
  }

  // Cleared either way: it has done its job, or it was never valid.
  response.cookies.set(TERMS_COOKIE, "", { maxAge: 0, path: "/" });

  return response;
}
