"use server";

import { serverSupabase, currentProfile } from "@/lib/supabase/server";
import { SUPPORT_EMAIL, MAX_SUPPORT_LENGTH } from "@/lib/support";

/**
 * Telling us something is wrong.
 *
 * Deliberately not the report button. That one is about a person — somebody
 * scammed me, this comment is abuse — and it goes into the moderation queue
 * with a subject attached. This is about the site: a screen that will not
 * load, a value that looks wrong, something nobody can work out how to do.
 * Mixing the two would bury the moderation queue under "how do I trade".
 *
 * The rate limit lives in the database, not here, because two taps racing is
 * exactly when an application-side count is wrong. This reads the message it
 * raises and passes it straight through — it is written to be shown.
 */

type SupportResult = { ok: true } | { ok: false; error: string };

export async function sendSupportMessage(
  body: string,
  context?: string,
): Promise<SupportResult> {
  const text = body.trim();
  if (!text) return { ok: false, error: "Write what went wrong first." };
  if (text.length > MAX_SUPPORT_LENGTH) {
    return { ok: false, error: `Keep it under ${MAX_SUPPORT_LENGTH.toLocaleString()} characters.` };
  }

  const supabase = await serverSupabase();
  if (!supabase) return { ok: false, error: "Not connected to the database." };

  // currentProfile() rather than getUser(): a message from somebody with no
  // profile row has nobody to reply to, and the foreign key would refuse it
  // anyway a moment later.
  const profile = await currentProfile();
  if (!profile) {
    return { ok: false, error: `Sign in to send this, or email ${SUPPORT_EMAIL}.` };
  }

  const { error } = await supabase.from("support_messages").insert({
    user_id: profile.id,
    body: text,
    context: context?.slice(0, 200) ?? null,
  });

  if (error) {
    // The rate limit raises P0001 with a sentence meant for the player. Every
    // other failure gets a generic line and a server-side log, so it cannot
    // fail invisibly the way the report button did.
    if (error.code === "P0001") return { ok: false, error: error.message };
    console.error("sendSupportMessage failed", { code: error.code, message: error.message });
    return { ok: false, error: `Could not send that. Try again, or email ${SUPPORT_EMAIL}.` };
  }

  return { ok: true };
}
