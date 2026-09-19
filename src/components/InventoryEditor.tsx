"use client";

import { useMemo, useState, useTransition } from "react";
import { ClassChip, ItemTile, RarityChip, TypeChip } from "./ItemTile";
import { searchTerms, type CatalogItem, type Rarity, type VariantAxis } from "@/lib/items";
import type { InventoryRow } from "@/lib/inventory";
import {
  addInventoryItem,
  removeInventoryItem,
  setInventoryQuantity,
} from "@/lib/actions/inventory";
import { ConsoleShortcut } from "@/components/ConsoleShortcut";

/**
 * The two lists matching runs on.
 *
 * "Have" and "want" are deliberately the same shape and sit side by side,
 * because the whole matching idea is that one player's have is another's want.
 * Making them look like two halves of one thing is the point.
 *
 * ---------------------------------------------------------------------------
 * Why the variant picker is in here
 * ---------------------------------------------------------------------------
 * A Fisch mutation moves an item's value by up to fifteen times. A list that
 * records "Rod" when the player holds an Aether one is not a smaller truth than
 * the real thing, it is a different item — and every suggestion built on it
 * would be priced against the wrong number. So where a game has variants, the
 * list carries them, and the picker asks before the row is created rather than
 * offering to correct it afterwards.
 *
 * Quantity is here for the same reason in the other direction. Somebody asking
 * for three of something is not matched by a player who holds one, and a list
 * that cannot count would tell that player they can close a trade they cannot.
 */
