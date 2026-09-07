import { redirect } from "next/navigation";
import { DEFAULT_GAME_SLUG } from "@/lib/games";

/**
 * Settings has no page of its own.
 *
 * It is a panel over the dashboard, because everything in it is a decision
 * about the screen you are already on — losing your place to a separate page
 * and having to find your way back is the wrong shape for "log me out". This
 * route only exists so an old link, a bookmark or the rail's own gear lands
 * somewhere sensible rather than on a 404.
 */
export default function SettingsPage() {
  redirect(`/app/${DEFAULT_GAME_SLUG}?settings=1`);
}
