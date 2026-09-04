"use client";

import { useMemo, useState, useTransition } from "react";
import { ItemTile, RarityChip } from "./ItemTile";
import { searchTerms, type CatalogItem, type Rarity } from "@/lib/items";
import type { InventoryRow } from "@/lib/actions/inventory";
import { addInventoryItem, removeInventoryItem } from "@/lib/actions/inventory";

/**
 * The two lists matching runs on.
 *
 * "Have" and "want" are deliberately the same shape and sit side by side,
 * because the whole matching idea is that one player's have is another's want.
 * Making them look like two halves of one thing is the point.
 */
export function InventoryEditor({
  gameSlug,
  gameName,
  catalog,
  initial,
}: {
  gameSlug: string;
  gameName: string;
  catalog: readonly CatalogItem[];
  initial: InventoryRow[];
}) {
  const [rows, setRows] = useState(initial);
  const [adding, setAdding] = useState<"have" | "want" | null>(null);
  const [query, setQuery] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const have = rows.filter((r) => r.kind === "have");
  const want = rows.filter((r) => r.kind === "want");

  const options = useMemo(() => {
    const q = query.trim().toLowerCase();
    const already = new Set(
      rows.filter((r) => r.kind === adding).map((r) => r.itemId),
    );
    return catalog
      .filter((i) => !already.has(i.id))
      .filter((i) =>
        !q || searchTerms(i).some((t) => t.toLowerCase().includes(q)),
      )
      .slice(0, 40);
  }, [catalog, query, rows, adding]);

  function add(item: CatalogItem, kind: "have" | "want") {
    setError(null);
    // Optimistic, then reconciled — the row is replaced by the server's view
    // on the next load. Safe because a failure removes it again.
    const temp: InventoryRow = {
      id: `temp-${item.id}`,
      kind,
      itemId: item.id,
      name: item.name,
      category: item.category,
      rarity: item.rarity,
    };
    setRows((r) => [...r, temp]);
    setQuery("");
    setAdding(null);

    startTransition(async () => {
      const result = await addInventoryItem(gameSlug, item.id, kind);
      if (!result.ok) {
        setRows((r) => r.filter((x) => x.id !== temp.id));
        setError(result.error);
      }
    });
  }

  function remove(row: InventoryRow) {
    setError(null);
    const snapshot = rows;
    setRows((r) => r.filter((x) => x.id !== row.id));

    startTransition(async () => {
      const result = await removeInventoryItem(gameSlug, row.id);
      if (!result.ok) {
        setRows(snapshot);
        setError(result.error);
      }
    });
  }

  return (
    <div>
      {error && (
        <p role="alert" className="mb-4 rounded-[var(--radius-inner)] border border-bad/30 bg-bad/[0.06] px-4 py-3 text-[0.875rem] text-bad">
          {error}
        </p>
      )}

      <div className="grid gap-4 lg:grid-cols-2">
        <List
          title="What you have"
          hint="Things you would trade away."
          tone="have"
          rows={have}
          onAdd={() => { setAdding("have"); setQuery(""); }}
          onRemove={remove}
          busy={pending}
        />
        <List
          title="What you want"
          hint="Things you are looking for."
          tone="want"
          rows={want}
          onAdd={() => { setAdding("want"); setQuery(""); }}
          onRemove={remove}
          busy={pending}
        />
      </div>

      {adding && (
        <div className="fixed inset-0 z-[60] grid place-items-end sm:place-items-center">
          <div
            aria-hidden="true"
            className="absolute inset-0 bg-ink/40"
            onClick={() => setAdding(null)}
          />
          <div
            role="dialog"
            aria-modal="true"
            aria-label={`Add to your ${adding} list`}
            className="glass-overlay relative flex max-h-[80dvh] w-full flex-col rounded-t-[var(--radius-panel)] p-5 sm:max-w-lg sm:rounded-[var(--radius-panel)]"
          >
            <div className="mb-3 flex items-center justify-between gap-3">
              <h2 className="text-[1.0625rem] font-bold tracking-[-0.025em] text-ink">
                Add to {adding === "have" ? "what you have" : "what you want"}
              </h2>
              <button type="button" onClick={() => setAdding(null)} className="pill pill-ghost py-1.5 text-[0.75rem]">
                Close
              </button>
            </div>

            <input
              autoFocus
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder={`Search ${gameName} items`}
              className="w-full rounded-full border border-line bg-page px-4 py-2.5 text-[0.9375rem] text-ink placeholder:text-ink-faint focus:border-mint focus:outline-none"
            />

            <ul className="mt-3 flex-1 space-y-1.5 overflow-y-auto">
              {options.length === 0 && (
                <li className="px-2 py-8 text-center text-[0.875rem] text-ink-mute">
                  Nothing left to add that matches.
                </li>
              )}
              {options.map((item) => (
                <li key={item.id}>
                  <button
                    type="button"
                    onClick={() => add(item, adding)}
                    className="flex w-full items-center gap-3 rounded-[var(--radius-inner)] border border-line-soft bg-surface p-2.5 text-left transition-colors hover:border-mint"
                  >
                    <ItemTile item={item} size={38} />
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-[0.9375rem] font-bold tracking-[-0.015em] text-ink">
                        {item.name}
                      </span>
                      <span className="mt-0.5 flex flex-wrap items-center gap-1.5">
                        {item.rarity && <RarityChip rarity={item.rarity as Rarity} />}
                        <span className="font-mono text-[0.5625rem] tracking-[0.07em] text-ink-faint">
                          {item.category.toUpperCase()}
                        </span>
                      </span>
                    </span>
                    <span className="shrink-0 text-[0.8125rem] font-bold text-mint">Add</span>
                  </button>
                </li>
              ))}
            </ul>
          </div>
        </div>
      )}
    </div>
  );
}

