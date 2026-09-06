import type { ServiceRef } from "@/lib/sessions";

/**
 * A reference picture.
 *
 * Drawn the same way the item catalogue draws a fruit with no artwork yet: a
 * typographic tile keyed to a colour. That is deliberate rather than a
 * placeholder to be embarrassed about — it reads cleanly, it never pretends to
 * be a picture it is not, and dropping a real file in later changes nothing
 * else. The control panel can add the artwork without a deploy.
 */
export function RefTile({ item, size = 38 }: { item: ServiceRef; size?: number }) {
  const hue = item.hue ?? "#465650";
  const initials = item.label
    .split(/[\s-]+/).slice(0, 2).map((w) => w[0] ?? "").join("").toUpperCase();

  return (
    <span
      // Decorative. The initials are a stand-in for artwork, not information —
      // every place this appears already says the label in text next to it, and
      // letting "AN" into the accessible name would have a screen reader
      // announce the button as "AN Angel".
      aria-hidden="true"
      title={item.label}
      className="grid shrink-0 place-items-center overflow-hidden rounded-[10px] font-mono font-bold"
      style={{
        width: size, height: size, fontSize: size * 0.34,
        color: hue,
        background: `${hue}14`,
        boxShadow: `inset 0 0 0 1px ${hue}2E`,
      }}
    >
      {item.art ? (
        /* eslint-disable-next-line @next/next/no-img-element */
        <img src={item.art} alt="" className="h-full w-full object-contain" />
      ) : (
        initials
      )}
    </span>
  );
}
