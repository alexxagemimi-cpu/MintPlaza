"use client";

import { useState, useTransition } from "react";
import { resolveSupport, type SupportMessage } from "@/lib/admin/actions";

/**
 * What players have said is broken.
 *
 * The other half of /support, and it exists for the same reason ReportsPanel
 * does: a box that sends into nothing is worse than no box, because it teaches
 * people the site does not listen and then they stop saying anything.
 *
 * Kept apart from reports deliberately. A report needs a moderation decision
 * about a person; this needs a fix or a sentence back. One list would bury the
 * first under the second.
 *
 * Message bodies are rendered as text, never as markup — every character here
 * was typed by somebody else, and this panel is read by the one account that
 * can change the site.
 */

const STATUS_STYLE: Record<string, { fg: string; bg: string }> = {
  open:     { fg: "#A8501E", bg: "#FBEDE3" },
  answered: { fg: "#1F7A54", bg: "#E6F4EC" },
  closed:   { fg: "#6B7A74", bg: "#EEF2F0" },
};

function when(iso: string): string {
  const mins = Math.max(0, Math.round((Date.now() - new Date(iso).getTime()) / 60_000));
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const h = Math.floor(mins / 60);
  if (h < 24) return `${h}h ago`;
  return `${Math.floor(h / 24)}d ago`;
}

function MessageCard({
  message, onDone,
}: {
  message: SupportMessage;
  onDone: (id: string) => void;
}) {
  const [note, setNote] = useState(message.admin_note ?? "");
  const [error, setError] = useState<string | null>(null);
  const [busy, start] = useTransition();
  const style = STATUS_STYLE[message.status] ?? STATUS_STYLE.open;

  function decide(status: "answered" | "closed") {
    setError(null);
    start(async () => {
      const result = await resolveSupport(message.id, status, note.trim() || undefined);
      if (!result.ok) { setError(result.error); return; }
      onDone(message.id);
    });
  }

  return (
    <li className="glass rounded-[var(--radius-inner)] p-4">
      <div className="flex flex-wrap items-center gap-2">
        <span
          className="rounded-[5px] px-1.5 py-0.5 font-mono text-[0.5rem] font-bold tracking-[0.08em]"
          style={{ color: style.fg, background: style.bg }}
        >
          {message.status.toUpperCase()}
        </span>
        <span className="font-mono text-[0.5625rem] tracking-[0.08em] text-ink-faint">
          {when(message.created_at)}
        </span>
        {message.context && (
          <span className="rounded-[5px] bg-fill px-1.5 py-0.5 font-mono text-[0.5rem] tracking-[0.07em] text-ink-mute">
            {message.context}
          </span>
        )}
      </div>

      {/* Their words, whole and unstyled. Truncating a support message hides
          the sentence that says what actually happened. */}
      <p className="mt-2.5 whitespace-pre-wrap break-words text-[0.9375rem] leading-relaxed text-ink">
        {message.body}
      </p>

      <p className="mt-2.5 text-[0.8125rem] text-ink-mute">
        <span className="text-ink-faint">From </span>
        <b className="text-ink">{message.sender_username ?? "a deleted account"}</b>
        {message.sender_roblox_id && (
          <span className="font-mono text-[0.6875rem] text-ink-faint">
            {" "}· Roblox {message.sender_roblox_id}
          </span>
        )}
      </p>

      {message.status === "open" && (
        <>
          <input
            value={note}
            onChange={(e) => setNote(e.target.value.slice(0, 2000))}
            placeholder="What you did about it — for you, later"
            aria-label="Note on this message"
            className="mt-3 w-full rounded-[10px] border border-line bg-surface px-3 py-2 text-[0.875rem] text-ink outline-none focus:border-mint"
          />
          <div className="mt-2 flex gap-2">
            <button
              type="button" onClick={() => decide("answered")} disabled={busy}
              className="pill pill-mint flex-1 py-2 text-[0.875rem] disabled:opacity-50"
            >
              Sorted it
            </button>
            <button
              type="button" onClick={() => decide("closed")} disabled={busy}
              className="pill pill-ghost flex-1 py-2 text-[0.875rem] disabled:opacity-50"
            >
              Nothing to do
            </button>
          </div>
        </>
      )}

      {message.status !== "open" && message.admin_note && (
        <p className="mt-2 text-[0.75rem] leading-relaxed text-ink-faint">
          Your note: {message.admin_note}
        </p>
      )}

      {error && <p role="alert" className="mt-2 text-[0.8125rem] text-bad">{error}</p>}
    </li>
  );
}

export function SupportPanel({ messages }: { messages: readonly SupportMessage[] }) {
  const [done, setDone] = useState<string[]>([]);
  const showing = messages.filter((m) => !done.includes(m.id));

  return (
    <section className="mt-7">
      <div className="mb-1 flex items-baseline justify-between gap-3">
        <h2 className="text-[1.0625rem] font-bold tracking-[-0.025em] text-ink">
          Tell us your problem
        </h2>
        <span className="font-mono text-[0.5625rem] tracking-[0.08em] text-ink-faint">
          {showing.length} OPEN
        </span>
      </div>
      <p className="mb-4 max-w-[62ch] text-[0.8125rem] leading-relaxed text-ink-mute">
        Messages sent from the support screen — the site is broken, or I cannot
        work out how to do this. Five a day per account, so nobody can flood it.
      </p>

      {showing.length === 0 ? (
        <div className="glass-quiet rounded-[var(--radius-panel)] px-6 py-12 text-center">
          <p className="text-[1rem] font-bold tracking-[-0.02em] text-ink">
            Nothing waiting
          </p>
          <p className="mx-auto mt-1.5 max-w-[40ch] text-[0.875rem] leading-relaxed text-ink-mute">
            Either everything works, or nobody has found the button yet.
          </p>
        </div>
      ) : (
        <ul className="grid gap-2">
          {showing.map((m) => (
            <MessageCard
              key={m.id}
              message={m}
              onDone={(id) => setDone((p) => [...p, id])}
            />
          ))}
        </ul>
      )}
    </section>
  );
}
