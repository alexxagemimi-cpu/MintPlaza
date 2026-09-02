import Image from "next/image";
import type { Game } from "@/lib/games";

/**
 * A game's cover art, square.
 *
 * The artwork is each game's own promotional image, used to identify the game
 * it belongs to. A hairline inset keeps busy, high-contrast art from bleeding
 * into the white surface it sits on.
 */
export function GameArt({
  game,
  size = 44,
  radius,
}: {
  game: Game;
  size?: number;
  radius?: number;
}) {
  const r = radius ?? Math.round(size * 0.3);
  return (
    <span
      className="relative block shrink-0 overflow-hidden bg-sunk"
      style={{ width: size, height: size, borderRadius: r }}
    >
      <Image
        src={game.art}
        alt=""
        width={size * 2}
        height={size * 2}
        className="h-full w-full object-cover"
        sizes={`${size}px`}
      />
      <span
        aria-hidden="true"
        className="pointer-events-none absolute inset-0"
        style={{ borderRadius: r, boxShadow: "inset 0 0 0 1px rgba(13,22,19,0.12)" }}
      />
    </span>
  );
}

/**
 * The same art as a banner, for cards that lead with the image. Kept at 4:3
 * because four of the six covers are square and a wider crop cuts their logos.
 * `priority` is for covers above the fold only.
 */
export function GameCover({
  game,
  priority = false,
}: {
  game: Game;
  priority?: boolean;
}) {
  return (
    <span className="relative block aspect-[4/3] w-full overflow-hidden bg-sunk">
      <Image
        src={game.art}
        alt={`${game.name} cover art`}
        fill
        priority={priority}
        className="object-cover"
        sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 360px"
      />
    </span>
  );
}
