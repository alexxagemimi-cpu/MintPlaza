"use server";

import { revalidatePath } from "next/cache";
import { serverSupabase, currentProfile } from "@/lib/supabase/server";
import {
  LIVE_WINDOW_MINUTES, MIN_WINDOW_MINUTES, MAX_WINDOW_MINUTES, MAX_TEAM,
} from "@/lib/sessions";

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
  terms:
    | { kind: "free" | "split" }
    | { kind: "item"; itemId: string }
    | { kind: "text"; text: string };
  detail?: string;
  /** The reference picture they picked, if the service offers a choice. */
  refId?: string;
  /** How long the poster wants it up. Bounded by the database either way. */
  windowMinutes?: number;
  /** Most people who may put their hand up. Null or absent means no limit. */
  voteCap?: number | null;
  /** How many the poster intends to pick. Null means they have not decided. */
  slots?: number | null;
}

export async function postListing(input: NewListing): Promise<Result<string>> {
  const a = await actor();
  if (!a) return fail("Sign in first.");

  if (input.serviceIds.length === 0) return fail("Pick at least one thing.");
  if (input.serviceIds.length > 8) return fail("That is too many for one post.");
  if ((input.detail?.length ?? 0) > 280) return fail("Keep the description under 280 characters.");

  // A written answer that is only spaces is a blank card where the host's terms
  // should be, and the database refuses it — so say which field, here, rather
  // than letting a check constraint answer for it.
  if (input.terms.kind === "text") {
    const text = input.terms.text.trim();
    if (!text) return fail("Say what you want in return, or pick Nothing.");
    if (text.length > 140) return fail("Keep what you want in return under 140 characters.");
  }

  // Clamped rather than rejected: these come from buttons with fixed values, so
  // anything outside the range arrived some other way and the right answer is a
  // sane post, not an error message nobody will see. The database enforces the
  // same bounds underneath, which is what actually makes them true.
  const minutes = Math.min(
    MAX_WINDOW_MINUTES,
    Math.max(MIN_WINDOW_MINUTES, Math.round(input.windowMinutes ?? LIVE_WINDOW_MINUTES)),
  );
  const expiresAt = new Date(Date.now() + minutes * 60_000).toISOString();
  const voteCap =
    input.voteCap == null ? null : Math.min(500, Math.max(1, Math.round(input.voteCap)));
  const slots =
    input.slots == null ? null : Math.min(MAX_TEAM, Math.max(1, Math.round(input.slots)));

  const { data, error } = await a.supabase
    .from("service_listings")
    .insert({
      game_slug: input.gameSlug,
      author_id: a.profile.id,
      side: input.side,
      service_ids: input.serviceIds,
      terms_kind: input.terms.kind,
      terms_item_id: input.terms.kind === "item" ? input.terms.itemId : null,
      terms_text: input.terms.kind === "text" ? input.terms.text.trim() : null,
      detail: input.detail?.trim() || null,
      ref_id: input.refId ?? null,
      expires_at: expiresAt,
      vote_cap: voteCap,
      slots,
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
  // The full-listing message is raised by the trigger and written for a person,
  // so it goes straight through rather than being replaced by something vaguer.
  if (error) return fail(error.message.replace(/^.*?:\s*/, ""));
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

/**
 * Take somebody back off the team.
 *
 * Needed the moment anybody says no. A five-player hunt where one person
 * denies is a four-player hunt that cannot start, and without this the host's
 * only move was to delete the post and write it again — losing every other
 * person who had already said yes.
 *
 * The author check is the RLS policy's, not this function's: only rows on a
 * listing you own are deletable, so a request naming somebody else's listing
 * removes nothing rather than being refused. Nothing here re-states that, since
 * a copy of a rule is a copy that can disagree with it.
 */
export async function removePick(
  listingId: string, username: string,
): Promise<Result> {
  const a = await actor();
  if (!a) return fail("Sign in first.");

  const { data: person } = await a.supabase
    .from("profiles").select("id").eq("username", username).maybeSingle();
  if (!person) return fail("Could not find that player.");

  const { error } = await a.supabase
    .from("service_picks").delete()
    .eq("listing_id", listingId).eq("user_id", person.id);
  if (error) return fail(error.message);

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
/**
 * Finalise the deal: lock the post, and open the party.
 *
 * One call, because these are one event. The old version only moved the stage
 * and left everybody who had just agreed with no way to reach each other —
 * they had said yes to a raid and then had to go and find each other by name.
 *
 * `adShown` is reported by the page, not trusted for anything. It decides
 * nothing: the deal finalises either way, and this is recorded so the number
 * of ads actually shown can be counted separately from the number of deals.
 * See src/lib/ads.ts for why it cannot be a requirement.
 */
export async function finalizeDeal(
  listingId: string,
  adShown: boolean,
): Promise<Result & { party?: { id: string; title: string; memberCount: number } }> {
  const a = await actor();
  if (!a) return fail("Sign in first.");

  const { data, error } = await a.supabase.rpc("finalize_deal", {
    p_listing: listingId,
    p_ad_shown: adShown,
  });
  // finalize_deal raises P0001 with messages written to be read by a player
  // ("Nobody has said yes yet."), so those pass through. The prefix Postgres
  // puts in front of them does not.
  if (error) return fail(error.message.replace(/^.*?:\s*/, ""));

  const row = data as {
    conversation_id: string; title: string; member_count: number;
  } | null;
  if (!row) return fail("That did not finalise. Try again.");

  refresh();
  return {
    ok: true,
    party: { id: row.conversation_id, title: row.title, memberCount: row.member_count },
  };
}

/**
 * What the interface calls a thing, against what the table calls it.
 *
 * These drifted, and the report button was broken for two of its three kinds
 * because of it. `reports.subject_type` is constrained to
 * ('user','listing','message','proof'), and this action was inserting the
 * interface's own words — "player" and "comment" — straight into it. Postgres
 * rejected both with a check violation, and the catch below turned that into
 * "Could not send that report. Try again.", so every report of a player and
 * every report of a comment was silently discarded. Only listings, where the
 * two vocabularies happened to agree, ever arrived.
 *
 * Translating here rather than renaming either side: "player" and "comment"
 * are what a person reporting one sees on the button, and 'user' and 'message'
 * are what the table has always stored. The boundary is the honest place for
 * the two to meet.
 */
const SUBJECT_TYPE = {
  player:  "user",
  comment: "message",
  listing: "listing",
} as const satisfies Record<"player" | "comment" | "listing", string>;

/**
 * Report something.
 *
 * Writes and returns. It never reads the table back — a reporter must not be
 * able to learn anything about what happens next, and the person reported must
 * never be able to tell they were.
 */
export async function submitReport(
  kind: "comment" | "listing" | "player", subjectId: string, reason: string,
  extra?: { evidenceUrl?: string; subjectLabel?: string },
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
  // Only http(s), and length-capped, matching the database's own constraint.
  // A report is read by the owner in a panel, and a javascript: or data: URL
  // arriving there would be a link the owner is invited to trust.
  const evidence = extra?.evidenceUrl?.trim();
  const evidenceUrl =
    evidence && /^https?:\/\//i.test(evidence) && evidence.length <= 500
      ? evidence
      : null;

  const { error } = await a.supabase.from("reports").insert({
    reporter_id: a.profile.id,
    subject_type: SUBJECT_TYPE[kind],
    subject_id: subjectId,
    reason,
    evidence_url: evidenceUrl,
    // Captured now, in words, because the listing this is about is hard-deleted
    // when its window closes — an id alone would age into a report about
    // nothing.
    subject_label: extra?.subjectLabel?.slice(0, 200) ?? null,
  });
  if (error) {
    // Logged, not just swallowed. A generic message is right for the player —
    // a constraint name helps them not at all — but this failing invisibly on
    // the server is exactly how the mapping above stayed broken: two of the
    // three report kinds were rejected by the database and nothing anywhere
    // said so.
    console.error("submitReport failed", { kind, code: error.code, message: error.message });
    return fail("Could not send that report. Try again.");
  }
  return { ok: true };
}
