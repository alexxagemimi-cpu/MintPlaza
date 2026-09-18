"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  markRead,
  reportMessage,
  sendMessage,
  type Thread,
  type ThreadMessage,
} from "@/lib/actions/messages";

/**
 * One conversation.
 *
 * ---------------------------------------------------------------------------
 * What this screen is actually for
 * ---------------------------------------------------------------------------
 *
 * Two people arranging a trade in a game neither of them is currently in. That
 * is a short, practical exchange — "still have it?", "meet me in trade realm",
 * "add me, same name" — not a chat client. So there are no typing indicators,
 * no read receipts shown to the sender, no reactions and no attachments. Every
 * one of those is a place to leak something or to hide a link in, and none of
 * them helps somebody swap a Kitsune.
 *
 * ---------------------------------------------------------------------------
 * Three things that are not optional on a screen like this
 * ---------------------------------------------------------------------------
 *
 * REPORT is per message, because "they said something" needs to point at the
 * something, and it is the ONLY safety control on this screen — there is no
 * block button on MintPlaza.
 *
 * That is a deliberate call and worth knowing about. A scammer's last move is
 * to block the person they just took an item from: it buries the conversation,
 * ends the confrontation, and leaves the victim with nothing to point at.
 * Blocking hands the tool to whoever uses it first, and on a trading board
 * that is nearly always the person in the wrong.
 *
 * So a report goes to the owner with the message attached, and the owner can
 * restrict or suspend the account — which stops them messaging EVERYBODY
 * rather than just the one person who complained. Dealing with somebody
 * behaving badly should protect the next victim, not only this one.
 *
 * NOTHING IS RENDERED AS MARKUP. Every message body goes through React as
 * text, never dangerouslySetInnerHTML, so a message containing a script tag is
 * a message containing the words "script tag".
 */
export function MessageThread({
  conversationId,
  thread,
}: {
  conversationId: string;
  thread: Thread;
}) {
  const router = useRouter();
  const [draft, setDraft] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, start] = useTransition();
  const foot = useRef<HTMLDivElement>(null);

  const them = thread.other.username ?? "this player";

  // Mark read on open. Deliberately not on every keystroke or scroll: the
  // question "have they seen it" is answered by the thread being opened, and
  // anything finer would be writing to the database on a timer for no gain.
  useEffect(() => {
    void markRead(conversationId);
  }, [conversationId]);

  // A chat that opens at the top is a chat where you read yesterday first.
  useEffect(() => {
    foot.current?.scrollIntoView({ block: "end" });
  }, [thread.messages.length]);

  function send() {
    const text = draft.trim();
    if (!text) return;
    setError(null);
    start(async () => {
      const result = await sendMessage(conversationId, text);
      if (!result.ok) {
        setError(result.error);
        return;
      }
      // Cleared only on success, so a message refused by a rate limit or a
      // block is still in the box to retry rather than silently lost.
      setDraft("");
      router.refresh();
    });
  }

  return (
    <div className="mx-auto flex min-h-[100dvh] max-w-2xl flex-col px-4 sm:px-8">
      {/* ---- who, and the way out ---- */}
      <header className="sticky top-0 z-10 flex items-center gap-3 border-b border-line-soft bg-bg/85 py-3 backdrop-blur">
        <button
          type="button"
          onClick={() => router.push("/messages")}
          aria-label="Back to messages"
          className="grid h-9 w-9 shrink-0 place-items-center rounded-full text-ink-mute hover:text-ink"
        >
          <svg
            width="18"
            height="18"
            viewBox="0 0 16 16"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <path d="M10 3.5 5.5 8l4.5 4.5" />
          </svg>
        </button>

        <div className="min-w-0 flex-1">
          <p className="truncate text-[0.9375rem] font-bold tracking-[-0.02em] text-ink">
            {thread.other.display_name || them}
          </p>
          {thread.other.online && (
            <p className="flex items-center gap-1.5 text-[0.6875rem] font-semibold text-mint">
              <span className="h-1.5 w-1.5 rounded-full bg-mint-vivid" />
              Online
            </p>
          )}
        </div>

        {/* No block button, on purpose — see the note at the top of this file.
            Reporting a message is the control, and it sits on each message
            where it can name the thing being reported. */}
      </header>

      {/* ---- the conversation ---- */}
      <div className="flex-1 py-4">
        {thread.messages.length === 0 ? (
          <p className="py-10 text-center text-[0.875rem] text-ink-mute">
            Nothing here yet. Say what you are after.
          </p>
        ) : (
          <ul className="grid gap-2">
            {thread.messages.map((m) => (
              <Bubble key={m.id} message={m} />
            ))}
          </ul>
        )}
        <div ref={foot} />
      </div>

      {/* ---- the one safety line that belongs on every chat like this ---- */}
      <p className="rounded-[var(--radius-inner)] bg-fill px-3 py-2 text-[0.6875rem] leading-relaxed text-ink-faint">
        MintPlaza cannot see a trade happen and cannot get an item back. Nobody
        here will ever ask for your password or a one-time code, and anybody who
        does is stealing from you.
      </p>

      {/* ---- writing ---- */}
      <div className="sticky bottom-0 bg-bg/85 py-3 backdrop-blur">
        {error && (
          <p
            role="alert"
            className="mb-2 rounded-[10px] border border-bad/30 bg-bad-wash px-3 py-2 text-[0.8125rem] text-bad"
          >
            {error}
          </p>
        )}
        <div className="flex items-end gap-2">
          <textarea
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            onKeyDown={(e) => {
              // Enter sends, Shift+Enter makes a new line. On a phone the
              // keyboard's own return key inserts a newline, which is why
              // the button exists too rather than instead.
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                send();
              }
            }}
            rows={1}
            maxLength={2000}
            placeholder={`Message ${them}`}
            className="max-h-32 min-h-[2.75rem] flex-1 resize-y rounded-[14px] border border-line bg-surface px-3.5 py-3 text-[0.9375rem] text-ink outline-none focus:border-mint"
          />
          <button
            type="button"
            onClick={send}
            disabled={busy || !draft.trim()}
            className="pill pill-mint shrink-0 py-3 text-[0.875rem] disabled:opacity-40"
          >
            {busy ? "…" : "Send"}
          </button>
        </div>
      </div>
    </div>
  );
}

