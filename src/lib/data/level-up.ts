import { serverSupabase } from "@/lib/supabase/server";
import { NO_LEVEL_UP, type LevelUpStatus } from "@/lib/level-up";

/**
 * Reading whether the signed-in player is on Level Up.
 *
 * One function, and it asks the database rather than working it out here. That
 * is not indirection for its own sake: `my_level_up()` answers for the caller
 * and takes no user id, so there is no version of this call that can be aimed
 * at somebody else's account. Who pays for what is not a fact this site
 * publishes, and the only way to keep that true is to have no code path that
 * could leak it.
 *
 * Nothing here throws. With no database configured — which is how the whole
 * interface stays reviewable before Supabase is connected — every player reads
 * as not subscribed, which is the safe direction to be wrong in: the free
 * limits apply and nobody is handed a perk they did not buy.
 */
export type { LevelUpStatus };

export async function readLevelUp(): Promise<LevelUpStatus> {
  const supabase = await serverSupabase();
  if (!supabase) return NO_LEVEL_UP;

  const { data, error } = await supabase.rpc("my_level_up");
  if (error || !data) return NO_LEVEL_UP;

  const row = data as {
    active?: boolean;
    expires_at?: string | null;
    days_left?: number | null;
    lapsed?: boolean | null;
  };

  return {
    active: row.active === true,
    expiresAt: row.expires_at ?? null,
    daysLeft: typeof row.days_left === "number" ? row.days_left : null,
    lapsed: row.lapsed === true,
  };
}
