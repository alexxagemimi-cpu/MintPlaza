import { redirect } from "next/navigation";
import { DEFAULT_GAME_SLUG } from "@/lib/games";

/**
 * Once accounts exist this resolves to the player's last selected game.
 * Until then it opens the first in the registry.
 */
export default function AppIndex() {
  redirect(`/app/${DEFAULT_GAME_SLUG}`);
}
