"use server";

import { revalidatePath } from "next/cache";
import { serverSupabase, currentProfile } from "@/lib/supabase/server";

/**
 * Messaging.
 *
 * Every one of these is a thin wrapper over one database function, and that is
 * the whole design: not one rule in this file is enforced by this file. Who may
 * open a thread, who may read it, who may send into it, how fast, and what a
 * block does are all decided in supabase/schema.sql, where they hold whether
 * the caller is this app, a forged request, or somebody with the anon key and
 * a REST client.
 *
 * What these add is a sentence a player can read instead of a policy error,
 * and a cache invalidation so the screen redraws.
 *
 * The one thing worth stating plainly: `start_conversation` takes a USERNAME,
 * never a user id, and `conversation_thread` re-checks membership inside the
 * database even though it is only ever called from a page that already checked.
 * Both are deliberate. A function that accepted a uuid would let somebody walk
 * the user table, and a SECURITY DEFINER function that trusted its caller would
 * hand over any conversation in the database by id.
 */

export type Result<T = void> =
  | ({ ok: true } & (T extends void ? object : { data: T }))
  | { ok: false; error: string };

const fail = (error: string): Result<never> => ({ ok: false, error });

/** Matches the CHECK constraint on messages.body. Kept in step by the proof script. */
const MAX_MESSAGE_LENGTH = 2000;

async function actor() {
  const supabase = await serverSupabase();
  if (!supabase) return null;
  const profile = await currentProfile();
  if (!profile) return null;
  return { supabase, profile };
}

/**
 * Postgres errors arrive with a lot of scaffolding around them. The ones this
 * schema raises deliberately (P0001) carry a message written for a player, so
 * those pass through; anything else is a bug or an outage and should not put
 * database internals on a teenager's screen.
 */
function readable(error: { code?: string; message?: string } | null): string {
  if (error?.code === "P0001" && error.message) return error.message;
  return "That did not work. Try again in a moment.";
}

/**
 * Open a conversation, or return the one that already exists.
 *
 * Idempotent in the database, which is what makes it safe to wire straight to
 * a button: a double tap, or messaging the same person from two listings,
 * lands in one thread rather than two half-threads.
 */
export async function startConversation(
  username: string,
  listingId?: string,
): Promise<Result<{ id: string }>> {
  const a = await actor();
  if (!a) return fail("Sign in first.");

  const { data, error } = await a.supabase.rpc("start_conversation", {
    p_username: username,
    p_listing: listingId ?? null,
  });
  if (error || !data) return fail(readable(error));

  revalidatePath("/messages");
  return { ok: true, data: { id: data as string } };
}

export interface InboxRow {
  id: string;
  /** 'party' is the group a finalised recruitment deal opened. */
  kind: "direct" | "party";
  /** Set on a party, which names itself. Null on a direct message. */
  title: string | null;
  member_count: number;
  last_message_at: string;
  listing_id: string | null;
  /**
   * The other person, on a DIRECT message only.
   *
   * Null for a party, and deliberately so. These used to come from a second
   * join on "everybody who is not me", which returns one row when a
   * conversation holds two people and four rows when it holds five — the same
   * party listed four times in the inbox, once under each member's name.
   */
  other_username: string | null;
  other_display_name: string | null;
  other_avatar_url: string | null;
  other_online: boolean | null;
  last_body: string | null;
  last_sender_is_me: boolean | null;
  unread: number;
}

/**
 * The inbox.
 *
 * Returns an empty list rather than throwing when there is no database, which
 * is what keeps every screen reviewable before Supabase is attached — and, in
 * production, turns an outage into an empty inbox rather than a crash on the
 * tab a player checks most.
 */
export async function readInbox(): Promise<InboxRow[]> {
  const a = await actor();
  if (!a) return [];
  const { data, error } = await a.supabase.rpc("my_conversations");
  if (error || !Array.isArray(data)) return [];
  return data as InboxRow[];
}

