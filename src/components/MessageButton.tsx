"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { startConversation } from "@/lib/actions/messages";

/**
 * "Message" — the button that used to do nothing.
 *
 * ---------------------------------------------------------------------------
 * Why it is a button and not a link
 * ---------------------------------------------------------------------------
 *
 * A link needs a destination, and the destination is a conversation id that
 * does not exist until somebody asks for it. The alternatives are both worse:
 * pre-creating a thread with everybody a player might message fills the
 * database with empty conversations, and a link to `/messages/new?to=alx22n`
 * would put a username in a URL that gets shared, screenshotted and guessed at.
 *
 * So the click asks the database for the thread — which creates it, or returns
 * the one that already exists, because `start_conversation` is idempotent —
 * and then navigates to it. A double tap lands in one conversation, not two.
 *
 * ---------------------------------------------------------------------------
 * Failure is spoken, not swallowed
 * ---------------------------------------------------------------------------
 *
 * Three real things can stop this: not signed in, a restricted or suspended
 * account, or the daily new-conversation limit. All three come back from the
 * database as a sentence written for a player, and all three are shown. A
 * button that silently does nothing on failure is how this one got here.
 */
export function MessageButton({
  username,
  listingId,
  className = "pill pill-mint shrink-0 py-1.5 text-[0.8125rem]",
  label,
}: {
  /** Who to message. A username — this component never handles a user id. */
  username: string;
  /** The listing this came from, so the thread knows what it is about. */
  listingId?: string;
  className?: string;
  label?: string;
}) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [busy, start] = useTransition();

  return (
    <span className="inline-flex flex-col items-end gap-1">
      <button
        type="button"
        disabled={busy}
        onClick={() => {
          setError(null);
          start(async () => {
            const result = await startConversation(username, listingId);
            if (!result.ok) {
              setError(result.error);
              return;
            }
            router.push(`/messages/${result.data.id}`);
          });
        }}
        className={`${className} disabled:opacity-50`}
      >
        {busy ? "Opening…" : (label ?? "Message")}
      </button>
      {error && (
        <span role="alert" className="text-[0.6875rem] leading-snug text-bad">
          {error}
        </span>
      )}
    </span>
  );
}
