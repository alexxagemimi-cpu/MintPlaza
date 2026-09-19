"use server";

import { serverSupabase } from "@/lib/supabase/server";

/**
 * Shortcuts that search can surface.
 *
 * Search returns places as well as items. This is the only one, and it is the
 * way into the admin panel — which has no link anywhere in MintPlaza.
 *
 * ---------------------------------------------------------------------------
 * What actually keeps it out of sight, corrected
 * ---------------------------------------------------------------------------
 *
 * This comment used to claim the phrase existed only as a bcrypt hash in a
 * table PostgREST does not expose, and that reading the source turned up
 * nothing to try. That was not true. The phrase was a plain string literal in
 * supabase/schema.sql, and it was four ordinary words — 'control panel',
 * 'console', 'studio', 'admin' — any of which a player might type by accident.
 *
 * Writing the stronger claim down did not make it so, and a comment that
 * overstates a defence is worse than none: it is the reason nobody re-checks.
 * So, honestly, here is what holds:
 *
 *   1. **is_admin() is the lock.** The phrase is not a password and was never
 *      one. console_phrase_matches() answers false for every account but the
 *      one on the allowlist, and it checks that FIRST, so for anybody else
 *      the phrase is irrelevant — there is nothing to guess. /admin itself
 *      404s to everybody else regardless of how they got there.
 *   2. **The match is exact and whole.** One phrase, '/openadminpanel',
 *      compared in the database. A missing letter is a non-match. It is not
 *      hashed, and it does not need to be, because of 1.
 *   3. **It is not in the client bundle.** The comparison happens server-side,
 *      so the phrase never reaches a browser and reading the JavaScript turns
 *      up nothing. That much was, and remains, true.
 *
 * Nothing here is named for the admin either, because a server action's name is
 * compiled into the client bundle of every page that calls it.
 */
export interface Shortcut {
  href: string;
  title: string;
  body: string;
}

export async function searchShortcuts(query: string): Promise<Shortcut[]> {
  const phrase = query.trim();
  // Cheap length guard so ordinary typing does not hit the database on every
  // keystroke. It leaks nothing: the phrase's length is not a secret worth
  // keeping once the phrase itself is unguessable.
  if (phrase.length < 8) return [];

  const supabase = await serverSupabase();
  if (!supabase) return [];

  const { data, error } = await supabase.rpc("console_phrase_matches", { p_phrase: phrase });
  if (error || data !== true) return [];

  return [{
    href: "/admin",
    title: "Open the control panel",
    body: "Items, games, templates, reports and support, across all six games.",
  }];
}
