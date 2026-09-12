"use client";

import { useState } from "react";
import { CHROMATIC_STYLE, RARITY_STYLE, thumbnailFor, type CatalogItem } from "@/lib/items";

/**
 * One catalogue item, the way a trading site shows it.
 *
 * Where artwork exists it leads. Where it does not, the tile falls back to the
 * item's initials on a rarity-keyed ground — legible, consistent, and honest
 * about being a placeholder rather than a broken image.
 *
 * ---------------------------------------------------------------------------
 * Why this is a client component, and a plain <img>
 * ---------------------------------------------------------------------------
 *
 * Most of these pictures are resolved at request time from Roblox's thumbnail
 * API, and that call legitimately fails: Roblox generates thumbnails lazily, so
 * a perfectly valid asset id can answer "pending" and have no image yet. A tile
 * with no error path turns every one of those into a broken-image icon. The
 * `onError` handler is the whole reason for "use client" — it is what lets a
 * missing picture degrade into the typographic tile, which is a design rather
 * than a failure.
 *
 * It is a plain `<img>` rather than next/image deliberately. These render at 44
 * to 56 pixels, so there is nothing meaningful to optimise; next/image would
 * add a remote-host allowlist to maintain as Roblox rotates CDN domains, and
 * would route ten thousand thumbnails through the optimiser for no gain.
 */
export function ItemTile({
  item,
  size = 56,
}: {
  item: CatalogItem;
  size?: number;
}) {
  const style = item.rarity ? RARITY_STYLE[item.rarity] : RARITY_STYLE.Common;
  const [failed, setFailed] = useState(false);
  const src = thumbnailFor(item);

  // Seven Fisch entries are named with a single emoji and nothing else. Taking
  // `[0]` of one of those yields half a surrogate pair, which renders as the
  // replacement character — so a codepoint-aware split is used, and a name with
  // no letters in it shows the glyph itself rather than an initial of it. For
  // those rows the emoji IS the icon, which is better than any placeholder.
  const glyph = [...item.name][0] ?? "?";
  const hasLetters = /\p{L}/u.test(item.name);
  const initials = hasLetters
    ? item.name
        .split(/[\s-]+/)
        .slice(0, 2)
        .map((w) => [...w][0] ?? "")
        .join("")
        .toUpperCase()
    : glyph;

  return (
    <span
      className="relative grid shrink-0 place-items-center overflow-hidden"
      style={{
        width: size,
        height: size,
        borderRadius: Math.round(size * 0.26),
        background: style.bg,
        boxShadow: `inset 0 0 0 1px ${style.ring}`,
      }}
    >
      {src && !failed ? (
        // eslint-disable-next-line @next/next/no-img-element -- see note above
        <img
          src={src}
          alt=""
          loading="lazy"
          decoding="async"
          onError={() => setFailed(true)}
          className="h-full w-full object-contain p-1"
        />
      ) : (
        <span
          aria-hidden="true"
          className="font-mono font-bold leading-none"
          style={{ color: style.fg, fontSize: size * 0.3, letterSpacing: "-0.03em" }}
        >
          {initials || "?"}
        </span>
      )}
    </span>
  );
}

/** The small rarity chip that sits beside an item name. */
export function RarityChip({ rarity }: { rarity: NonNullable<CatalogItem["rarity"]> }) {
  const s = RARITY_STYLE[rarity];
  return (
    <span
      className="rounded-md px-1.5 py-0.5 font-mono text-[0.5625rem] font-medium tracking-[0.08em]"
      style={{ color: s.fg, background: s.bg, boxShadow: `inset 0 0 0 1px ${s.ring}` }}
    >
      {rarity.toUpperCase()}
    </span>
  );
}

/**
 * CHROMATIC sits beside the rarity rather than replacing it — the game shows
 * "Common / CHROMATIC", and on a skin that pairing is the whole point.
 */
export function ChromaticChip() {
  return (
    <span
      title="CHROMATIC — recolours the fruit, its abilities and its icon"
      className="rounded-md px-1.5 py-0.5 font-mono text-[0.5625rem] font-medium tracking-[0.08em]"
      style={{
        color: CHROMATIC_STYLE.fg,
        background: CHROMATIC_STYLE.bg,
        boxShadow: `inset 0 0 0 1px ${CHROMATIC_STYLE.ring}`,
      }}
    >
      CHROMATIC
    </span>
  );
}

/** Robux price, where the item has one. */
export function RobuxChip({ amount }: { amount: number }) {
  return (
    <span className="font-mono text-[0.5625rem] font-medium tracking-[0.08em] text-ink-mute">
      R${amount.toLocaleString("en-US")}
    </span>
  );
}
