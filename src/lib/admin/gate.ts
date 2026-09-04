"use server";

import { cookies } from "next/headers";
import { serverSupabase } from "@/lib/supabase/server";

/**
 * The passcode on the panel door.
 *
 * What this is for, plainly: the account is the lock, and this is the latch. If
 * the owner's tablet is left unlocked and signed in, whoever picks it up still
 * cannot open the panel without also knowing the code. It is not what stops an
 * attacker on the internet — being the one allowlisted Roblox account is, and
 * row-level security enforces that on every write regardless of this.
 *
 * The code itself never appears in this codebase. It lives in the database as a
 * bcrypt hash, is compared there, and five wrong answers in fifteen minutes
 * stops it answering at all.
 *
 * A success returns a random token that is stored only as a hash. The raw token
 * goes into an httpOnly cookie, so no script on the page can read it, and it
 * expires after eight hours.
 */

const COOKIE = "mp_console";
const EIGHT_HOURS = 60 * 60 * 8;

export async function isUnlocked(): Promise<boolean> {
  const supabase = await serverSupabase();
  if (!supabase) return false;

  const token = (await cookies()).get(COOKIE)?.value;
  if (!token) return false;

  const { data, error } = await supabase.rpc("console_unlocked", { p_token: token });
  return !error && data === true;
}

export async function unlockConsole(
  passcode: string,
): Promise<{ ok: true } | { ok: false; error: string }> {
  const supabase = await serverSupabase();
  if (!supabase) return { ok: false, error: "No database configured." };

  const { data, error } = await supabase.rpc("console_unlock", { p_passcode: passcode });

  if (error || typeof data !== "string" || data.length === 0) {
    // Deliberately one message for a wrong code and for too many tries. Telling
    // someone which of the two happened tells them whether the code was close.
    return { ok: false, error: "That code did not open it. Check it and try again." };
  }

  (await cookies()).set(COOKIE, data, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: EIGHT_HOURS,
  });
  return { ok: true };
}

export async function lockConsole(): Promise<void> {
  const store = await cookies();
  const token = store.get(COOKIE)?.value;
  if (token) {
    const supabase = await serverSupabase();
    await supabase?.rpc("console_lock", { p_token: token });
  }
  store.delete(COOKIE);
}
