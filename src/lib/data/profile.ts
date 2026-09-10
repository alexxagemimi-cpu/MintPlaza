import { serverSupabase, currentProfile } from "@/lib/supabase/server";
import type { ProfileView } from "@/lib/profile";

/**
 * Reading a profile.
 *
 * One database function does the whole page, and it has to: the contact count
 * is taken from rows only that player can see, so no query written out here
 * could ever produce it honestly. Asking the database for "the profile" rather
 * than for six tables also means there is one definition of what a profile
 * contains, and the answer cannot drift between the page, the card and the
 * next thing that needs it.
 */

export async function readProfile(username: string): Promise<ProfileView | null> {
  const supabase = await serverSupabase();
  if (!supabase) return null;

  const { data, error } = await supabase.rpc("public_profile", { p_username: username });
  if (error || !data) return null;
  return data as ProfileView;
}

/** Your own profile, or null when signed out. */
export async function readMyProfile(): Promise<ProfileView | null> {
  const me = await currentProfile();
  if (!me) return null;
  return readProfile(me.username);
}
