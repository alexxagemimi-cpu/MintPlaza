"use client";

import { useEffect, useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { servicesFor, type Service, type ListingSide } from "@/lib/sessions";
import { postListing } from "@/lib/actions/board";
import { RefTile } from "./RefTile";

/**
 * Posting a listing.
 *
 * Four decisions in order, and the form only ever shows the one you are on:
 * which way round it is, what it is about, which reference picture, and what
 * you need. A single screen with every field visible would be a wall, and this
 * is mostly filled in on a phone by somebody who wants to get back to the game.
 *
 * The reference picker is the part worth explaining. Some services mean
 * different things depending on a detail the game cares about — a V3 listing is
 * a different job for an Angel than for a Ghoul, and a Cursed Dual Katana
 * listing might be about Yama, Tushita or the trial. Picking a picture says
 * which before anybody reads a word, and the description underneath is still
 * where the real ask goes.
 */

const SIDES: { id: ListingSide; label: string; blurb: string }[] = [
  { id: "request", label: "I need help", blurb: "You are stuck on one thing." },
  { id: "offer", label: "I can help", blurb: "You have time, and can run several." },
];

export function PostListing({
  gameSlug, gameName, onClose,
}: {
  gameSlug: string;
  gameName: string;
  onClose: () => void;
}) {
  const all = useMemo(() => servicesFor(gameSlug), [gameSlug]);
  const [side, setSide] = useState<ListingSide>("request");
  const [picked, setPicked] = useState<string[]>([]);
  const [refId, setRefId] = useState<string>("");
  const [detail, setDetail] = useState("");
  const [terms, setTerms] = useState<"free" | "split">("free");
  const [query, setQuery] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, start] = useTransition();
  const router = useRouter();

  // A request is about one thing. An offer can advertise several.
  const many = side === "offer";
  const shown = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return all;
    return all.filter(
      (s) =>
        s.name.toLowerCase().includes(q) ||
        s.aliases?.some((a) => a.toLowerCase().includes(q)),
    );
  }, [all, query]);

  // Only offer a picker when exactly one service is chosen and it has one:
  // a reference that could belong to any of five services says nothing.
  const refsFor: Service | undefined =
    picked.length === 1 ? all.find((s) => s.id === picked[0]) : undefined;
  const refs = refsFor?.refs;

  function toggle(id: string) {
    setError(null);
    setPicked((prev) => {
      if (prev.includes(id)) return prev.filter((p) => p !== id);
      return many ? [...prev, id] : [id];
    });
    setRefId("");
  }

  function submit() {
    setError(null);
    start(async () => {
      const result = await postListing({
        gameSlug, side, serviceIds: picked,
        terms: { kind: terms },
        detail: detail.trim() || undefined,
        refId: refId || undefined,
      });
      if (!result.ok) { setError(result.error); return; }
      onClose();
      router.refresh();
    });
  }

  // Escape closes it. A full-screen form with no way out but one small button
  // is a trap on a phone and worse on a keyboard.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  return (
    <div
      className="fixed inset-0 z-[70] grid place-items-end sm:place-items-center"
      role="dialog" aria-modal="true" aria-label={`Post to ${gameName}`}
    >
      {/* The scrim is a click target, not a second "Close" button — naming it
          one would give a screen reader two identical controls to choose
          between. The X below is the labelled one. */}
      <div aria-hidden="true" onClick={onClose} className="absolute inset-0 bg-ink/30" />

      <div className="glass-overlay relative flex max-h-[88vh] w-full max-w-md flex-col rounded-t-[var(--radius-panel)] sm:rounded-[var(--radius-panel)]">
        <div className="shrink-0 border-b border-line-soft px-4 pb-3 pt-4">
          <div className="flex items-start justify-between gap-3">
            <div>
              <h2 className="text-[1.0625rem] font-bold tracking-[-0.025em] text-ink">
                Post to {gameName}
              </h2>
              <p className="mt-0.5 text-[0.8125rem] text-ink-mute">
                Stays up for two hours, then disappears.
              </p>
            </div>
            <button type="button" onClick={onClose} aria-label="Close"
              className="grid h-8 w-8 shrink-0 place-items-center rounded-full border border-line text-ink-mute">
              <svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor"
                   strokeWidth="2" strokeLinecap="round" aria-hidden="true">
                <path d="M4 4l8 8M12 4l-8 8" />
              </svg>
            </button>
          </div>

          {picked.length > 0 && (
            <button type="button" onClick={submit} disabled={busy}
              className="pill pill-mint mt-3 w-full py-2.5 text-[0.875rem] disabled:opacity-50">
              {busy ? "Posting…" : "Post it"}
            </button>
          )}
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto p-4">
          {/* ---- which way round ---- */}
          <div className="grid grid-cols-2 gap-2">
            {SIDES.map((s) => (
              <button
                key={s.id} type="button"
                onClick={() => { setSide(s.id); setPicked([]); setRefId(""); }}
                aria-pressed={side === s.id}
                className={`rounded-[14px] border px-3 py-2.5 text-left transition-colors ${
                  side === s.id ? "border-mint bg-mint-wash" : "border-line bg-surface"
                }`}
              >
                <span className="block text-[0.875rem] font-bold text-ink">{s.label}</span>
                <span className="mt-0.5 block text-[0.6875rem] leading-snug text-ink-mute">
                  {s.blurb}
                </span>
              </button>
            ))}
          </div>

          {/* ---- what it is about ---- */}
          <p className="mb-2 mt-4 font-mono text-[0.5625rem] font-medium tracking-[0.1em] text-ink-faint">
            {many ? "WHAT CAN YOU RUN?" : "WHAT ARE YOU STUCK ON?"}
          </p>
          <input
            value={query} onChange={(e) => setQuery(e.target.value)}
            placeholder="Search" aria-label="Search what you can get help with"
            className="mb-2 w-full rounded-[10px] border border-line bg-surface px-3 py-2.5 text-[0.9375rem] text-ink outline-none focus:border-mint"
          />
          <ul className="grid gap-1.5">
            {shown.map((s) => {
              const on = picked.includes(s.id);
              return (
                <li key={s.id}>
                  <button
                    type="button" onClick={() => toggle(s.id)} aria-pressed={on}
                    className={`w-full rounded-[12px] border px-3 py-2.5 text-left transition-colors ${
                      on ? "border-mint bg-mint-wash" : "border-line-soft bg-surface"
                    }`}
                  >
                    <span className="flex items-center gap-2">
                      <span className="min-w-0 flex-1 text-[0.875rem] font-bold text-ink">
                        {s.name}
                      </span>
                      <span className="shrink-0 font-mono text-[0.5rem] tracking-[0.07em] text-ink-faint">
                        {s.kind.toUpperCase()}
                      </span>
                    </span>
                    {s.needs && (
                      <span className="mt-1 block text-[0.75rem] leading-relaxed text-ink-mute">
                        {s.needs}
                      </span>
                    )}
                  </button>
                </li>
              );
            })}
          </ul>

          {/* ---- the reference picture ---- */}
          {refs && refs.length > 0 && (
            <>
              <p className="mb-1 mt-4 font-mono text-[0.5625rem] font-medium tracking-[0.1em] text-ink-faint">
                PICK A PICTURE
              </p>
              <p className="mb-2 text-[0.75rem] leading-relaxed text-ink-mute">
                Shown on your post so people can see at a glance what it is
                about. It does not change anything — say the rest below.
              </p>
              <div className="flex flex-wrap gap-1.5">
                {refs.map((r) => (
                  <button
                    key={r.id} type="button"
                    onClick={() => setRefId(refId === r.id ? "" : r.id)}
                    aria-pressed={refId === r.id}
                    className={`flex items-center gap-2 rounded-full border py-1.5 pl-1.5 pr-3 transition-colors ${
                      refId === r.id ? "border-mint bg-mint-wash" : "border-line bg-surface"
                    }`}
                  >
                    <RefTile item={r} size={26} />
                    <span className="text-[0.8125rem] font-semibold text-ink">{r.label}</span>
                  </button>
                ))}
              </div>
            </>
          )}

          {/* ---- what you actually need ---- */}
          <p className="mb-2 mt-4 font-mono text-[0.5625rem] font-medium tracking-[0.1em] text-ink-faint">
            WHAT DO YOU NEED?
          </p>
          <textarea
            value={detail} onChange={(e) => setDetail(e.target.value.slice(0, 280))}
            rows={3} aria-label="What do you need"
            placeholder={
              side === "request"
                ? "I'm Angel race and need another Angel to finish the V3 quest…"
                : "I have the chip and can go now, happy to do a few…"
            }
            className="w-full rounded-[10px] border border-line bg-surface px-3 py-2.5 text-[0.9375rem] text-ink outline-none focus:border-mint"
          />
          <p className="mt-1 text-right font-mono text-[0.625rem] text-ink-faint">
            {detail.length}/280
          </p>

          {/* ---- in return ---- */}
          <p className="mb-2 mt-3 font-mono text-[0.5625rem] font-medium tracking-[0.1em] text-ink-faint">
            IN RETURN
          </p>
          <div className="grid grid-cols-2 gap-2">
            {(["free", "split"] as const).map((t) => (
              <button
                key={t} type="button" onClick={() => setTerms(t)} aria-pressed={terms === t}
                className={`rounded-[12px] border px-3 py-2.5 text-[0.8125rem] font-semibold transition-colors ${
                  terms === t ? "border-mint bg-mint-wash text-ink" : "border-line bg-surface text-ink-mute"
                }`}
              >
                {t === "free" ? "Nothing" : "Split the drops"}
              </button>
            ))}
          </div>
          <p className="mt-2 text-[0.6875rem] leading-relaxed text-ink-faint">
            There is no box for real money or account access on purpose. Neither
            is allowed here, and a run done on your account is not a service.
          </p>

          {error && (
            <p role="alert" className="mt-3 rounded-[10px] border border-bad/30 bg-bad-wash px-3 py-2 text-[0.875rem] text-bad">
              {error}
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
