"use client";

import { useState, useRef, useTransition } from "react";
import { sendSupportMessage } from "@/lib/actions/support";
import { SUPPORT_EMAIL, MAX_SUPPORT_LENGTH } from "@/lib/support";

/**
 * One box, one button.
 *
 * Shaped like a chat composer rather than a support form because that is the
 * shape a player already knows how to use, and because every field a form adds
 * is another thing to get wrong before the thing they wanted to say. A
 * category picker would only sort a queue nobody is drowning in yet.
 *
 * The email line sits under the box rather than in a footer: it is the route
 * for somebody who cannot sign in, which is exactly the person this composer
 * will not work for, so it has to be visible in the same glance.
 */
export function SupportComposer({
  signedIn,
  context,
}: {
  signedIn: boolean;
  /** What the player was on. Sent with the message; never typed by them. */
  context?: string;
}) {
  const [body, setBody] = useState("");
  const [sent, setSent] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const box = useRef<HTMLTextAreaElement>(null);

  const left = MAX_SUPPORT_LENGTH - body.length;
  const canSend = signedIn && body.trim().length > 0 && !pending;

  function grow(el: HTMLTextAreaElement) {
    el.style.height = "auto";
    el.style.height = `${Math.min(el.scrollHeight, 260)}px`;
  }

  function send() {
    if (!canSend) return;
    setError(null);
    startTransition(async () => {
      const result = await sendSupportMessage(body, context);
      if (!result.ok) {
        setError(result.error);
        return;
      }
      setBody("");
      setSent(true);
      if (box.current) box.current.style.height = "auto";
    });
  }

  if (sent) {
    return (
      <div className="glass rounded-[var(--radius-panel)] px-6 py-10 text-center">
        <span className="mx-auto grid h-12 w-12 place-items-center rounded-full border border-mint/30 bg-mint/10 text-mint">
          <svg width="22" height="22" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <path d="m4 10.5 4 4 8-9" />
          </svg>
        </span>
        <p className="mt-5 text-[1.0625rem] font-bold tracking-[-0.02em] text-ink">
          Got it — thank you.
        </p>
        <p className="measure mx-auto mt-2 text-[0.875rem] leading-relaxed text-ink-mute">
          It has gone straight to the person who built this. There is no ticket
          number and nothing to chase; if it needs an answer, you will get one.
        </p>
        <button
          type="button"
          onClick={() => setSent(false)}
          className="pill pill-ghost mt-7 py-2.5 text-[0.8125rem]"
        >
          Send another
        </button>
      </div>
    );
  }

  return (
    <div>
      {error && (
        <p
          role="alert"
          className="mb-3 rounded-[var(--radius-inner)] border border-bad/30 bg-bad/[0.06] px-3.5 py-2.5 text-[0.8125rem] leading-relaxed text-bad"
        >
          {error}
        </p>
      )}

      {/* The composer. One rounded field, the send button inside it on the
          right, exactly where a thumb already expects it. */}
      <div
        className={`flex items-end gap-2 rounded-[1.75rem] border bg-surface p-2 pl-4 transition-colors ${
          body.trim() ? "border-mint/50" : "border-line"
        }`}
      >
        <label htmlFor="support-body" className="sr-only">
          Tell us your problem
        </label>
        <textarea
          id="support-body"
          ref={box}
          rows={1}
          value={body}
          disabled={!signedIn || pending}
          maxLength={MAX_SUPPORT_LENGTH}
          placeholder={signedIn ? "What went wrong?" : "Sign in to send a message"}
          onChange={(e) => { setBody(e.target.value); grow(e.target); }}
          onKeyDown={(e) => {
            // Enter sends, Shift+Enter breaks the line — the chat convention.
            // A support message is usually one sentence, so the common case
            // should not need a second gesture.
            if (e.key === "Enter" && !e.shiftKey) {
              e.preventDefault();
              send();
            }
          }}
          className="max-h-[260px] min-h-[2.75rem] flex-1 resize-none self-center bg-transparent py-2.5 text-[0.9375rem] leading-relaxed text-ink outline-none placeholder:text-ink-faint disabled:cursor-not-allowed"
        />

        <button
          type="button"
          onClick={send}
          disabled={!canSend}
          aria-label="Send"
          className="grid h-11 w-11 shrink-0 place-items-center rounded-full bg-mint text-[#06150E] transition-all hover:brightness-95 active:scale-95 disabled:cursor-not-allowed disabled:bg-fill disabled:text-ink-faint"
        >
          {pending ? (
            <svg width="19" height="19" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true" className="animate-spin">
              <path d="M10 2.5a7.5 7.5 0 1 1-5.3 2.2" />
            </svg>
          ) : (
            <svg width="19" height="19" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <path d="M10 16V4M4.5 9.5 10 4l5.5 5.5" />
            </svg>
          )}
        </button>
      </div>

      {/* Under the box: the fallback on the left, the counter on the right,
          and the counter only once it is worth knowing about. */}
      <div className="mt-2.5 flex items-start justify-between gap-4 px-1">
        <p className="text-[0.75rem] leading-relaxed text-ink-faint">
          For better assistance try to email us at{" "}
          <a
            href={`mailto:${SUPPORT_EMAIL}`}
            className="font-semibold text-ink-mute underline decoration-line underline-offset-2 hover:text-mint hover:decoration-mint"
          >
            {SUPPORT_EMAIL}
          </a>
        </p>
        {body.length > MAX_SUPPORT_LENGTH - 300 && (
          <span
            className={`shrink-0 font-mono text-[0.6875rem] tabular-nums ${
              left < 0 ? "text-bad" : "text-ink-faint"
            }`}
          >
            {left}
          </span>
        )}
      </div>
    </div>
  );
}
