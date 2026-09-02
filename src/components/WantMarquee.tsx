import Image from "next/image";
import { allWants, type Want, type WantKind } from "@/lib/games";

/**
 * The promise on the homepage: the things players in these six games actually
 * ask for, moving past.
 *
 * The cards are generated from the game registry, so what the homepage promises
 * and what the product runs on are the same data. Marketing copy written
 * separately from the system is how a site ends up promising things it does not
 * do.
 *
 * Pure CSS animation, duplicated once and translated -50%, so it loops without
 * a script. Under prefers-reduced-motion the global stylesheet stops it, and
 * the row simply sits still with its cards readable.
 */

const KIND_META: Record<WantKind, { label: string; path: string }> = {
  trade: {
    label: "Trade",
    path: "M2.5 6h9.5M9.5 3.5 12 6 9.5 8.5M15.5 12H6M8.5 9.5 6 12l2.5 2.5",
  },
  group: {
    label: "Group",
    path: "M11.5 15v-1.2a2.8 2.8 0 0 0-2.8-2.8H4.8A2.8 2.8 0 0 0 2 13.8V15M6.8 8.2a2.6 2.6 0 1 0 0-5.2 2.6 2.6 0 0 0 0 5.2M16 15v-1.2a2.8 2.8 0 0 0-2.1-2.7M11.4 3.1a2.6 2.6 0 0 1 0 5",
  },
  help: {
    label: "Help",
    path: "M9 16.2A7.2 7.2 0 1 0 9 1.8a7.2 7.2 0 0 0 0 14.4ZM6.9 6.8a2.1 2.1 0 1 1 2.8 2 1.3 1.3 0 0 0-.7 1.2v.4M9 12.8h.01",
  },
  check: {
    label: "Value check",
    path: "M9 2.2 3 4.4v3.7C3 12 5.5 14.9 9 15.9c3.5-1 6-3.9 6-7.8V4.4L9 2.2ZM6.5 8.6 8.3 10.4l3.4-3.5",
  },
};

function KindIcon({ kind }: { kind: WantKind }) {
  return (
    <svg
      width="17"
      height="17"
      viewBox="0 0 18 18"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d={KIND_META[kind].path} />
    </svg>
  );
}

type Row = readonly (Want & { game: ReturnType<typeof allWants>[number]["game"] })[];

function WantCard({ want }: { want: Row[number] }) {
  return (
    <li className="glass flex w-[19.5rem] shrink-0 items-start gap-3.5 rounded-[var(--radius-inner)] p-4">
      <span
        className="mt-0.5 grid h-8 w-8 shrink-0 place-items-center rounded-[10px]"
        style={{
          color: want.game.hue,
          background: `${want.game.hue}18`,
          boxShadow: `inset 0 0 0 1px ${want.game.hue}2E`,
        }}
      >
        <KindIcon kind={want.kind} />
      </span>

      <span className="min-w-0 flex-1">
        <span className="block text-[0.9375rem] font-bold leading-snug tracking-[-0.015em] text-ink">
          {want.label}
        </span>
        {want.detail && (
          <span className="mt-1 block text-[0.75rem] leading-snug text-ink-mute">
            {want.detail}
          </span>
        )}
        <span className="mt-2.5 flex items-center gap-1.5">
          <Image
            src={want.game.art}
            alt=""
            width={32}
            height={32}
            className="h-4 w-4 rounded-[5px] object-cover"
          />
          <span className="font-mono text-[0.625rem] tracking-[0.06em] text-ink-faint">
            {want.game.shortName.toUpperCase()}
          </span>
        </span>
      </span>
    </li>
  );
}

function MarqueeRow({
  items,
  seconds,
  reverse = false,
}: {
  items: Row;
  seconds: number;
  reverse?: boolean;
}) {
  return (
    <div className="group relative overflow-hidden py-2">
      <ul
        className="flex w-max items-stretch gap-3 group-hover:[animation-play-state:paused]"
        style={{
          animation: `marquee ${seconds}s linear infinite`,
          animationDirection: reverse ? "reverse" : "normal",
        }}
      >
        {items.map((w, i) => (
          <WantCard key={`a-${i}`} want={w} />
        ))}
        {/* The duplicate is what makes -50% loop seamlessly. */}
        {items.map((w, i) => (
          <WantCard key={`b-${i}`} want={w} />
        ))}
      </ul>
    </div>
  );
}

export function WantMarquee() {
  const wants = allWants();

  // Round-robin across games so neighbours never share one, which otherwise
  // parks the near-identical value-check cards next to each other.
  const byGame = new Map<string, typeof wants[number][]>();
  for (const w of wants) {
    const list = byGame.get(w.game.slug) ?? [];
    list.push(w);
    byGame.set(w.game.slug, list);
  }
  const queues = [...byGame.values()];
  const ordered: typeof wants[number][] = [];
  for (let i = 0; ordered.length < wants.length; i++) {
    for (const q of queues) if (q[i]) ordered.push(q[i]);
  }

  // Alternate rows so each carries a spread of games rather than a block.
  const top = ordered.filter((_, i) => i % 2 === 0);
  const bottom = ordered.filter((_, i) => i % 2 === 1);

  return (
    <div
      className="relative"
      style={{
        WebkitMaskImage:
          "linear-gradient(90deg, transparent 0%, #000 12%, #000 88%, transparent 100%)",
        maskImage: "linear-gradient(90deg, transparent 0%, #000 12%, #000 88%, transparent 100%)",
      }}
    >
      <MarqueeRow items={top} seconds={64} />
      <MarqueeRow items={bottom} seconds={78} reverse />
    </div>
  );
}