export interface ThreadMessage {
  id: string;
  body: string;
  created_at: string;
  mine: boolean;
  /** 'system' is the site talking — the notice a party opens with. */
  kind?: "chat" | "system";
  pinned?: boolean;
  /**
   * Who sent it. A direct message has one other person and the header names
   * them, so this goes unused there. A party has several, and a line nobody is
   * attributed to in a group of six is the shape every impersonation takes.
   */
  sender_username?: string;
  sender_display_name?: string | null;
  sender_avatar_url?: string | null;
}

export interface ThreadMember {
  username: string;
  display_name?: string | null;
  avatar_url?: string | null;
  is_me: boolean;
}

export interface Thread {
  /** 'party' is the group chat a finalised recruitment deal opens. */
  kind: "direct" | "party";
  /** A party names itself. Null on a direct message, which uses `other`. */
  title: string | null;
  other: {
    username?: string;
    display_name?: string | null;
    avatar_url?: string | null;
    online?: boolean;
  };
  members: ThreadMember[];
  /** The notice a party opened with, kept out of the scroll. */
  pinned: { id: string; body: string; created_at: string } | null;
  messages: ThreadMessage[];
}

/** One conversation. Null where the caller is not in it — which is a 404. */
export async function readThread(conversationId: string): Promise<Thread | null> {
  const a = await actor();
  if (!a) return null;
  const { data, error } = await a.supabase.rpc("conversation_thread", {
    p_conversation: conversationId,
  });
  if (error || !data) return null;
  return data as Thread;
}

/**
 * Send one.
 *
 * A direct insert rather than an RPC, because the insert policy on messages is
 * already the complete rule — sender is you, you are in the thread, and your
 * account is in good standing — and a function wrapping it would be a second
 * place for that rule to drift out of. The rate limit and the server-owned
 * timestamp come from a trigger, so they apply here and to every other route
 * into the table equally.
 */
export async function sendMessage(
  conversationId: string,
  body: string,
): Promise<Result> {
  const a = await actor();
  if (!a) return fail("Sign in first.");

  const text = body.trim();
  if (!text) return fail("Type something first.");
  if (text.length > MAX_MESSAGE_LENGTH) {
    return fail(`That is longer than ${MAX_MESSAGE_LENGTH} characters.`);
  }

  const { error } = await a.supabase.from("messages").insert({
    conversation_id: conversationId,
    sender_id: a.profile.id,
    body: text,
  });

  if (error) {
    // There is no blocking on this site, so a policy refusal here means one
    // thing: the sender's own account has been restricted or suspended. Saying
    // so plainly beats "something went wrong" — they need to know it is about
    // them and not a glitch to retry.
    if (error.code === "42501" || error.message?.includes("row-level security")) {
      return fail("Your account cannot send messages right now.");
    }
    return fail(readable(error));
  }

  revalidatePath("/messages");
  return { ok: true };
}

export async function markRead(conversationId: string): Promise<void> {
  const a = await actor();
  if (!a) return;
  await a.supabase.rpc("mark_conversation_read", { p_conversation: conversationId });
  revalidatePath("/messages");
}

/** How many threads have something new. Drives the badge on the rail. */
export async function unreadCount(): Promise<number> {
  const a = await actor();
  if (!a) return 0;
  const { data, error } = await a.supabase.rpc("unread_count");
  if (error || typeof data !== "number") return 0;
  return data;
}

/**
 * Report a message.
 *
 * Lands in the same admin queue as every other report — see the reports table
 * and ReportsPanel. A chat nobody can report is a chat that only works for
 * whoever is behaving worst in it.
 */
export async function reportMessage(
  messageId: string,
  reason: string,
  detail?: string,
): Promise<Result> {
  const a = await actor();
  if (!a) return fail("Sign in first.");

  const { error } = await a.supabase.from("reports").insert({
    reporter_id: a.profile.id,
    subject_type: "message",
    subject_id: messageId,
    reason,
    detail: detail?.slice(0, 1000) ?? null,
  });

  if (error) {
    // The unique index allows one OPEN report per person per subject, so a
    // second one is not an error worth alarming somebody about.
    if (error.code === "23505") return { ok: true };
    return fail(readable(error));
  }
  return { ok: true };
}
