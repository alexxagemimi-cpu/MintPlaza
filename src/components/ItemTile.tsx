"use client";

import { useState } from "react";
import {
  CHROMATIC_STYLE, CLASS_STYLE, RARITY_STYLE, TYPE_STYLE, thumbnailFor,
  type CatalogItem,
} from "@/lib/items";

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
        // Two shadows, and the order matters. The inset is the ring itself and
        // scales with the tier; the outer one is the halo, and only the top two
        // tiers have it. Where a game has no artwork this ring is the only
        // thing carrying rarity, so it is drawn at full strength rather than as
        // the hairline a tile-behind-a-picture would want.
        boxShadow: [
          `inset 0 0 0 ${style.weight}px ${style.ring}`,
          style.glow ? `0 0 0 3px ${style.glow}` : "",
        ]
          .filter(Boolean)
          .join(", "),
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
 * The game's own word for the tier, beside MintPlaza's.
 *
 * Worth its own chip because the two genuinely differ, and for Fisch the
 * difference is the entire top of the market: Exotic, Secret, Apex and Divine
 * Secret all map to "Mythical" on the shared ladder, because there is nothing
 * above Mythical to map them to. Showing only the mapped tier would tell a
 * player their Divine Secret and somebody's Exotic are the same class of
 * thing. They are not, and the gap between them is most of the trade.
 *
 * Suppressed when it just repeats the rarity chip — an item whose native word
 * is "Rare" and whose mapped tier is "Rare" does not need to say so twice.
 */
export function TypeChip({ type }: { type: string }) {
  const s = TYPE_STYLE[type];
  if (!s) {
    return (
      <span className="font-mono text-[0.5625rem] tracking-[0.08em] text-ink-faint">
        {type.toUpperCase()}
      </span>
    );
  }
  return (
    <span
      className="rounded-md px-1.5 py-0.5 font-mono text-[0.5625rem] font-bold tracking-[0.08em]"
      style={{
        color: s.fg,
        background: s.bg,
        boxShadow: [
          `inset 0 0 0 1px ${s.ring}`,
          s.glow ? `0 0 0 2px ${s.glow}` : "",
        ]
          .filter(Boolean)
          .join(", "),
      }}
    >
      {type.toUpperCase()}
    </span>
  );
}

/**
 * Limited, Extinct, Relic and the rest — outlined, never filled.
 *
 * The visual difference from a tier chip is the point. These sit alongside a
 * rarity rather than replacing it, and a Limited Common is still Common; a
 * filled badge would read as a tier and quietly promote an eighth of the Fisch
 * catalogue.
 */
export function ClassChip({ label }: { label: string }) {
  const s = CLASS_STYLE[label] ?? { fg: "#5A6B65", ring: "#5A6B654D" };
  return (
    <span
      className="rounded-md px-1.5 py-0.5 font-mono text-[0.5rem] font-medium tracking-[0.08em]"
      style={{ color: s.fg, boxShadow: `inset 0 0 0 1px ${s.ring}` }}
    >
      {label.toUpperCase()}
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
