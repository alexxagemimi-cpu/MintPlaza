import type { Service, ServiceKind } from "@/lib/sessions";

/**
 * The picture on a crew call.
 *
 * On a board of raids the picture is the fastest thing on the card: a player
 * recognises the Leviathan's silhouette or the Kitsune shrine before they have
 * read a single word, which is the difference between scanning nine posts and
 * reading nine posts.
 *
 * Where there is no real screenshot the tile falls back to the kind, in that
 * kind's own colour, rather than borrowing a picture that nearly fits. A photo
 * of the wrong boss on a Cursed Captain post is worse than no photo — it sends
 * somebody to the wrong island.
 */

const KIND_TONE: Record<ServiceKind, string> = {
  Raid: "#A93226",
  Trial: "#6B4CA8",
  Puzzle: "#2C6C9E",
  Boss: "#A8501E",
  Unlock: "#2F7D57",
  Grind: "#465650",
  Island: "#0E7C86",
  Crew: "#8A5A12",
  Event: "#9B3B6E",
  Hunt: "#A93226",
};

export function ServiceArt({
  service, size = 46, rounded = 12,
}: {
  service: Pick<Service, "name" | "kind" | "art">;
  size?: number;
  rounded?: number;
}) {
  const tone = KIND_TONE[service.kind] ?? "#465650";

  return (
    <span
      // Decorative in every place it is used: the name is always beside it in
      // text, so letting the tile into the accessible name would only make a
      // screen reader read the listing title twice.
      aria-hidden="true"
      className="grid shrink-0 place-items-center overflow-hidden"
      style={{
        width: size,
        height: size,
        borderRadius: rounded,
        background: service.art ? "#0D1613" : `${tone}14`,
        boxShadow: `inset 0 0 0 1px ${tone}2E`,
      }}
    >
      {service.art ? (
        /* eslint-disable-next-line @next/next/no-img-element */
        <img
          src={service.art}
          alt=""
          loading="lazy"
          decoding="async"
          className="h-full w-full object-cover"
        />
      ) : (
        <span
          className="font-mono font-bold leading-none"
          style={{ color: tone, fontSize: Math.max(7, size * 0.19), letterSpacing: "0.06em" }}
        >
          {service.kind.toUpperCase()}
        </span>
      )}
    </span>
  );
}
