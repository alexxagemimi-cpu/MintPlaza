"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import type { InventoryRow } from "@/lib/inventory";
import { postTradeListing, type DraftSide } from "@/lib/actions/trades";
import {
  BUMP_COOLDOWN_HOURS, FREE_LISTING_HOURS, LEVEL_UP_LISTING_DAYS,
} from "@/lib/level-up";

/**
 * Posting a trade listing, built out of the lists you already keep.
 *
 * A blank compose screen would ask a player to search the catalogue twice for
 * items they have already told the site about — and the two answers would then
 * disagree, which is worse than either, because matching would be running on a
 * list that says one thing while the board says another.
 *
 * So a listing is assembled by ticking: offer some of what you have, ask for
 * some of what you want. It stays in step with the lists by construction, the
 * variants and quantities come along with the rows, and there is nothing to
 * type unless you want to add a note.
 *
 * Somebody who wants to offer something not on their have list adds it to the
 * list first. That is one extra step, and it is the right one: they were always
 * going to have to declare it for matching to work at all.
 */
export function PostTradeListing({
  gameSlug,
  inventory,
  remaining,
  nextSlotAt,
}: {
  gameSlug: string;
  inventory: readonly InventoryRow[];
  /** Listing slots left in the rolling window. Zero disables the whole form. */
  remaining: number;
  nextSlotAt: string | null;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [offer, setOffer] = useState<Set<string>>(new Set());
  const [want, setWant] = useState<Set<string>>(new Set());
  const [note, setNote] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const have = inventory.filter((r) => r.kind === "have" && r.itemId);
  const wants = inventory.filter((r) => r.kind === "want" && r.itemId);

  function toggle(set: Set<string>, put: (s: Set<string>) => void, id: string) {
    const next = new Set(set);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    put(next);
  }

  function sides(rows: readonly InventoryRow[], picked: Set<string>): DraftSide[] {
    return rows
      .filter((r) => picked.has(r.id))
      .map((r) => ({ itemId: r.itemId!, variant: r.variant, quantity: r.quantity }));
  }

  function submit() {
    setError(null);
    const offering = sides(have, offer);
    if (offering.length === 0) {
      setError("Tick at least one thing you are offering.");
      return;
    }

    startTransition(async () => {
      const result = await postTradeListing(gameSlug, offering, sides(wants, want), note);
      if (!result.ok) {
        setError(result.error);
        return;
      }
      setOpen(false);
      setOffer(new Set());
      setWant(new Set());
      setNote("");
      router.refresh();
    });
  }

  if (have.length === 0) {
    return (
      <p className="glass-quiet rounded-[var(--radius-panel)] px-5 py-6 text-[0.875rem] leading-relaxed text-ink-mute">
        Add something to your have list and you can post it as a listing from
        here.
      </p>
    );
  }

  if (!open) {
    return (
      <div className="glass-quiet rounded-[var(--radius-panel)] p-5">
        <div className="flex items-baseline justify-between gap-3">
          <p className="label">Post a listing</p>
          <span className="font-mono text-[0.625rem] tracking-[0.08em] text-ink-faint">
            {remaining} LEFT
          </span>
        </div>
        <p className="mt-2 text-[0.8125rem] leading-relaxed text-ink-mute">
          {remaining > 0
            ? "Put some of what you have on the board, and say what you would take for it."
            : `All your slots are in use.${
                nextSlotAt ? ` The next one frees up ${when(nextSlotAt)}.` : ""
              }`}
        </p>
        <button
          type="button"
          disabled={remaining <= 0}
          onClick={() => setOpen(true)}
          className="pill pill-mint mt-5 w-full justify-center py-2.5 disabled:opacity-40"
        >
          Build a listing
        </button>
      </div>
    );
  }

  return (
    <div className="glass rounded-[var(--radius-panel)] p-5">
      <div className="mb-4 flex items-center justify-between gap-3">
        <h3 className="text-[1.0625rem] font-bold tracking-[-0.025em] text-ink">
          New listing
        </h3>
        <button type="button" onClick={() => setOpen(false)} className="pill pill-ghost py-1.5 text-[0.75rem]">
          Cancel
        </button>
      </div>

      {error && (
        <p role="alert" className="mb-4 rounded-[var(--radius-inner)] border border-bad/30 bg-bad/[0.06] px-4 py-3 text-[0.875rem] text-bad">
          {error}
        </p>
      )}

      <Picker
        label="You are offering"
        hint="From what you have."
        rows={have}
        picked={offer}
        onToggle={(id) => toggle(offer, setOffer, id)}
      />

      <div className="mt-5">
        <Picker
          label="You are asking for"
          hint="From what you want. Tick nothing to stay open to offers."
          rows={wants}
          picked={want}
          onToggle={(id) => toggle(want, setWant, id)}
          empty="Nothing on your want list yet — this will post as open to offers."
        />
      </div>

      <div className="mt-5">
        <label className="label" htmlFor="listing-note">
          Anything to add
        </label>
        <textarea
          id="listing-note"
          value={note}
          onChange={(e) => setNote(e.target.value.slice(0, 500))}
          rows={2}
          placeholder="Optional. Trading in-game only, timezone, that sort of thing."
          className="mt-2 w-full resize-none rounded-[var(--radius-inner)] border border-line bg-page px-3 py-2.5 text-[0.875rem] text-ink placeholder:text-ink-faint focus:border-mint focus:outline-none"
        />
      </div>

      <button
        type="button"
        onClick={submit}
        disabled={pending}
        className="pill pill-mint mt-5 w-full justify-center py-2.5 disabled:opacity-50"
      >
        {pending ? "Posting…" : "Post listing"}
      </button>
      <p className="mt-3 text-[0.75rem] leading-relaxed text-ink-faint">
        Listings expire on their own after {FREE_LISTING_HOURS} hours, or{" "}
        {LEVEL_UP_LISTING_DAYS} days with Level Up. You can lift one back to the
        top every {BUMP_COOLDOWN_HOURS} hours without using a slot — that part
        is the same whether you pay or not.
      </p>
    </div>
  );
}

function Picker({
  label, hint, rows, picked, onToggle, empty,
}: {
  label: string;
  hint: string;
  rows: readonly InventoryRow[];
  picked: Set<string>;
  onToggle: (id: string) => void;
  empty?: string;
}) {
  return (
    <div>
      <p className="label">{label}</p>
      <p className="mt-1 text-[0.75rem] text-ink-mute">{hint}</p>

      {rows.length === 0 ? (
        <p className="mt-2 rounded-[var(--radius-inner)] border border-dashed border-line px-3 py-4 text-center text-[0.8125rem] text-ink-mute">
          {empty ?? "Nothing here yet."}
        </p>
      ) : (
        <ul className="mt-2 flex flex-wrap gap-1.5">
          {rows.map((row) => {
            const on = picked.has(row.id);
            return (
              <li key={row.id}>
                <button
                  type="button"
                  onClick={() => onToggle(row.id)}
                  aria-pressed={on}
                  className={`flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-[0.8125rem] font-semibold transition-colors ${
                    on
                      ? "border-mint bg-mint/10 text-mint"
                      : "border-line bg-surface text-ink-soft hover:border-mint"
                  }`}
                >
                  {row.name}
                  {row.variant && (
                    <span className="font-mono text-[0.5625rem] tracking-[0.07em] opacity-70">
                      {row.variant.toUpperCase()}
                    </span>
                  )}
                  {row.quantity > 1 && (
                    <span className="font-mono text-[0.625rem] tabular-nums opacity-70">
                      ×{row.quantity}
                    </span>
                  )}
                </button>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}

function when(iso: string): string {
  const mins = Math.round((new Date(iso).getTime() - Date.now()) / 60_000);
  if (mins <= 1) return "any moment";
  if (mins < 60) return `in ${mins} minutes`;
  const h = Math.round(mins / 60);
  return `in about ${h} ${h === 1 ? "hour" : "hours"}`;
}
