"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { grantLevelUp, revokeLevelUp, type LevelUpRow } from "@/lib/admin/actions";
import { COUNTRIES, LEVEL_UP_DAYS, priceFor } from "@/lib/level-up";

/**
 * Level Up, from the owner's side.
 *
 * ---------------------------------------------------------------------------
 * Why granting by hand is a real feature and not a placeholder
 * ---------------------------------------------------------------------------
 *
 * There is no payment processor connected to this site, so this panel IS the
 * payment system: money arrives somewhere, a person confirms it arrived, and
 * the entitlement is written. That is three steps, and a webhook would be the
 * same three with the person replaced by a signature check — which is why the
 * grant function already takes a payment reference and already refuses to
 * apply the same one twice.
 *
 * So this is not scaffolding to be thrown away. It is the manual path that
 * stays useful afterwards, for the gift, the apology, the refund, and the
 * payment that arrived by a route the processor never saw.
 *
 * The one thing it cannot do is take money. Nothing in this codebase can, and
 * nothing should: handling a card means being inside PCI scope, which is not
 * somewhere a site run by one person belongs.
 */
export function LevelUpPanel({ rows }: { rows: readonly LevelUpRow[] }) {
  // The list is rendered straight from the server prop and never mirrored into
  // state. Mirroring it would mean maintaining a second copy that is right
  // until the first time a write does something slightly different from what
  // the optimistic update guessed — and this is the owner's record of money
  // received, which is the last screen on the site that should be showing a
  // guess. router.refresh() re-runs the page and the prop arrives correct.
  const router = useRouter();
  const [username, setUsername] = useState("");
  const [country, setCountry] = useState("IN");
  const [days, setDays] = useState(String(LEVEL_UP_DAYS));
  const [paymentRef, setPaymentRef] = useState("");
  const [source, setSource] = useState<"purchase" | "gift" | "comp">("purchase");
  const [error, setError] = useState<string | null>(null);
  const [note, setNote] = useState<string | null>(null);
  const [busy, start] = useTransition();

  const active = rows.filter((r) => r.active).length;

  function submit() {
    setError(null);
    setNote(null);
    start(async () => {
      const result = await grantLevelUp({
        username,
        days: Number(days) || LEVEL_UP_DAYS,
        country,
        source,
        paymentRef: paymentRef || undefined,
      });
      if (!result.ok) {
        setError(result.error);
        return;
      }
      setNote(
        result.alreadyApplied
          ? `That payment reference was already used, so nothing was added. ${username} is set until ${fmt(result.expiresAt)}.`
          : `${username} has Level Up until ${fmt(result.expiresAt)}.`,
      );
      setUsername("");
      setPaymentRef("");
      router.refresh();
    });
  }

  function end(name: string) {
    setError(null);
    setNote(null);
    start(async () => {
      const result = await revokeLevelUp(name);
      if (!result.ok) {
        setError(result.error);
        return;
      }
      setNote(`${name}'s Level Up has been ended and marked refunded.`);
      router.refresh();
    });
  }

  const field =
    "w-full rounded-[10px] border border-line bg-surface px-3 py-2.5 text-[0.9375rem] text-ink outline-none focus:border-mint";

  return (
    <section className="mt-10">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h2 className="text-[1.125rem] font-bold tracking-[-0.025em] text-ink">
          Level Up
        </h2>
        <p className="font-mono text-[0.625rem] tracking-[0.07em] text-ink-faint">
          {active} ACTIVE · {rows.length} EVER
        </p>
      </div>

      <p className="mt-1 text-[0.8125rem] leading-relaxed text-ink-mute">
        Nothing on this site can take a payment. When money reaches you some
        other way, this is where you write down that it did — and the player
        gets their {LEVEL_UP_DAYS} days the moment you do.
      </p>

      {/* ---- grant ---- */}
      <div className="glass mt-4 rounded-[var(--radius-inner)] p-4">
        <div className="grid gap-3 sm:grid-cols-2">
          <label className="block">
            <span className="label">Roblox username</span>
            <input
              className={`${field} mt-1.5`}
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              placeholder="alx22n"
            />
            <span className="mt-1 block text-[0.6875rem] text-ink-faint">
              They have to have signed in here at least once.
            </span>
          </label>

          <label className="block">
            <span className="label">Country they bought from</span>
            <select
              className={`${field} mt-1.5`}
              value={country}
              onChange={(e) => setCountry(e.target.value)}
            >
              {COUNTRIES.map((c) => (
                <option key={c.code} value={c.code}>
                  {c.name} — {priceFor(c.code).display}
                </option>
              ))}
            </select>
            <span className="mt-1 block text-[0.6875rem] text-ink-faint">
              Only kept for your records. It changes nothing about what they get.
            </span>
          </label>

          <label className="block">
            <span className="label">Days</span>
            <input
              className={`${field} mt-1.5`}
              value={days}
              inputMode="numeric"
              onChange={(e) => setDays(e.target.value)}
            />
            <span className="mt-1 block text-[0.6875rem] text-ink-faint">
              Added on top of whatever they have left, never replacing it.
            </span>
          </label>

          <label className="block">
            <span className="label">Why</span>
            <select
              className={`${field} mt-1.5`}
              value={source}
              onChange={(e) => setSource(e.target.value as typeof source)}
            >
              <option value="purchase">They paid for it</option>
              <option value="gift">A gift</option>
              <option value="comp">Making up for something</option>
            </select>
          </label>

          <label className="block sm:col-span-2">
            <span className="label">Payment reference</span>
            <input
              className={`${field} mt-1.5`}
              value={paymentRef}
              onChange={(e) => setPaymentRef(e.target.value)}
              placeholder="UPI reference, order id, anything you can look up again"
            />
            <span className="mt-1 block text-[0.6875rem] text-ink-faint">
              Optional, and worth filling in: the same reference can only ever be
              used once, so it is what stops one payment being credited twice.
            </span>
          </label>
        </div>

        <button
          type="button"
          onClick={submit}
          disabled={busy || !username.trim()}
          className="pill pill-mint mt-4 py-2 text-[0.875rem] disabled:opacity-50"
        >
          {busy ? "Saving…" : "Give them Level Up"}
        </button>

        {(error || note) && (
          <p
            role="alert"
            className={`mt-3 rounded-[10px] px-3 py-2 text-[0.8125rem] ${
              error ? "border border-bad/30 bg-bad-wash text-bad" : "bg-fill text-ink-mute"
            }`}
          >
            {error ?? note}
          </p>
        )}
      </div>

      {/* ---- the record ---- */}
      {rows.length > 0 && (
        <ul className="mt-4 grid gap-2">
          {rows.map((r) => (
            <li
              key={`${r.username}-${r.created_at}`}
              className="glass-quiet flex flex-wrap items-center gap-x-3 gap-y-1 rounded-[var(--radius-inner)] px-3.5 py-2.5"
            >
              <span className="text-[0.875rem] font-bold tracking-[-0.015em] text-ink">
                {r.username}
              </span>
              <span
                className={`rounded-[5px] px-1.5 py-0.5 font-mono text-[0.5625rem] font-medium tracking-[0.07em] ${
                  r.active ? "bg-mint-wash text-mint" : "bg-fill text-ink-mute"
                }`}
              >
                {r.active ? "ACTIVE" : r.source === "refunded" ? "REFUNDED" : "ENDED"}
              </span>
              <span className="font-mono text-[0.625rem] tracking-[0.06em] text-ink-faint">
                {r.active ? "until" : "ended"} {fmt(r.expires_at)}
                {r.country && ` · ${r.country}`}
                {r.source !== "purchase" && r.source !== "refunded" && ` · ${r.source.toUpperCase()}`}
                {r.payment_ref && ` · ${r.payment_ref}`}
              </span>
              {r.active && (
                <button
                  type="button"
                  onClick={() => end(r.username)}
                  disabled={busy}
                  className="ml-auto text-[0.75rem] font-semibold text-bad hover:underline disabled:opacity-50"
                >
                  End it
                </button>
              )}
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

function fmt(iso?: string): string {
  if (!iso) return "—";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleDateString(undefined, { day: "numeric", month: "short", year: "numeric" });
}