/**
 * One message.
 *
 * `{m.body}` and nothing else — React escapes it, so a body containing markup
 * renders as the characters somebody typed. This is the whole XSS story for
 * this screen, and it is one line because that is the correct size for it.
 */
function Bubble({ message }: { message: ThreadMessage }) {
  const [reported, setReported] = useState(false);
  const [busy, start] = useTransition();

  return (
    <li
      className={`group flex ${message.mine ? "justify-end" : "justify-start"}`}
    >
      <div
        className={`flex max-w-[82%] items-end gap-1.5 ${message.mine ? "flex-row-reverse" : ""}`}
      >
        <div
          className={`rounded-[16px] px-3.5 py-2.5 ${
            message.mine
              ? "rounded-br-[5px] bg-mint text-white"
              : "rounded-bl-[5px] bg-fill text-ink"
          }`}
        >
          <p className="whitespace-pre-wrap break-words text-[0.9375rem] leading-relaxed">
            {message.body}
          </p>
          <p
            className={`mt-1 text-[0.5625rem] ${message.mine ? "text-white/70" : "text-ink-faint"}`}
          >
            {time(message.created_at)}
          </p>
        </div>

        {/* Only somebody else's message can be reported, because reporting your
            own is not a thing anybody needs and would only add a button. */}
        {!message.mine && (
          <button
            type="button"
            disabled={busy || reported}
            onClick={() =>
              start(async () => {
                await reportMessage(message.id, "Reported from chat");
                setReported(true);
              })
            }
            aria-label={reported ? "Reported" : "Report this message"}
            title={reported ? "Reported" : "Report this message"}
            className={`shrink-0 rounded-full p-1 transition-opacity ${
              reported
                ? "text-warn opacity-100"
                : "text-ink-faint opacity-0 hover:text-bad focus:opacity-100 group-hover:opacity-100"
            }`}
          >
            <svg
              width="13"
              height="13"
              viewBox="0 0 16 16"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.8"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <path d="M3 14V2.5h9l-1.5 3L12 8.5H3" />
            </svg>
          </button>
        )}
      </div>
    </li>
  );
}

function time(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  const mins = Math.floor((Date.now() - d.getTime()) / 60_000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m`;
  if (mins < 60 * 24)
    return d.toLocaleTimeString(undefined, {
      hour: "numeric",
      minute: "2-digit",
    });
  return d.toLocaleDateString(undefined, { day: "numeric", month: "short" });
}
