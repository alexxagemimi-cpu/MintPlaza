"use server";

import { revalidatePath } from "next/cache";
import { serverSupabase, currentProfile } from "@/lib/supabase/server";

/**
 * Everything you can do on the Raids & Services board.
 *
 * Each of these is a thin, checked wrapper over one statement. The rules are
 * not enforced here — they are enforced by row-level security and by the shape
 * of the tables, which hold whether or not this file is the thing calling.
 * What these add is a clean message instead of a policy error, and a cache
 * invalidation so the page redraws.
 *
 * Errors come back as values rather than thrown, because every caller is a
 * button that needs to say something useful when it does not work.
 */

export type Result<T = void> =
  | ({ ok: true } & (T extends void ? object : { data: T }))
  | { ok: false; error: string };

const fail = (error: string): Result<never> => ({ ok: false, error });

/** Signed in, with a profile. Everything below needs both. */
async function actor() {
  const supabase = await serverSupabase();
  if (!supabase) return null;
  const profile = await currentProfile();
  if (!profile) return null;
  return { supabase, profile };
}

function refresh(gameSlug?: string) {
  revalidatePath("/app", "layout");
  if (gameSlug) revalidatePath(`/app/${gameSlug}/explore`);
}

/**
 * Say you are here.
 *
 * Drives the green dot. Called on page load rather than on a timer: a player
 * who has a tab open and has not touched it in ten minutes is not somebody you
 * want to message about a raid starting now.
 */
export async function touchPresence(): Promise<void> {
  const a = await actor();
  await a?.supabase.rpc("touch_presence");
}

/** The whole board for one game, in one round trip. */
export async function readBoard(gameSlug: string): Promise<unknown[]> {
  const supabase = await serverSupabase();
  if (!supabase) return [];
  const { data, error } = await supabase.rpc("board_listings", { p_game: gameSlug });
  if (error || !Array.isArray(data)) return [];
  return data;
}

export interface NewListing {
  gameSlug: string;
  side: "offer" | "request";
  serviceIds: string[];
  terms: { kind: "free" | "split" } | { kind: "item"; itemId: string };
  detail?: string;
  /** The reference picture they picked, if the service offers a choice. */
  refId?: string;
}

export async function postListing(input: NewListing): Promise<Result<string>> {
  const a = await actor();
  if (!a) return fail("Sign in first.");

  if (input.serviceIds.length === 0) return fail("Pick at least one thing.");
  if (input.serviceIds.length > 8) return fail("That is too many for one post.");
  if ((input.detail?.length ?? 0) > 280) return fail("Keep the description under 280 characters.");

  const { data, error } = await a.supabase
    .from("service_listings")
    .insert({
      game_slug: input.gameSlug,
      author_id: a.profile.id,
      side: input.side,
      service_ids: input.serviceIds,
      terms_kind: input.terms.kind,
      terms_item_id: input.terms.kind === "item" ? input.terms.itemId : null,
      detail: input.detail?.trim() || null,
      ref_id: input.refId ?? null,
    })
    .select("id")
    .single();

  // The three-live-posts limit surfaces as a raised exception, and its message
  // is written to be shown to a person, so pass it straight through.
  if (error) return fail(error.message);
  refresh(input.gameSlug);
  return { ok: true, data: data.id };
}

export async function deleteListing(id: string): Promise<Result> {
  const a = await actor();
  if (!a) return fail("Sign in first.");
  const { error } = await a.supabase.from("service_listings").delete().eq("id", id);
  if (error) return fail(error.message);
  refresh();
  return { ok: true };
}

/**
 * Put your hand up, or take it back.
 *
 * The database refuses a second vote by primary key and refuses your own
 * listing by trigger, so this only has to say which way it went.
 */
export async function toggleVote(listingId: string): Promise<Result<{ voted: boolean }>> {
  const a = await actor();
  if (!a) return fail("Sign in first.");

  const { data: existing } = await a.supabase
    .from("service_votes")
    .select("user_id")
    .eq("listing_id", listingId)
    .eq("user_id", a.profile.id)
    .maybeSingle();

  if (existing) {
    const { error } = await a.supabase
      .from("service_votes").delete()
      .eq("listing_id", listingId).eq("user_id", a.profile.id);
    if (error) return fail("You cannot take your vote back once the team is being picked.");
    refresh();
    return { ok: true, data: { voted: false } };
  }

  const { error } = await a.supabase
    .from("service_votes")
    .insert({ listing_id: listingId, user_id: a.profile.id });
  if (error) return fail(error.message);
  refresh();
  return { ok: true, data: { voted: true } };
}

