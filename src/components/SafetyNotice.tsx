"use client";

import { useEffect, useRef, useState } from "react";

const STORAGE_KEY = "mintplaza.safety.services.v1";

/**
 * The notice that opens with the services section.
 *
 * It exists because the most common way players lose things in these games is
 * an agreement with no record of it. This says the one thing that actually
 * helps, then gets out of the way, and can be silenced permanently.
 *
 * Storage is wrapped in try/catch: a private window or blocked site data
 * throws on access, and the correct behaviour then is to show the notice, not
 * to break the page.
 */
export function SafetyNotice() {
  const [open, setOpen] = useState(false);
  const dialogRef = useRef<HTMLDivElement>(null);
  const confirmRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    let dismissed = false;
    try {
      dismissed = window.localStorage.getItem(STORAGE_KEY) === "hidden";
    } catch {
      dismissed = false;
    }
    if (!dismissed) setOpen(true);
  }, []);

  useEffect(() => {
    if (!open) return;
    confirmRef.current?.focus();

    function onKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") setOpen(false);
      if (e.key !== "Tab" || !dialogRef.current) return;
      // Keep focus inside while it is open.
      const focusables = dialogRef.current.querySelectorAll<HTMLElement>("button");
      if (focusables.length === 0) return;
      const first = focusables[0];
      const last = focusables[focusables.length - 1];
      if (e.shiftKey && document.activeElement === first) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault();
        first.focus();
      }
    }

    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [open]);

  function dismiss(forever: boolean) {
    if (forever) {
      try {
        window.localStorage.setItem(STORAGE_KEY, "hidden");
      } catch {
        // Nothing to do — it will simply show again next time.
      }
    }
    setOpen(false);
  }

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[60] grid place-items-center p-4">
      <div
        aria-hidden="true"
        className="absolute inset-0 bg-ink/40"
        onClick={() => dismiss(false)}
      />

      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="safety-title"
        aria-describedby="safety-body"
        className="glass-overlay relative w-full max-w-[26rem] rounded-[var(--radius-panel)] p-6"
      >
        <ProofIllustration />

        <h2
          id="safety-title"
          className="mt-5 text-[1.1875rem] font-extrabold leading-snug tracking-[-0.03em] text-ink"
        >
          Record it before you hand anything over
        </h2>

        <p id="safety-body" className="mt-2.5 text-[0.9375rem] leading-relaxed text-ink-soft">
          Screen record before you pay for anything, before and after a raid,
          and any time something feels off. If it goes wrong, that recording is
          the only proof you will have.
        </p>

        <p className="mt-3 text-[0.8125rem] leading-relaxed text-ink-mute">
          MintPlaza never holds your items and cannot reverse a trade. Nobody
          here is a middleman, and anyone claiming to be one is worth reporting.
        </p>

        <div className="mt-6 flex flex-col gap-2">
          <button
            ref={confirmRef}
            type="button"
            onClick={() => dismiss(false)}
            className="pill pill-mint w-full justify-center py-3"
          >
            I understand
          </button>
          <button
            type="button"
            onClick={() => dismiss(true)}
            className="rounded-full px-4 py-2 text-[0.8125rem] font-semibold text-ink-mute transition-colors hover:text-ink"
          >
            Don&rsquo;t show this again
          </button>
        </div>
      </div>
    </div>
  );
}

/** A screen with a recording indicator. Drawn rather than stock art. */
function ProofIllustration() {
  return (
    <svg
      viewBox="0 0 320 120"
      className="w-full"
      role="img"
      aria-label="A screen being recorded"
      style={{ maxHeight: 120 }}
    >
      <rect x="0" y="0" width="320" height="120" rx="16" fill="var(--color-mint-wash)" />
      {/* device */}
      <rect x="92" y="22" width="136" height="80" rx="10"
            fill="var(--color-surface)" stroke="var(--color-mint)" strokeOpacity="0.35" strokeWidth="1.5" />
      <rect x="104" y="36" width="64" height="6" rx="3" fill="var(--color-mint)" fillOpacity="0.35" />
      <rect x="104" y="50" width="96" height="6" rx="3" fill="var(--color-mint)" fillOpacity="0.22" />
      <rect x="104" y="64" width="80" height="6" rx="3" fill="var(--color-mint)" fillOpacity="0.22" />
      <rect x="104" y="80" width="44" height="10" rx="5" fill="var(--color-mint)" fillOpacity="0.5" />
      {/* record pip */}
      <circle cx="212" cy="38" r="12" fill="var(--color-surface)" />
      <circle cx="212" cy="38" r="12" fill="var(--color-bad)" fillOpacity="0.14" />
      <circle cx="212" cy="38" r="5" fill="var(--color-bad)" />
      {/* framing marks */}
      <path d="M64 34v-8a6 6 0 0 1 6-6h8M256 34v-8a6 6 0 0 0-6-6h-8M64 90v8a6 6 0 0 0 6 6h8M256 90v8a6 6 0 0 1-6 6h-8"
            stroke="var(--color-mint)" strokeOpacity="0.45" strokeWidth="2" strokeLinecap="round" fill="none" />
    </svg>
  );
}
