import Image from "next/image";
import type { Game } from "@/lib/games";

/**
 * What a game looks like before anybody has uploaded its cover.
 *
 * A game can exist on MintPlaza with no picture — one added in the Studio
 * starts that way, and so does one added in code ahead of the artwork. An
 * empty `src` renders as a broken image and re-requests the page, so this
 * stands in: the game's own hue, its initials, and nothing pretending to be a
 * screenshot of a game it is not.
 */
function Initials({ game, size, radius }: { game: Game; size: number; radius: number }) {
  // A short one-word name reads better whole than abbreviated: "GAG2" is
  // recognisable, "GA" is Garden. Anything longer falls back to initials.
  const words = game.shortName.split(/\s+/);
  const letters =
    words.length === 1 && words[0].length <= 4
      ? words[0].toUpperCase()
      : words.map((w) => w[0]).join("").slice(0, 2).toUpperCase();
  return (
    <span
      aria-hidden="true"
      className="grid shrink-0 place-items-center font-extrabold tracking-[-0.03em]"
      style={{
        width: size, height: size, borderRadius: radius,
        fontSize: Math.max(8, size * (letters.length > 2 ? 0.24 : 0.34)),
        color: game.hue || "var(--color-ink-mute)",
        background: `color-mix(in srgb, ${game.hue || "#66766F"} 14%, white)`,
        boxShadow: `inset 0 0 0 1px color-mix(in srgb, ${game.hue || "#66766F"} 28%, transparent)`,
      }}
    >
      {letters}
    </span>
  );
}

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
  if (!game.art) return <Initials game={game} size={size} radius={r} />;
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
  if (!game.art) {
    return (
      <span
        className="grid aspect-[4/3] w-full place-items-center text-[2rem] font-extrabold"
        style={{
          color: game.hue || "var(--color-ink-mute)",
          background: `color-mix(in srgb, ${game.hue || "#66766F"} 12%, white)`,
        }}
      >
        {game.shortName}
      </span>
    );
  }
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
