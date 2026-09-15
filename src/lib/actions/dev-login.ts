"use server";

import { serverSupabase } from "@/lib/supabase/server";
import { DEV_ACCOUNTS } from "@/lib/supabase/config";

/**
 * Sign in as a development account.
 *
 * ---------------------------------------------------------------------------
 * Why this is a server action and not four lines in the component
 * ---------------------------------------------------------------------------
 * It used to be in the component, reading NEXT_PUBLIC_DEV_PASSWORD. Anything
 * prefixed NEXT_PUBLIC_ is substituted into the JavaScript at build time, so
 * the password shipped to every visitor as a string literal — verified by
 * grepping the production bundle for it and finding it.
 *
 * The gate around it looked like it made that safe and did not. The component
 * returns null in a production build, so the buttons never render; but a
 * person reading the bundle does not need the buttons. The two account emails
 * are in there beside the password, and Supabase's auth endpoint is public, so
 * anyone could sign in as either account from a terminal. Rendering nothing is
 * not the same as shipping nothing.
 *
 * So the password lives in DEV_PASSWORD — no NEXT_PUBLIC_ prefix, which is
 * what actually keeps a value on the server — and the browser only ever sends
 * an email address to this action.
 *
 * Both conditions still hold, checked here rather than in the caller: a
 * non-production build AND the flag. A server action is a public HTTP endpoint,
 * so the check has to be on this side of the wire to mean anything.
 */

export type DevLoginResult = { ok: true } | { ok: false; error: string };

function devLoginOpen() {
  return process.env.NODE_ENV !== "production"
      && process.env.NEXT_PUBLIC_DEV_LOGIN === "on";
}

export async function devSignIn(email: string): Promise<DevLoginResult> {
  if (!devLoginOpen()) {
    return { ok: false, error: "Not found." };
  }

  // Only the two accounts this exists for. Without this the action is a
  // password oracle for every account in the project.
  if (!DEV_ACCOUNTS.some((a) => a.email === email)) {
    return { ok: false, error: "Not found." };
  }

  const password = process.env.DEV_PASSWORD ?? "";
  if (!password) {
    return { ok: false, error: "DEV_PASSWORD is not set in .env.local." };
  }

  const supabase = await serverSupabase();
  if (!supabase) return { ok: false, error: "No database configured." };

  const { error } = await supabase.auth.signInWithPassword({ email, password });
  if (error) return { ok: false, error: error.message };

  return { ok: true };
}
