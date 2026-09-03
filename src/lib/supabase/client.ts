"use client";

import { createBrowserClient } from "@supabase/ssr";
import { SUPABASE_ANON_KEY, SUPABASE_READY, SUPABASE_URL } from "./config";

/**
 * The browser client, or null when no project is configured.
 *
 * Returning null rather than throwing keeps the "no database yet" path a
 * first-class state instead of a crash — components branch on it the same way
 * they branch on an empty result.
 */
export function browserSupabase() {
  if (!SUPABASE_READY) return null;
  return createBrowserClient(SUPABASE_URL, SUPABASE_ANON_KEY);
}
