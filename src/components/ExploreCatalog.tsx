"use client";

import { useMemo, useState } from "react";
import { ItemTile, RarityChip } from "./ItemTile";
import { CATALOG_CHECKED, CATALOG_NOTES, type CatalogItem, type Rarity } from "@/lib/items";

const RARITIES: readonly Rarity[] = ["Common", "Uncommon", "Rare", "Legendary", "Mythical"];

/**
 * The item browser inside Trade & Offers.
 *
 * Picking from a catalogue rather than typing free text is the whole point: it
 * is what lets "Permanent Kitsune" mean the same thing to both sides, and what
 * turns matching into an indexed lookup instead of a string search.
 */
export function ExploreCatalog({
  items,
  gameSlug,
}: {
  items: readonly CatalogItem[];
  gameSlug: string;
}) {
  const [query, setQuery] = useState("");
  const [rarity, setRarity] = useState<Rarity | null>(null);
  const [category, setCategory] = useState<string | null>(null);

  const categories = useMemo(
    () => [...new Set(items.map((i) => i.category))],
    [items],
  );

  const shown = useMemo(() => {
    const q = query.trim().toLowerCase();
    return items.filter(
      (i) =>
        (!q || i.name.toLowerCase().includes(q)) &&
        (!rarity || i.rarity === rarity) &&
        (!category || i.category === category),
    );
  }, [items, query, rarity, category]);

  return (
    <div>
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
        <label className="relative flex-1">
          <span className="sr-only">Search items</span>
          <svg
            width="16" height="16" viewBox="0 0 20 20" fill="none" stroke="currentColor"
            strokeWidth="1.8" strokeLinecap="round"
            className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-ink-faint"
            aria-hidden="true"
          >
            <circle cx="9" cy="9" r="6.4" />
            <path d="M17.4 17.4 13.6 13.6" />
          </svg>
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search items"
            className="w-full rounded-full border border-line bg-surface py-2.5 pl-10 pr-4 text-[0.875rem] text-ink placeholder:text-ink-faint focus:border-mint focus:outline-none"
          />
        </label>

        {categories.length > 1 && (
          <div className="flex flex-wrap gap-1.5">
            {categories.map((c) => (
              <FilterChip
                key={c}
                active={category === c}
                onClick={() => setCategory(category === c ? null : c)}
              >
                {c}
              </FilterChip>
            ))}
          </div>
        )}
      </div>

      <div className="mt-3 flex flex-wrap gap-1.5">
        {RARITIES.map((r) => (
          <FilterChip key={r} active={rarity === r} onClick={() => setRarity(rarity === r ? null : r)}>
            {r}
          </FilterChip>
        ))}
      </div>

      <p className="mt-4 font-mono text-[0.6875rem] tracking-[0.06em] text-ink-faint">
        {shown.length} OF {items.length} ITEMS · CATALOGUE CHECKED {CATALOG_CHECKED.toUpperCase()}
      </p>

      {CATALOG_NOTES[gameSlug] && (
        <p className="mt-2 flex items-start gap-2 text-[0.75rem] leading-relaxed text-ink-mute">
          <svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.6" className="mt-0.5 shrink-0 text-warn" strokeLinecap="round" aria-hidden="true">
            <circle cx="8" cy="8" r="6.4" />
            <path d="M8 5v3.4M8 11h.01" />
          </svg>
          {CATALOG_NOTES[gameSlug]}
        </p>
      )}

      {shown.length > 0 ? (
        <ul className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-4">
          {shown.map((item) => (
            <li key={item.id}>
              <button
                type="button"
                className="glass-quiet flex w-full items-center gap-3 rounded-[var(--radius-inner)] p-3 text-left transition-colors hover:border-line"
              >
                <ItemTile item={item} size={44} />
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-[0.875rem] font-bold tracking-[-0.015em] text-ink">
                    {item.name}
                  </span>
                  <span className="mt-1 flex flex-wrap items-center gap-1.5">
                    {item.rarity && <RarityChip rarity={item.rarity} />}
                    {item.verified === false && (
                      <span
                        title="Not confirmed against the game wiki"
                        className="rounded-md border border-warn/30 bg-warn-wash px-1.5 py-0.5 font-mono text-[0.5rem] font-medium tracking-[0.08em] text-warn"
                      >
                        UNCONFIRMED
                      </span>
                    )}
                    {item.type && (
                      <span className="font-mono text-[0.5625rem] tracking-[0.08em] text-ink-faint">
                        {item.type.toUpperCase()}
                      </span>
                    )}
                  </span>
                </span>
              </button>
            </li>
          ))}
        </ul>
      ) : (
        <p className="glass-quiet mt-3 rounded-[var(--radius-inner)] px-5 py-10 text-center text-[0.9375rem] text-ink-mute">
          Nothing matches that. Try a different spelling, or clear the filters.
        </p>
      )}
    </div>
  );
}

function FilterChip({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={`rounded-full border px-3 py-1.5 font-mono text-[0.625rem] tracking-[0.07em] transition-colors ${
        active
          ? "border-mint bg-mint-wash text-mint"
          : "border-line bg-surface text-ink-mute hover:text-ink"
      }`}
    >
      {children.toUpperCase()}
    </button>
  );
}