export async function addComment(
  listingId: string, body: string, replyTo?: string,
): Promise<Result> {
  const a = await actor();
  if (!a) return fail("Sign in first.");

  const text = body.trim();
  if (!text) return fail("Write something first.");
  if (text.length > 400) return fail("That is too long — keep it under 400 characters.");

  const { error } = await a.supabase.from("service_comments").insert({
    listing_id: listingId,
    author_id: a.profile.id,
    body: text,
    reply_to: replyTo ?? null,
  });
  // The only way to fail the policy is not having voted, so say that rather
  // than showing somebody a database error.
  if (error) return fail("Vote on this first — the thread is for people going.");
  refresh();
  return { ok: true };
}

export async function deleteComment(id: string): Promise<Result> {
  const a = await actor();
  if (!a) return fail("Sign in first.");
  const { error } = await a.supabase.from("service_comments").delete().eq("id", id);
  if (error) return fail(error.message);
  refresh();
  return { ok: true };
}

/**
 * Pick a team and ask them.
 *
 * One statement, so a partial team can never be left half-asked: either
 * everybody gets the request or nobody does. The composite foreign key means a
 * username that never voted simply cannot be inserted.
 */
export async function sendRequest(
  listingId: string, usernames: string[],
): Promise<Result> {
  const a = await actor();
  if (!a) return fail("Sign in first.");
  if (usernames.length === 0) return fail("Pick somebody first.");
  if (usernames.length > 18) return fail("That is more than one deal can hold.");

  const { data: people, error: lookupError } = await a.supabase
    .from("profiles").select("id, username").in("username", usernames);
  if (lookupError || !people?.length) return fail("Could not find those players.");

  const { error } = await a.supabase.from("service_picks").upsert(
    people.map((p) => ({ listing_id: listingId, user_id: p.id, reply: "waiting" })),
    { onConflict: "listing_id,user_id" },
  );
  if (error) return fail(error.message);

  const { error: stageError } = await a.supabase
    .from("service_listings").update({ stage: "requested" }).eq("id", listingId);
  if (stageError) return fail(stageError.message);

  refresh();
  return { ok: true };
}

/** Your answer to a request. Only ever your own row — the policy sees to that. */
export async function answerRequest(
  listingId: string, agreed: boolean,
): Promise<Result> {
  const a = await actor();
  if (!a) return fail("Sign in first.");
  const { error } = await a.supabase
    .from("service_picks")
    .update({ reply: agreed ? "agreed" : "denied" })
    .eq("listing_id", listingId)
    .eq("user_id", a.profile.id);
  if (error) return fail(error.message);
  refresh();
  return { ok: true };
}

/**
 * Lock it in.
 *
 * Needs one yes, not everybody's. Waiting on the whole team would leave the
 * deal hostage to the one person who wandered off while the people who did say
 * yes sit there ready to go.
 */
export async function lockIn(listingId: string): Promise<Result> {
  const a = await actor();
  if (!a) return fail("Sign in first.");

  const { count } = await a.supabase
    .from("service_picks")
    .select("user_id", { count: "exact", head: true })
    .eq("listing_id", listingId)
    .eq("reply", "agreed");

  if (!count) return fail("Nobody has said yes yet.");

  const { error } = await a.supabase
    .from("service_listings").update({ stage: "locked" }).eq("id", listingId);
  if (error) return fail(error.message);
  refresh();
  return { ok: true };
}

/**
 * Report something.
 *
 * Writes and returns. It never reads the table back — a reporter must not be
 * able to learn anything about what happens next, and the person reported must
 * never be able to tell they were.
 */
export async function submitReport(
  kind: "comment" | "listing" | "player", subjectId: string, reason: string,
): Promise<Result> {
  const a = await actor();
  if (!a) return fail("Sign in first.");

  // The table keys reports by uuid. Anything else is an example row, which has
  // nothing real to report — refuse rather than write a broken row.
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(subjectId)) {
    return fail("There is nothing to report on an example listing.");
  }

  // Uses the moderation table that already existed rather than a second one —
  // reports split across two tables would leave half of them unlooked-at.
  const { error } = await a.supabase.from("reports").insert({
    reporter_id: a.profile.id,
    subject_type: kind,
    subject_id: subjectId,
    reason,
  });
  if (error) return fail("Could not send that report. Try again.");
  return { ok: true };
}
