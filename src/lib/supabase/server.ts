import { cookies } from "next/headers";
import { createServerClient } from "@supabase/ssr";
import { SUPABASE_ANON_KEY, SUPABASE_READY, SUPABASE_URL } from "./config";

/**
 * The server client, bound to the request's cookies.
 *
 * Everything authoritative runs through this: the session is read from an
 * httpOnly cookie the browser cannot script, and every query it makes is
 * subject to the row-level security policies in supabase/schema.sql. The
 * anon key is publishable by design — RLS, not key secrecy, is what protects
 * the data. The service-role key must never appear in this file or any file
 * that ships to the browser.
 */
export async function serverSupabase() {
  if (!SUPABASE_READY) return null;

  const store = await cookies();

  return createServerClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
    cookies: {
      getAll() {
        return store.getAll();
      },
      setAll(toSet) {
        try {
          toSet.forEach(({ name, value, options }) =>
            store.set(name, value, options),
          );
        } catch {
          // Called from a Server Component, where cookies are read-only.
          // Middleware refreshes the session instead, so this is safe to skip.
        }
      },
    },
  });
}

/** The signed-in player's profile, or null. Never throws. */
export async function currentProfile() {
  const supabase = await serverSupabase();
  if (!supabase) return null;

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;

  const { data } = await supabase
    .from("profiles")
    .select("id, roblox_user_id, username, display_name, avatar_url, roblox_created_at, status, hide_presence")
    .eq("id", user.id)
    .maybeSingle();

  return data ?? null;
}
