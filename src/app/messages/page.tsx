import Link from "next/link";
import type { Metadata } from "next";
import { readInbox } from "@/lib/actions/messages";
import { currentProfile } from "@/lib/supabase/server";

export const metadata: Metadata = { title: "Messages" };

/**
 * The inbox.
 *
 * ---------------------------------------------------------------------------
 * Why this is not scoped to a game
 * ---------------------------------------------------------------------------
 *
 * Everything else on this site is per-game, deliberately: somebody deep in
 * Blox Fruits does not want a Sonaria board in the way. Messages are the one
 * exception, and the reason is simple — a conversation is with a PERSON, and
 * the same person turns up in two games. Splitting the inbox by game would
 * mean a player hunting through six tabs for a reply they know arrived.
 *
 * ---------------------------------------------------------------------------
 * What is not here
 * ---------------------------------------------------------------------------
 *
 * No search, no folders, no archive. The list is capped at 200 threads sorted
 * by what moved last, which for a trading site is the whole of what anybody
 * needs: the conversation you care about is the one that just got a reply.
 */
/**
 * The stand-in for a party's avatar.
 *
 * A group of five has no one face to show, and borrowing a member's would put
 * one person's picture on a chat belonging to all of them — which reads, at a
 * glance in a list, as a direct message from them.
 */
function PartyMark({ count }: { count: number }) {
  return (
    <span
      aria-hidden="true"
      className="grid h-9 w-9 shrink-0 place-items-center rounded-full border border-mint/30 bg-mint-wash font-mono text-[0.6875rem] font-bold text-mint"
    >
      {count}
    </span>
  );
}

export default async function MessagesPage() {
  const profile = await currentProfile();

  if (!profile) {
    return (
      <Shell>
        <p className="mt-10 text-center text-[0.9375rem] text-ink-mute">
          Sign in to see your messages.
        </p>
        <div className="mt-4 flex justify-center">
          <Link href="/login" className="pill pill-mint py-2 text-[0.875rem]">
            Sign in
          </Link>
        </div>
      </Shell>
    );
  }

  const rows = await readInbox();

  return (
    <Shell>
      {rows.length === 0 ? (
        <div className="mt-10 text-center">
          <p className="text-[0.9375rem] font-semibold text-ink">No messages yet.</p>
          <p className="mx-auto mt-2 max-w-sm text-[0.8125rem] leading-relaxed text-ink-mute">
            Open somebody&rsquo;s profile from a listing and tap Message. A
            conversation starts when you send the first one.
          </p>
        </div>
      ) : (
        <ul className="mt-4 grid gap-2">
          {rows.map((r) => (
            <li key={r.id}>
              <Link
                href={`/messages/${r.id}`}
                className="glass-quiet flex items-center gap-3 rounded-[var(--radius-panel)] px-3.5 py-3 transition-colors hover:border-line"
              >
                {/* A party names itself and has no single other person to
                    show, so it gets its own mark rather than one member's
                    avatar standing in for five. */}
                {r.kind === "party"
                  ? <PartyMark count={r.member_count} />
                  : <Avatar name={r.other_username ?? "?"} />}
                <span className="min-w-0 flex-1">
                  <span className="flex items-center gap-1.5">
                    <span className="min-w-0 truncate text-[0.875rem] font-bold tracking-[-0.015em] text-ink">
                      {r.kind === "party"
                        ? (r.title ?? "Party")
                        : (r.other_display_name || r.other_username)}
                    </span>
                    {r.kind === "party" && (
                      <span className="shrink-0 rounded-full border border-line px-1.5 py-px font-mono text-[0.5625rem] tracking-[0.08em] text-ink-faint">
                        {r.member_count}
                      </span>
                    )}
                    {r.kind === "direct" && r.other_online && (
                      <span
                        aria-label="Online"
                        title="Online"
                        className="h-1.5 w-1.5 shrink-0 rounded-full bg-mint-vivid"
                      />
                    )}
                    <span className="ml-auto shrink-0 font-mono text-[0.625rem] text-ink-faint">
                      {when(r.last_message_at)}
                    </span>
                  </span>
                  <span className="mt-0.5 flex items-center gap-2">
                    {/* Rendered as text, like every other message body on this
                        site. A preview is still a message somebody else wrote. */}
                    <span
                      className={`min-w-0 flex-1 truncate text-[0.8125rem] ${
                        r.unread > 0 ? "font-semibold text-ink" : "text-ink-mute"
                      }`}
                    >
                      {r.last_sender_is_me && <span className="text-ink-faint">You: </span>}
                      {r.last_body ?? "No messages yet"}
                    </span>
                    {r.unread > 0 && (
                      <span className="grid h-[18px] min-w-[18px] shrink-0 place-items-center rounded-full bg-mint px-1 font-mono text-[0.5625rem] font-bold text-white">
                        {r.unread > 99 ? "99+" : r.unread}
                      </span>
                    )}
                  </span>
                </span>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </Shell>
  );
}

function Shell({ children }: { children: React.ReactNode }) {
  return (
    <div className="mx-auto max-w-2xl px-4 py-8 sm:px-8 sm:py-12">
      <div className="flex items-center justify-between gap-4">
        <h1 className="text-[1.5rem] font-bold tracking-[-0.03em] text-ink">Messages</h1>
        {/* Padded, not just styled: the text alone is a 30x20 tap target, and
            this is a phone-first screen. The negative margin keeps the label
            optically flush with the edge the padding pushed it off. */}
        <Link
          href="/app"
          className="-mr-2 rounded-full px-2 py-1.5 text-[0.8125rem] font-semibold text-ink-mute hover:text-ink"
        >
          Back
        </Link>
      </div>
      {children}
    </div>
  );
}

function Avatar({ name, size = 40 }: { name: string; size?: number }) {
  let h = 0;
  for (let i = 0; i < name.length; i++) h = (h * 31 + name.charCodeAt(i)) % 360;
  return (
    <span
      aria-hidden="true"
      className="grid shrink-0 place-items-center rounded-full font-bold"
      style={{
        width: size, height: size, fontSize: size * 0.32,
        color: `hsl(${h} 42% 32%)`,
        background: `hsl(${h} 46% 93%)`,
        boxShadow: `inset 0 0 0 1px hsl(${h} 40% 82%)`,
      }}
    >
      {name.slice(0, 2).toUpperCase()}
    </span>
  );
}

function when(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  const mins = Math.floor((Date.now() - d.getTime()) / 60_000);
  if (mins < 1) return "now";
  if (mins < 60) return `${mins}m`;
  if (mins < 60 * 24) return `${Math.floor(mins / 60)}h`;
  return `${Math.floor(mins / 1440)}d`;
}
