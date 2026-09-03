import { NextResponse, type NextRequest } from "next/server";
import { serverSupabase } from "@/lib/supabase/server";

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

  // Only same-origin paths, so the callback cannot be used as an open redirect.
  const requested = url.searchParams.get("next") ?? "/app";
  const next = requested.startsWith("/") && !requested.startsWith("//") ? requested : "/app";

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

  return NextResponse.redirect(new URL(next, url.origin));
}
