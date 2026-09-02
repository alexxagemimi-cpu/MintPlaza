import type { Game } from "@/lib/games";

/**
 * A game's identity tile. Two letters on a tinted glass square.
 *
 * MintPlaza uses no Roblox or game artwork, logos or branding (§30), so a
 * game's identity here is its own: a restrained hue and a lettermark.
 */
export function GameMark({
  game,
  size = 44,
}: {
  game: Game;
  size?: number;
}) {
  return (
    <span
      aria-hidden="true"
      className="grid shrink-0 place-items-center font-mono font-bold"
      style={{
        width: size,
        height: size,
        borderRadius: size * 0.32,
        fontSize: size * 0.31,
        letterSpacing: "-0.02em",
        color: game.hue,
        background: `linear-gradient(155deg, ${game.hue}22, ${game.hue}0A)`,
        border: `1px solid ${game.hue}33`,
        boxShadow: `inset 0 1px 0 0 ${game.hue}1F`,
      }}
    >
      {game.mark}
    </span>
  );
}
