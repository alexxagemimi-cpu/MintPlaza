"use client";

import { useState } from "react";

/**
 * A money box that speaks the way trading communities do.
 *
 * Trade values run to ten digits. Asking someone to type 622500000 and count
 * the zeros is how wrong numbers get saved — and a wrong value silently changes
 * every win/loss verdict on the site. So this accepts what people actually say:
 *
 *     622.5m   1.9B   10 M   1,900,000   45k   3400000
 *
 * and shows underneath exactly what it understood, in full, before you save.
 * If it cannot read what you typed it says so rather than guessing.
 *
 * Empty stays empty. Blank means "we do not know this number", which keeps the
 * trade calculator honest; a zero would tell it the item is worth nothing.
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
