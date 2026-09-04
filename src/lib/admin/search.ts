"use server";

import { serverSupabase } from "@/lib/supabase/server";

/**
 * Shortcuts that search can surface.
 *
 * Search returns places as well as items. This is the only one so far, and it
 * is the way into the admin panel — which has no link anywhere in MintPlaza.
 *
 * Three things keep it out of sight:
 *
 *   1. The phrase that reveals it is not in this file, or anywhere else in the
 *      code. Only a bcrypt hash of it exists, in a table PostgREST does not
 *      expose, and the comparison happens inside the database. Reading the
 *      source or the browser bundle turns up nothing to try.
 *   2. The match is exact. bcrypt gives no partial credit, so one wrong
 *      character is simply a non-match.
 *   3. It answers for the one allowlisted account only. Everyone else gets an
 *      empty list — the same empty list any unmatched word returns.
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
    body: "Edit items, prices and values across all six games.",
  }];
}
