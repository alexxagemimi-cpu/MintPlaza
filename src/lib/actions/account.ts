"use server";

import { revalidatePath } from "next/cache";
import { serverSupabase, currentProfile } from "@/lib/supabase/server";
import type { Result } from "./board";

/**
 * Your own account.
 *
 * Every one of these is a thin wrapper over a database function, and the rule
 * each enforces lives in that function rather than here. That is not ceremony:
 * a check written in this file protects the button, while a check written in
 * the database protects the account — and the REST API is reachable without
 * ever loading this file.
 *
 * So `set_display_name` refuses an impersonating name whether or not this
 * function asks it to, and `touch_presence` stops writing when somebody has
 * gone invisible whether or not the caller remembers to look.
 */

const fail = (error: string): Result<never> => ({ ok: false, error });

async function actor() {
  const supabase = await serverSupabase();
  if (!supabase) return null;
  const profile = await currentProfile();
  if (!profile) return null;
  return { supabase, profile };
}

/**
 * The name other players see.
 *
 * Never the Roblox username — that is the account's identity and the only
 * thing another player can check. This sits beside it, and the interface shows
 * both, so a display name can decorate but never disguise.
 */
export async function setDisplayName(name: string): Promise<Result<string | null>> {
  const a = await actor();
  if (!a) return fail("Sign in first.");

  const { data, error } = await a.supabase.rpc("set_display_name", { p_name: name });
  // The database raises with a message written to be read by a person, so it
  // goes straight through rather than being replaced by something vaguer.
  if (error) return fail(error.message.replace(/^.*?:\s*/, ""));

  revalidatePath("/app", "layout");
  return { ok: true, data: (data as string | null) ?? null };
}

/**
 * Appear offline.
 *
 * Kept on the profile rather than in this browser, because the green dot is
 * something *other people* see. A setting stored on this device would show you
 * as hidden to yourself while everybody else still watched you come online,
 * which is the exact opposite of what the switch promises.
 */
export async function setHidePresence(hide: boolean): Promise<Result> {
  const a = await actor();
  if (!a) return fail("Sign in first.");
  const { error } = await a.supabase.rpc("set_hide_presence", { p_hide: hide });
  if (error) return fail("Could not change that. Try again.");
  revalidatePath("/app", "layout");
  return { ok: true };
}

/**
 * Leave, and take everything with you.
 *
 * Deletes the profile, which cascades to every listing, vote, pick, comment
 * and contact hanging off it. Irreversible, and the interface makes you type
 * your username first — not as a formality, but because this is the one button
 * on the site whose mistake cannot be undone by pressing it again.
 *
 * The Roblox account itself is untouched. MintPlaza never had anything but a
 * name and a picture, and this hands both back.
 */
export async function deleteAccount(confirmation: string): Promise<Result> {
  const a = await actor();
  if (!a) return fail("Sign in first.");

  if (confirmation.trim().toLowerCase() !== a.profile.username.toLowerCase()) {
    return fail("That is not your username. Nothing has been deleted.");
  }

  const { error } = await a.supabase.rpc("delete_my_account");
  if (error) return fail("Could not delete the account. Nothing has changed.");
  return { ok: true };
}
