"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { unlockConsole } from "@/lib/admin/gate";

/**
 * The door.
 *
 * Four boxes, a big button, and nothing else on screen. No hints about what the
 * code is, no "forgot your code", and the same message whether the code was
 * wrong or you have simply tried too many times — telling someone which would
 * tell them whether they were close.
 */
export function PasscodeScreen() {
  const [code, setCode] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [checking, start] = useTransition();
  const router = useRouter();

  function submit() {
    if (code.length < 4 || checking) return;
    setError(null);
    start(async () => {
      const result = await unlockConsole(code);
      if (result.ok) router.refresh();
      else { setError(result.error); setCode(""); }
    });
  }

  return (
    <div className="mx-auto grid min-h-[70vh] max-w-sm place-items-center px-5">
      <div className="w-full text-center">
        <span className="mx-auto mb-5 grid h-14 w-14 place-items-center rounded-full border border-line bg-surface text-mint">
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor"
               strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <rect x="4" y="10" width="16" height="10" rx="2.5" />
            <path d="M8 10V7.5a4 4 0 0 1 8 0V10" />
          </svg>
        </span>

        <h1 className="text-[1.375rem] font-extrabold tracking-[-0.03em] text-ink">
          Enter your code
        </h1>
        <p className="mx-auto mt-1.5 max-w-[26ch] text-[0.9375rem] leading-relaxed text-ink-soft">
          This keeps the panel shut even if your tablet is left unlocked.
        </p>

        <input
          type="password"
          inputMode="numeric"
          autoComplete="off"
          autoFocus
          value={code}
          maxLength={12}
          onChange={(e) => { setCode(e.target.value.replace(/\D/g, "")); setError(null); }}
          onKeyDown={(e) => { if (e.key === "Enter") submit(); }}
          aria-label="Passcode"
          className="mt-7 w-full rounded-[14px] border border-line bg-surface px-4 py-4 text-center font-mono text-[1.75rem] tracking-[0.5em] text-ink outline-none focus:border-mint"
        />

        {error && (
          <p role="alert" className="mt-3 text-[0.875rem] font-semibold text-bad">{error}</p>
        )}

        <button
          type="button"
          onClick={submit}
          disabled={code.length < 4 || checking}
          className="pill pill-mint mt-4 w-full py-3 text-[0.9375rem] disabled:opacity-50"
        >
          {checking ? "Checking…" : "Open panel"}
        </button>

        <a href="/app" className="mt-5 inline-block text-[0.875rem] font-semibold text-ink-mute underline">
          Back to MintPlaza
        </a>
      </div>
    </div>
  );
}
