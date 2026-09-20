"use server";

import { serverSupabase } from "@/lib/supabase/server";

/**
 * The announcement a visitor should see, and how they put it away.
 *
 * ---------------------------------------------------------------------------
 * Why this is fetched by the client rather than rendered on the server
 * ---------------------------------------------------------------------------
 *
 * The obvious place for this is a server component in the root layout, and
 * that would make the marketing home page dynamic — it is prerendered today,
 * and a database read in the layout costs that for every visitor whether or not
 * an announcement exists. Worse, most visits should not read anything at all:
 * somebody who has already closed it is answered by their own browser.
 *
 * So the gate checks storage first and only asks the server when it has a
 * reason to. Every page stays exactly as static or dynamic as it was.
 */

export interface LiveAnnouncement {
  id: string;
  title: string;
  body: string;
  mediaUrl: string | null;
  mediaKind: "image" | "video" | null;
}

/**
 * Never throws and never distinguishes "nothing to show" from "could not ask".
 * An announcement is the least important thing on the page; a database hiccup
 * must not be able to put an error in front of somebody trying to trade.
 */
export async function readAnnouncement(): Promise<LiveAnnouncement | null> {
  const supabase = await serverSupabase();
  if (!supabase) return null;

  const { data, error } = await supabase.rpc("live_announcement");
  if (error || !Array.isArray(data) || data.length === 0) return null;

  const row = data[0] as {
    id: string; title: string; body: string;
    media_url: string | null; media_kind: string | null;
  };

  // The database already refuses anything that is not https, and refuses a URL
  // with no kind beside it. Both are checked again here because this value is
  // about to become the src of a tag: a rule enforced in one place is a rule
  // that stops applying the day somebody adds a second way to write a row.
  const kind = row.media_kind === "image" || row.media_kind === "video" ? row.media_kind : null;
  const url = typeof row.media_url === "string" && row.media_url.startsWith("https://")
    ? row.media_url
    : null;

  return {
    id: row.id,
    title: row.title,
    body: row.body,
    mediaUrl: kind && url ? url : null,
    mediaKind: kind && url ? kind : null,
  };
}

/**
 * "Don't show again", recorded against the account.
 *
 * Only does anything for somebody signed in — the function is not granted to
 * anon, and there is no row to write for a visitor with no account. The gate
 * also writes to localStorage, which is what covers that case; this is what
 * makes the decision follow a player to their phone.
 */
export async function dismissAnnouncement(id: string): Promise<void> {
  const supabase = await serverSupabase();
  if (!supabase) return;
  await supabase.rpc("dismiss_announcement", { p_announcement: id });
}
