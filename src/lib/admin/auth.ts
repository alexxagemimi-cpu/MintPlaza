import { serverSupabase, currentProfile } from "@/lib/supabase/server";

/**
 * Who may administer MintPlaza.
 *
 * One person, bound to a Roblox account rather than a password. The decision is
 * made by the database — `public.is_admin()`, which reads an allowlist living
 * in a schema PostgREST does not expose — and never by this code. That matters
 * more than it looks: if the check lived here, every write would still have to
 * be trusted from the client, and hiding a button is not authorisation. The
 * row-level security policies refuse a non-admin write even if someone calls
 * the API directly with a valid session.
 *
 * So this function answers one question only: should the interface be drawn?
 * The database independently answers: may this write happen?
 */
export async function isAdmin(): Promise<boolean> {
  const supabase = await serverSupabase();
  if (!supabase) return false;

  const { data, error } = await supabase.rpc("is_admin");
  if (error) return false;
  return data === true;
}

/**
 * The admin's profile, or null for everyone else.
 *
 * Returning null rather than throwing lets callers decide how to disappear —
 * and the admin surface disappears by returning a 404, not a 403. A "forbidden"
 * page confirms that something exists to be forbidden from; a 404 is
 * indistinguishable from a URL that was never a route at all.
 */
export async function adminProfile() {
  if (!(await isAdmin())) return null;
  return currentProfile();
}
