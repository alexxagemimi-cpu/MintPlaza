"use client";

import { useState } from "react";

/**
 * A money box that speaks the way trading communities do.
 *
 * The prices these games charge run to ten digits — a fruit costs 8,000,000
 * Beli — and asking someone to type that and count the zeros is how wrong
 * numbers get saved. So this accepts what people actually say:
 *
 *     622.5m   1.9B   10 M   1,900,000   45k   3400000
 *
 * and shows underneath exactly what it understood, in full, before you save.
 * If it cannot read what you typed it says so rather than guessing.
 *
 * It used to take trade values too. It no longer does — MintPlaza keeps none,
 * see src/lib/referrals.ts — so the only money left is the game's OWN shop
 * price in Beli or Robux, which the developer publishes and which does not
 * move.
 *
 * Empty stays empty, and that distinction still matters: blank means "nobody
 * has confirmed this price", a zero would mean the game gives it away free.
 */

export function parseMoney(input: string): number | null | "bad" {
  const raw = input.trim().toLowerCase().replace(/,/g, "").replace(/\s+/g, "");
  if (raw === "") return null;

  const m = raw.match(/^(\d+(?:\.\d+)?)([kmb])?$/);
  if (!m) return "bad";

  const n = Number(m[1]);
  if (!Number.isFinite(n)) return "bad";

  const mult = m[2] === "b" ? 1e9 : m[2] === "m" ? 1e6 : m[2] === "k" ? 1e3 : 1;
  return Math.round(n * mult);
}

export function MoneyInput({
  value, onChange, placeholder,
}: {
  value: number | null;
  onChange: (v: number | null) => void;
  placeholder?: string;
}) {
  // Keep what was typed, so "1.9b" does not rewrite itself to 1900000000
  // mid-keystroke and fight the person typing.
  const [text, setText] = useState(value === null ? "" : String(value));
  const [touched, setTouched] = useState(false);
  const parsed = parseMoney(text);

  return (
    <div>
      <input
        inputMode="decimal"
        value={text}
        placeholder={placeholder ?? "e.g. 10M"}
        onChange={(e) => {
          setText(e.target.value);
          setTouched(true);
          const p = parseMoney(e.target.value);
          if (p !== "bad") onChange(p);
        }}
        className="w-full rounded-[10px] border border-line bg-surface px-3 py-2.5 text-[0.9375rem] text-ink outline-none focus:border-mint"
      />
      {touched && parsed === "bad" && (
        <span className="mt-1 block text-[0.75rem] font-semibold text-bad">
          Try a number like 10M, 1.9B or 622500000.
        </span>
      )}
      {parsed !== "bad" && parsed !== null && (
        <span className="mt-1 block text-[0.75rem] text-ink-faint">
          = {parsed.toLocaleString("en-US")}
        </span>
      )}
      {parsed === null && (
        <span className="mt-1 block text-[0.75rem] text-ink-faint">
          Empty means not known.
        </span>
      )}
    </div>
  );
}
