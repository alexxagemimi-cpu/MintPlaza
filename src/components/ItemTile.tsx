import Image from "next/image";
import { RARITY_STYLE, type CatalogItem } from "@/lib/items";

/**
 * One catalogue item, the way a trading site shows it.
 *
 * Where artwork exists it leads. Where it does not, the tile falls back to the
 * item's initials on a rarity-keyed ground — legible, consistent, and honest
 * about being a placeholder rather than a broken image.
 */
export function ItemTile({
  item,
  size = 56,
}: {
  item: CatalogItem;
  size?: number;
}) {
  const style = item.rarity ? RARITY_STYLE[item.rarity] : RARITY_STYLE.Common;
  const initials = item.name
    .split(/[\s-]+/)
    .slice(0, 2)
    .map((w) => w[0])
    .join("")
    .toUpperCase();

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
      {item.art ? (
        <Image
          src={item.art}
          alt=""
          width={size * 2}
          height={size * 2}
          className="h-full w-full object-contain p-1"
        />
      ) : (
        <span
          aria-hidden="true"
          className="font-mono font-bold leading-none"
          style={{ color: style.fg, fontSize: size * 0.3, letterSpacing: "-0.03em" }}
        >
          {initials}
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
