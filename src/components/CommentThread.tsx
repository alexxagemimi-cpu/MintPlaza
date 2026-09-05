"use client";

import { useState } from "react";
import type { ListingComment } from "@/lib/sessions";
import { ReportButton } from "./ReportButton";

/**
 * The thread under a listing.
 *
 * It only exists for people who have voted. That is the rule that keeps it
 * useful: a vote here means "I want in", so everybody writing is somebody
 * actually involved, and the thread stays a place to sort out when and where
 * rather than a comment section to argue in.
 *
 * Two actions on a comment, reply and report, and nothing else. No likes — a
 * like on "I'm ready, add me" carries no information, and turning a working
 * thread into a popularity contest would only bury the person who answered
 * first.
 */

function Avatar({ name, url, size = 28 }: { name: string; url?: string; size?: number }) {
  let h = 0;
  for (let i = 0; i < name.length; i++) h = (h * 31 + name.charCodeAt(i)) % 360;
  return (
    <span
      aria-hidden="true"
      className="grid shrink-0 place-items-center overflow-hidden rounded-full font-bold"
      style={{
        width: size, height: size, fontSize: size * 0.34,
        color: `hsl(${h} 42% 30%)`, background: `hsl(${h} 46% 92%)`,
      }}
    >
      {url
        ? /* eslint-disable-next-line @next/next/no-img-element */
          <img src={url} alt="" className="h-full w-full object-cover" />
        : name.slice(0, 2).toUpperCase()}
    </span>
  );
}

const ago = (m: number) =>
  m < 1 ? "now" : m < 60 ? `${m}m` : `${Math.floor(m / 60)}h`;

function Comment({
  comment, onReply,
}: {
  comment: ListingComment;
  onReply: (author: string) => void;
}) {
  return (
    <li className={`flex gap-2.5 ${comment.replyTo ? "ml-8" : ""}`}>
      <Avatar name={comment.author} url={comment.avatarUrl} size={comment.replyTo ? 24 : 28} />
      <div className="min-w-0 flex-1">
        <p className="text-[0.875rem] leading-snug text-ink">
          <span className="font-bold">{comment.author}</span>
          {comment.online && (
            <span
              aria-label="Online now"
              title="On MintPlaza right now"
              className="ml-1.5 inline-block h-[6px] w-[6px] rounded-full bg-mint align-middle"
            />
          )}{" "}
          <span className="text-ink-soft">{comment.text}</span>
        </p>
        <p className="mt-1 flex items-center gap-3 font-mono text-[0.5625rem] tracking-[0.07em]">
          <span className="text-ink-faint">{ago(comment.minutesAgo).toUpperCase()}</span>
          <button
            type="button"
            onClick={() => onReply(comment.author)}
            className="font-semibold text-ink-faint transition-colors hover:text-ink"
          >
            Reply
          </button>
          <ReportButton
            what="comment"
            subject={`${comment.author}: “${comment.text}”`}
            compact
          />
        </p>
      </div>
    </li>
  );
}

export function CommentThread({
  comments: initial,
  youVoted,
  onVote,
  you = "you",
}: {
  comments: readonly ListingComment[];
  youVoted: boolean;
  /** Voting is what opens the thread, so the empty state can do it. */
  onVote: () => void;
  you?: string;
}) {
  const [comments, setComments] = useState<ListingComment[]>([...initial]);
  const [draft, setDraft] = useState("");
  const [replyTo, setReplyTo] = useState<string | null>(null);

  function send() {
    const text = draft.trim();
    if (!text) return;
    setComments((prev) => [
      ...prev,
      {
        id: `local-${prev.length}`,
        author: you,
        online: true,
        text: replyTo ? `@${replyTo} ${text}` : text,
        minutesAgo: 0,
        replyTo: replyTo ?? undefined,
      },
    ]);
    setDraft("");
    setReplyTo(null);
  }

  if (!youVoted) {
    return (
      <div className="mt-3 rounded-[12px] border border-dashed border-line bg-fill px-3 py-3 text-center">
        <p className="text-[0.8125rem] leading-relaxed text-ink-mute">
          Vote to say you want in. The thread opens once you have — it is for the
          people actually going.
        </p>
        <button type="button" onClick={onVote} className="pill pill-mint mt-2 py-1.5 text-[0.8125rem]">
          Vote — I want in
        </button>
      </div>
    );
  }

  return (
    <div className="mt-3 border-t border-line-soft pt-3">
      <p className="mb-2.5 font-mono text-[0.5625rem] font-medium tracking-[0.1em] text-ink-faint">
        {comments.length === 0
          ? "NOBODY HAS SAID ANYTHING YET"
          : `${comments.length} ${comments.length === 1 ? "MESSAGE" : "MESSAGES"}`}
      </p>

      {comments.length > 0 && (
        <ul className="mb-3 grid gap-3">
          {comments.map((c) => (
            <Comment key={c.id} comment={c} onReply={setReplyTo} />
          ))}
        </ul>
      )}

      {replyTo && (
        <p className="mb-1.5 flex items-center gap-2 text-[0.75rem] text-ink-mute">
          Replying to <b className="text-ink">{replyTo}</b>
          <button
            type="button" onClick={() => setReplyTo(null)}
            className="font-semibold text-ink-faint underline"
          >
            cancel
          </button>
        </p>
      )}

      <div className="flex items-center gap-2">
        <input
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => { if (e.key === "Enter") send(); }}
          placeholder={replyTo ? `Reply to ${replyTo}…` : "Say when you are free…"}
          aria-label="Write a message"
          className="min-w-0 flex-1 rounded-full border border-line bg-surface px-3.5 py-2 text-[0.875rem] text-ink outline-none focus:border-mint"
        />
        <button
          type="button"
          onClick={send}
          disabled={!draft.trim()}
          className="pill pill-mint shrink-0 py-2 text-[0.8125rem] disabled:opacity-40"
        >
          Send
        </button>
      </div>
    </div>
  );
}
