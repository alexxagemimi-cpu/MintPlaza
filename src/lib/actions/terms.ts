"use server";

import { revalidatePath } from "next/cache";
import { serverSupabase, currentProfile } from "@/lib/supabase/server";
import { TERMS_VERSION } from "@/lib/legal";

/**
 * Agreeing to the terms.
 *
 * The version is taken from src/lib/legal.ts on the SERVER and never from the
 * request. That is the whole integrity of the record: a client that could name
 * the version it was accepting could record agreement to text it never
 * displayed — or to an old, softer version — and the acceptance would be
 * evidence of nothing.
 */

/** True once this player has agreed to the version currently being served. */
export async function hasAcceptedTerms(): Promise<boolean> {
  const supabase = await serverSupabase();
  if (!supabase) return true;   // No database: no gate. Nothing to record against.

  const profile = await currentProfile();
  if (!profile) return true;    // Signed out: the gate is for signed-in players.

  const { data, error } = await supabase.rpc("has_accepted_terms", {
    p_version: TERMS_VERSION,
  });
  // An error here must NOT lock somebody out of the whole site, so a failed
  // read is treated as accepted. The gate exists to get consent from people who
  // have not given it, not to hold the site hostage to a database hiccup.
  if (error) return true;
  return data === true;
}

export async function acceptTerms(): Promise<{ ok: boolean; error?: string }> {
  const supabase = await serverSupabase();
  if (!supabase) return { ok: false, error: "No database configured." };

  const profile = await currentProfile();
  if (!profile) return { ok: false, error: "Sign in first." };

  const { error } = await supabase.rpc("accept_terms", { p_version: TERMS_VERSION });
  if (error) return { ok: false, error: "That did not save. Try again." };

  revalidatePath("/app", "layout");
  return { ok: true };
}
