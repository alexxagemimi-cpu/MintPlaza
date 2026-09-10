"use server";

import { revalidatePath } from "next/cache";
import { serverSupabase, currentProfile } from "@/lib/supabase/server";
import { PROOF_MAX_BYTES, PROOF_TYPES, CAPTION_MAX } from "@/lib/profile";
import type { Result } from "./board";

/**
 * Editing your own profile.
 *
 * Same shape as every other action file here: a thin wrapper over one database
 * function, where the database function is the thing that actually holds the
 * rule. The checks in this file make the message nicer; the checks in the
 * database make it true, and the REST endpoint is reachable without ever
 * loading this code.
 */

const fail = (error: string): Result<never> => ({ ok: false, error });

async function actor() {
  const supabase = await serverSupabase();
  if (!supabase) return null;
  const profile = await currentProfile();
  if (!profile) return null;
  return { supabase, profile };
}

function refresh() {
  revalidatePath("/app", "layout");
}

/**
 * Description, game tags and custom tags, in one write.
 *
 * One call rather than three, because "Submit changes" is one button and a
 * player who edits all three should not be able to end up with the description
 * saved and the tags lost.
 */
export async function saveProfile(input: {
  bio: string;
  games: string[];
  tags: string[];
}): Promise<Result<{ bio: string | null; gameTags: string[]; tags: string[] }>> {
  const a = await actor();
  if (!a) return fail("Sign in first.");

  const { data, error } = await a.supabase.rpc("save_profile", {
    p_bio: input.bio,
    p_games: input.games,
    p_tags: input.tags,
  });

  // Every message the function raises is written to be read by a player, so it
  // goes straight through rather than being replaced by something vaguer.
  if (error) return fail(error.message.replace(/^.*?:\s*/, ""));

  refresh();
  const saved = data as { bio: string | null; game_tags: string[]; tags: string[] };
  return {
    ok: true,
    data: { bio: saved.bio, gameTags: saved.game_tags ?? [], tags: saved.tags ?? [] },
  };
}

/**
 * Post a picture.
 *
 * The file goes up through the server rather than straight from the browser,
 * so the size and the type are looked at by something the player does not
 * control. The bucket enforces both again, and the storage policy will only
 * accept a path beginning with the uploader's own id — three answers to the
 * same question, which is the right number for the one place on this site
 * where a stranger hands us a file.
 *
 * The row is written only after the upload lands. A row pointing at a file
 * that never arrived would render as a broken picture on a page whose whole
 * purpose is looking trustworthy.
 */
export async function uploadProof(form: FormData): Promise<Result<{ path: string }>> {
  const a = await actor();
  if (!a) return fail("Sign in first.");

  const file = form.get("file");
  const gameSlug = String(form.get("gameSlug") ?? "");
  const caption = String(form.get("caption") ?? "").slice(0, CAPTION_MAX);

  if (!(file instanceof File) || file.size === 0) return fail("Pick a picture first.");
  if (file.size > PROOF_MAX_BYTES) {
    return fail("That picture is over 3 MB. A screenshot straight from the game will be well under.");
  }
  if (!PROOF_TYPES.includes(file.type as (typeof PROOF_TYPES)[number])) {
    return fail("PNG, JPG or WEBP only.");
  }

  const ext = file.type === "image/png" ? "png" : file.type === "image/webp" ? "webp" : "jpg";
  // Random, not sequential: a guessable path would let anybody walk another
  // player's folder, and these are pictures of children's game accounts.
  const path = `${a.profile.id}/${gameSlug}/${crypto.randomUUID()}.${ext}`;

  const { error: upError } = await a.supabase.storage
    .from("proofs")
    .upload(path, file, { contentType: file.type, upsert: false });
  if (upError) return fail("Could not upload that picture. Try again.");

  const { error } = await a.supabase.rpc("add_proof", {
    p_game: gameSlug,
    p_path: path,
    p_caption: caption,
  });

  if (error) {
    // The row is what makes the file part of a profile, so a file with no row
    // is litter in a bucket somebody else is paying for. Clean it up rather
    // than leaving it.
    await a.supabase.storage.from("proofs").remove([path]);
    return fail(error.message.replace(/^.*?:\s*/, ""));
  }

  refresh();
  return { ok: true, data: { path } };
}

/**
 * Take a picture down.
 *
 * The row first, then the file. In that order because the row is what the page
 * reads: if the second step fails the picture has already stopped being part
 * of the profile, which is what the player asked for. The other order would
 * leave a visible row pointing at a deleted file.
 */
export async function deleteProof(id: string): Promise<Result> {
  const a = await actor();
  if (!a) return fail("Sign in first.");

  const { data, error } = await a.supabase.rpc("delete_proof", { p_id: id });
  if (error) return fail("Could not remove that. Try again.");

  const path = data as string | null;
  if (path) await a.supabase.storage.from("proofs").remove([path]);

  refresh();
  return { ok: true };
}