export function InventoryEditor({
  gameSlug,
  gameName,
  catalog,
  variantAxes,
  initial,
}: {
  gameSlug: string;
  gameName: string;
  catalog: readonly CatalogItem[];
  variantAxes: readonly VariantAxis[];
  initial: InventoryRow[];
}) {
  const [rows, setRows] = useState(initial);
  const [adding, setAdding] = useState<"have" | "want" | null>(null);
  const [chosen, setChosen] = useState<CatalogItem | null>(null);
  const [query, setQuery] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const have = rows.filter((r) => r.kind === "have");
  const want = rows.filter((r) => r.kind === "want");

  const options = useMemo(() => {
    const q = query.trim().toLowerCase();
    // Only a plain repeat is excluded. The same item in another variant is a
    // different holding and has to stay addable.
    const already = new Set(
      rows.filter((r) => r.kind === adding && !r.variant).map((r) => r.itemId),
    );
    return catalog
      .filter((i) => !already.has(i.id))
      .filter((i) => !q || searchTerms(i).some((t) => t.toLowerCase().includes(q)))
      .slice(0, 40);
  }, [catalog, query, rows, adding]);

  function close() {
    setAdding(null);
    setChosen(null);
    setQuery("");
  }

  function add(item: CatalogItem, kind: "have" | "want", variant?: string, quantity = 1) {
    setError(null);
    // Optimistic, then reconciled — the row is replaced by the server's view on
    // the next load. Safe because a failure removes it again.
    const temp: InventoryRow = {
      id: `temp-${item.id}-${variant ?? ""}`,
      kind,
      itemId: item.id,
      name: item.name,
      category: item.category,
      rarity: item.rarity,
      type: item.type,
      variant,
      quantity,
    };
    setRows((r) => [...r, temp]);
    close();

    startTransition(async () => {
      const result = await addInventoryItem(gameSlug, item.id, kind, { variant, quantity });
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

  function setQuantity(row: InventoryRow, quantity: number) {
    if (quantity < 1 || quantity === row.quantity) return;
    setError(null);
    const snapshot = rows;
    setRows((r) => r.map((x) => (x.id === row.id ? { ...x, quantity } : x)));

    startTransition(async () => {
      const result = await setInventoryQuantity(gameSlug, row.id, quantity);
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
          onQuantity={setQuantity}
          busy={pending}
        />
        <List
          title="What you want"
          hint="Things you are looking for."
          tone="want"
          rows={want}
          onAdd={() => { setAdding("want"); setQuery(""); }}
          onRemove={remove}
          onQuantity={setQuantity}
          busy={pending}
        />
      </div>

      {adding && (
        <div className="fixed inset-0 z-[60] grid place-items-end sm:place-items-center">
          <div aria-hidden="true" className="absolute inset-0 bg-ink/40" onClick={close} />
          <div
            role="dialog"
            aria-modal="true"
            aria-label={`Add to your ${adding} list`}
            className="glass-overlay relative flex max-h-[80dvh] w-full flex-col rounded-t-[var(--radius-panel)] p-5 sm:max-w-lg sm:rounded-[var(--radius-panel)]"
          >
            <div className="mb-3 flex items-center justify-between gap-3">
              <h2 className="text-[1.0625rem] font-bold tracking-[-0.025em] text-ink">
                {chosen
                  ? chosen.name
                  : `Add to ${adding === "have" ? "what you have" : "what you want"}`}
              </h2>
              <button
                type="button"
                onClick={() => (chosen ? setChosen(null) : close())}
                className="pill pill-ghost py-1.5 text-[0.75rem]"
              >
                {chosen ? "Back" : "Close"}
              </button>
            </div>

            {chosen ? (
              <Details
                item={chosen}
                axes={variantAxes}
                onAdd={(variant, quantity) => add(chosen, adding, variant, quantity)}
              />
            ) : (
              <>
                <input
                  autoFocus
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  placeholder={`Search ${gameName} items`}
                  className="w-full rounded-full border border-line bg-page px-4 py-2.5 text-[0.9375rem] text-ink placeholder:text-ink-faint focus:border-mint focus:outline-none"
                />

                <ConsoleShortcut query={query} />

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
                        // With no variants to choose and nothing to count past
                        // one, a second screen would be a tap that asks nothing.
                        onClick={() =>
                          variantAxes.length === 0 ? add(item, adding) : setChosen(item)
                        }
                        className="flex w-full items-center gap-3 rounded-[var(--radius-inner)] border border-line-soft bg-surface p-2.5 text-left transition-colors hover:border-mint"
                      >
                        <ItemTile item={item} size={38} />
                        <span className="min-w-0 flex-1">
                          <span className="block truncate text-[0.9375rem] font-bold tracking-[-0.015em] text-ink">
                            {item.name}
                          </span>
                          <span className="mt-0.5 flex flex-wrap items-center gap-1.5">
                            {item.rarity && <RarityChip rarity={item.rarity as Rarity} />}
                            {/* The native tier, at the moment of picking.
                                Choosing between two similarly-named fish is
                                exactly when a player needs to see that one is
                                Divine Secret and the other Exotic — both of
                                which the shared ladder flattens to "Mythical". */}
                            {item.type && item.type !== item.rarity && (
                              <TypeChip type={item.type} />
                            )}
                            <span className="font-mono text-[0.5625rem] tracking-[0.07em] text-ink-faint">
                              {item.category.toUpperCase()}
                            </span>
                            {item.classes?.map((c) => <ClassChip key={c} label={c} />)}
                          </span>
                        </span>
                        <span className="shrink-0 text-[0.8125rem] font-bold text-mint">
                          {variantAxes.length === 0 ? "Add" : "Next"}
                        </span>
                      </button>
                    </li>
                  ))}
                </ul>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

/**
 * The second step: which one, and how many.
 *
 * Only reached for a game that has variants. Every axis is offered, not just
 * the first — for Fisch the first axis is attributes and the second is the
 * mutation, and the mutation is the one carrying the value. Showing one axis
 * would quietly drop the field that matters most.
 *
 * "Any" is the default on every axis and is a real answer rather than a skipped
 * one: it records that the player did not say, which is what lets a listing
 * asking for any variant match them.
 */
function Details({
  item,
  axes,
  onAdd,
}: {
  item: CatalogItem;
  axes: readonly VariantAxis[];
  onAdd: (variant: string | undefined, quantity: number) => void;
}) {
  const [variant, setVariant] = useState<string | undefined>(undefined);
  const [quantity, setQuantity] = useState(1);

  return (
    <div className="flex-1 overflow-y-auto">
      <div className="flex items-center gap-3 rounded-[var(--radius-inner)] border border-line-soft bg-surface p-3">
        <ItemTile item={item} size={46} />
        <div className="min-w-0">
          <p className="truncate text-[0.9375rem] font-bold tracking-[-0.015em] text-ink">
            {item.name}
          </p>
          <p className="mt-0.5 flex flex-wrap items-center gap-1.5">
            {item.rarity && <RarityChip rarity={item.rarity as Rarity} />}
            {item.type && item.type !== item.rarity && <TypeChip type={item.type} />}
          </p>
        </div>
      </div>

      {axes.map((axis) => (
        <div key={axis.key} className="mt-5">
          <p className="label">{axis.label}</p>
          <div className="mt-2 flex flex-wrap gap-1.5">
            <Chip label="Any" on={variant === undefined} onClick={() => setVariant(undefined)} />
            {axis.options
              .filter((o) => o !== "Normal" && o !== "None")
              .map((o) => (
                <Chip key={o} label={o} on={variant === o} onClick={() => setVariant(o)} />
              ))}
          </div>
        </div>
      ))}

      <div className="mt-5">
        <p className="label">How many</p>
        <div className="mt-2 flex items-center gap-2">
          <Step label="Fewer" onClick={() => setQuantity((n) => Math.max(1, n - 1))} d="M5 10h10" />
          <span className="numeral min-w-[3ch] text-center text-[1.375rem] text-ink">
            {quantity}
          </span>
          <Step label="More" onClick={() => setQuantity((n) => Math.min(9999, n + 1))} d="M10 5v10M5 10h10" />
        </div>
      </div>

      <button
        type="button"
        onClick={() => onAdd(variant, quantity)}
        className="pill pill-mint mt-7 w-full justify-center py-2.5"
      >
        Add to list
      </button>
    </div>
  );
}

function Chip({ label, on, onClick }: { label: string; on: boolean; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={on}
      className={`rounded-full border px-3 py-1.5 text-[0.8125rem] font-semibold transition-colors ${
        on ? "border-mint bg-mint/10 text-mint" : "border-line bg-surface text-ink-soft hover:border-mint"
      }`}
    >
      {label}
    </button>
  );
}

function Step({ label, onClick, d }: { label: string; onClick: () => void; d: string }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={label}
      className="grid h-9 w-9 place-items-center rounded-full border border-line text-ink-soft transition-colors hover:border-mint hover:text-mint"
    >
      <svg width="15" height="15" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round">
        <path d={d} />
      </svg>
    </button>
  );
}

function List({
  title, hint, tone, rows, onAdd, onRemove, onQuantity, busy,
}: {
  title: string;
  hint: string;
  tone: "have" | "want";
  rows: InventoryRow[];
  onAdd: () => void;
  onRemove: (row: InventoryRow) => void;
  onQuantity: (row: InventoryRow, quantity: number) => void;
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
            <li key={row.id} className="flex items-center gap-2.5 rounded-[var(--radius-inner)] border border-line-soft bg-surface p-2.5">
              <span className="min-w-0 flex-1">
                <span className="block truncate text-[0.9375rem] font-bold tracking-[-0.015em] text-ink">
                  {row.name}
                </span>
                <span className="mt-0.5 flex flex-wrap items-center gap-1.5">
                  {row.rarity && <RarityChip rarity={row.rarity as Rarity} />}
                  {row.variant && (
                    <span className="rounded-md bg-mint/10 px-1.5 py-0.5 font-mono text-[0.5625rem] font-medium tracking-[0.08em] text-mint">
                      {row.variant.toUpperCase()}
                    </span>
                  )}
                  <span className="font-mono text-[0.5625rem] tracking-[0.07em] text-ink-faint">
                    {row.category.toUpperCase()}
                  </span>
                </span>
              </span>

              {/* A stepper rather than a text field. The only edits anyone makes
                  to a holding are up one and down one, and a field would ask for
                  a keyboard on a phone to do it. */}
              <span className="flex shrink-0 items-center gap-1">
                <button
                  type="button"
                  onClick={() => onQuantity(row, row.quantity - 1)}
                  disabled={busy || row.quantity <= 1}
                  aria-label={`One fewer ${row.name}`}
                  className="grid h-7 w-7 place-items-center rounded-full border border-line text-ink-mute transition-colors enabled:hover:border-mint enabled:hover:text-mint disabled:opacity-30"
                >
                  <svg width="12" height="12" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M5 10h10" /></svg>
                </button>
                <span className="numeral min-w-[2ch] text-center text-[0.875rem] text-ink">
                  {row.quantity}
                </span>
                <button
                  type="button"
                  onClick={() => onQuantity(row, row.quantity + 1)}
                  disabled={busy}
                  aria-label={`One more ${row.name}`}
                  className="grid h-7 w-7 place-items-center rounded-full border border-line text-ink-mute transition-colors enabled:hover:border-mint enabled:hover:text-mint disabled:opacity-30"
                >
                  <svg width="12" height="12" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M10 5v10M5 10h10" /></svg>
                </button>
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