function List({
  title, hint, tone, rows, onAdd, onRemove, busy,
}: {
  title: string;
  hint: string;
  tone: "have" | "want";
  rows: InventoryRow[];
  onAdd: () => void;
  onRemove: (row: InventoryRow) => void;
  busy: boolean;
}) {
  return (
    <section className="glass flex flex-col rounded-[var(--radius-panel)] p-5">
      <div className="mb-1 flex items-baseline justify-between gap-3">
        <h2 className="text-[1.0625rem] font-bold tracking-[-0.025em] text-ink">{title}</h2>
        <span className={`font-mono text-[0.625rem] tracking-[0.08em] ${tone === "have" ? "text-mint" : "text-ink-mute"}`}>
          {rows.length}
        </span>
      </div>
      <p className="mb-4 text-[0.8125rem] text-ink-mute">{hint}</p>

      {rows.length > 0 ? (
        <ul className="mb-4 space-y-1.5">
          {rows.map((row) => (
            <li key={row.id} className="flex items-center gap-3 rounded-[var(--radius-inner)] border border-line-soft bg-surface p-2.5">
              <span className="min-w-0 flex-1">
                <span className="block truncate text-[0.9375rem] font-bold tracking-[-0.015em] text-ink">
                  {row.name}
                </span>
                <span className="mt-0.5 flex flex-wrap items-center gap-1.5">
                  {row.rarity && <RarityChip rarity={row.rarity as Rarity} />}
                  <span className="font-mono text-[0.5625rem] tracking-[0.07em] text-ink-faint">
                    {row.category.toUpperCase()}
                  </span>
                </span>
              </span>
              <button
                type="button"
                onClick={() => onRemove(row)}
                disabled={busy}
                aria-label={`Remove ${row.name}`}
                className="grid h-8 w-8 shrink-0 place-items-center rounded-full border border-line text-ink-mute transition-colors hover:border-bad hover:text-bad"
              >
                <svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round">
                  <path d="M4 4l8 8M12 4l-8 8" />
                </svg>
              </button>
            </li>
          ))}
        </ul>
      ) : (
        <p className="mb-4 rounded-[var(--radius-inner)] border border-dashed border-line px-4 py-8 text-center text-[0.875rem] text-ink-mute">
          Nothing here yet.
        </p>
      )}

      <button type="button" onClick={onAdd} className="pill pill-ghost mt-auto w-full justify-center py-2.5">
        + Add {tone === "have" ? "something you have" : "something you want"}
      </button>
    </section>
  );
}
