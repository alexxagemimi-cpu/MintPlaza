"use client";

import { useMemo, useState } from "react";
import { useFindTemplate } from "./TemplateProvider";
import {
  agoLabel, shortLeft, suggestionMinutesLeft, MESSAGE_MAX,
  type Contact, type ContactSuggestion, type DirectMessage,
} from "@/lib/contacts";
import { ReportButton } from "./ReportButton";

/**
 * Contacts.
 *
 * Two things stacked, in the order they matter on the day you use them.
 *
 * At the top, the people you just played with, offered once. This is the whole
 * reason the tab exists: the moment a raid ends is the only moment anybody
 * remembers who was good to play with, and it is exactly the moment every
 * game makes you go and find them by hand. Twenty minutes later the memory is
 * gone and so is the group. So the question gets asked while it is still easy
 * to answer, and it is asked once — Add or No, then it never comes back.
 *
 * Underneath, the people you kept, and the conversation with each. Short
 * messages, because this is "which server are you in", not a chat client.
 *
 * There is deliberately no way to add somebody you have not played with. See
 * lib/contacts.ts for why that is the feature rather than a gap.
 */

function Face({ name, url, size = 40, online }: {
  name: string; url?: string; size?: number; online?: boolean;
}) {
  let h = 0;
  for (let i = 0; i < name.length; i++) h = (h * 31 + name.charCodeAt(i)) % 360;
  return (
    <span className="relative inline-block shrink-0" style={{ width: size, height: size }}>
      <span
        aria-hidden="true"
        className="grid h-full w-full place-items-center overflow-hidden rounded-full font-bold"
        style={{
          fontSize: size * 0.34,
          color: `hsl(${h} 42% 30%)`, background: `hsl(${h} 46% 92%)`,
        }}
      >
        {url
          ? /* eslint-disable-next-line @next/next/no-img-element */
            <img src={url} alt="" className="h-full w-full object-cover" />
          : name.slice(0, 2).toUpperCase()}
      </span>
      {online && (
        <span
          aria-label="On MintPlaza right now"
          title="On MintPlaza right now"
          className="absolute -bottom-px -right-px h-[10px] w-[10px] rounded-full border-2 border-surface bg-mint"
        />
      )}
    </span>
  );
}

/* ------------------------------------------------------------------ */

/**
 * One person offered after a deal.
 *
 * Says what you did together and who else was there, because "add
 * quietdough?" is a question nobody can answer and "quietdough, from the
 * Leviathan hunt with three others, 20 minutes ago" is a question anybody can.
 */
function SuggestionCard({
  suggestion, onAdd, onDeny,
}: {
  suggestion: ContactSuggestion;
  onAdd: (id: string) => void;
  onDeny: (id: string) => void;
}) {
  const findTemplate = useFindTemplate();
  const service = findTemplate(suggestion.serviceId);
  const left = suggestionMinutesLeft(suggestion);
  const others = suggestion.alongside;

  return (
    <li className="glass rounded-[var(--radius-inner)] p-3.5">
      <div className="flex items-start gap-3">
        <Face name={suggestion.person.username} url={suggestion.person.avatarUrl}
              online={suggestion.person.online} size={40} />
        <div className="min-w-0 flex-1">
          <p className="truncate text-[0.9375rem] font-bold tracking-[-0.015em] text-ink">
            {suggestion.person.username}
          </p>
          <p className="mt-0.5 text-[0.8125rem] leading-relaxed text-ink-mute">
            {service?.name ?? "A deal"} · {agoLabel(suggestion.metMinutesAgo)} ago
          </p>
          {others.length > 0 && (
            <p className="mt-1 text-[0.75rem] leading-relaxed text-ink-faint">
              With {others.slice(0, 3).join(", ")}
              {others.length > 3 && ` and ${others.length - 3} more`}
            </p>
          )}
        </div>
        <span className="shrink-0 font-mono text-[0.5625rem] tabular-nums text-ink-faint">
          {shortLeft(left)}
        </span>
      </div>

      <div className="mt-3 flex items-center gap-2">
        <button type="button" onClick={() => onAdd(suggestion.id)}
                className="pill pill-mint flex-1 py-2 text-[0.875rem]">
          Add
        </button>
        <button type="button" onClick={() => onDeny(suggestion.id)}
                className="pill pill-ghost flex-1 py-2 text-[0.875rem]">
          No
        </button>
        <ReportButton
          what="player"
          subject={suggestion.person.username}
          subjectId={suggestion.id}
          compact
        />
      </div>
    </li>
  );
}

/* ------------------------------------------------------------------ */

/** The conversation with one contact. */
function Thread({
  contact, messages, onClose,
}: {
  contact: Contact;
  messages: readonly DirectMessage[];
  onClose: () => void;
}) {
  const [sent, setSent] = useState<DirectMessage[]>([]);
  const [draft, setDraft] = useState("");
  const findTemplate = useFindTemplate();
  const service = findTemplate(contact.metServiceId);
  const all = [...messages, ...sent];

  function send() {
    const text = draft.trim();
    if (!text) return;
    setSent((prev) => [...prev, {
      id: `local-${Date.now()}`, mine: true, text, minutesAgo: 0,
    }]);
    setDraft("");
  }

  return (
    <div className="fixed inset-0 z-[70] grid place-items-end sm:place-items-center"
         role="dialog" aria-modal="true" aria-label={`Messages with ${contact.person.username}`}>
      <div aria-hidden="true" onClick={onClose} className="absolute inset-0 bg-ink/30" />

      <div className="glass-overlay relative flex h-[86vh] w-full max-w-md flex-col rounded-t-[var(--radius-panel)] sm:h-[70vh] sm:rounded-[var(--radius-panel)]">
        <div className="flex shrink-0 items-center gap-3 border-b border-line-soft px-4 py-3">
          <Face name={contact.person.username} url={contact.person.avatarUrl}
                online={contact.person.online} size={34} />
          <div className="min-w-0 flex-1">
            <p className="truncate text-[0.9375rem] font-bold text-ink">
              {contact.person.username}
            </p>
            <p className="truncate text-[0.6875rem] text-ink-faint">
              Met on {service?.name ?? "a deal"}
            </p>
          </div>
          <ReportButton what="player" subject={contact.person.username}
                        subjectId={contact.id} compact />
          <button type="button" onClick={onClose} aria-label="Close"
            className="grid h-8 w-8 shrink-0 place-items-center rounded-full border border-line text-ink-mute">
            <svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor"
                 strokeWidth="2" strokeLinecap="round" aria-hidden="true">
              <path d="M4 4l8 8M12 4l-8 8" />
            </svg>
          </button>
        </div>

        <div className="min-h-0 flex-1 space-y-2 overflow-y-auto p-4">
          {all.length === 0 && (
            <p className="py-10 text-center text-[0.875rem] leading-relaxed text-ink-mute">
              Nothing here yet. Say when you are next on.
            </p>
          )}
          {all.map((m) => (
            <div key={m.id} className={`flex ${m.mine ? "justify-end" : "justify-start"}`}>
              <span
                className={`max-w-[78%] rounded-[16px] px-3.5 py-2 text-[0.875rem] leading-relaxed ${
                  m.mine
                    ? "bg-mint text-ink"
                    : "border border-line-soft bg-surface text-ink-soft"
                }`}
              >
                {m.text}
              </span>
            </div>
          ))}
        </div>

        <div className="shrink-0 border-t border-line-soft p-3">
          <div className="flex items-center gap-2">
            <input
              value={draft}
              onChange={(e) => setDraft(e.target.value.slice(0, MESSAGE_MAX))}
              onKeyDown={(e) => { if (e.key === "Enter") send(); }}
              placeholder="Say when you are on…"
              aria-label={`Message ${contact.person.username}`}
              className="min-w-0 flex-1 rounded-full border border-line bg-surface px-3.5 py-2.5 text-[0.9375rem] text-ink outline-none focus:border-mint"
            />
            <button type="button" onClick={send} disabled={!draft.trim()}
                    className="pill pill-mint shrink-0 py-2.5 text-[0.8125rem] disabled:opacity-40">
              Send
            </button>
          </div>
          <p className="mt-2 text-[0.6875rem] leading-relaxed text-ink-faint">
            Never send a password, a cookie, or a link asking you to sign in.
            Nobody here needs any of those, and anybody asking is worth reporting.
          </p>
        </div>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */

export function Contacts({
  gameName, suggestions: incoming, contacts: initial, threads,
}: {
  gameName: string;
  suggestions: readonly ContactSuggestion[];
  contacts: readonly Contact[];
  /**
   * Conversations keyed by contact id. Plain data rather than a lookup
   * function, because a function cannot cross from a server component into a
   * client one — it would serialise to nothing and fail at runtime.
   */
  threads: Record<string, readonly DirectMessage[]>;
}) {
  const [answered, setAnswered] = useState<Record<string, "added" | "denied">>({});
  const [added, setAdded] = useState<Contact[]>([]);
  const [open, setOpen] = useState<string | null>(null);
  const findTemplate = useFindTemplate();

  const pending = useMemo(
    () => incoming.filter((s) => !answered[s.id] && suggestionMinutesLeft(s) > 0),
    [incoming, answered],
  );
  const contacts = useMemo(() => [...added, ...initial], [added, initial]);
  const openContact = contacts.find((c) => c.id === open);

  function add(id: string) {
    const s = incoming.find((x) => x.id === id);
    setAnswered((prev) => ({ ...prev, [id]: "added" }));
    if (!s) return;
    setAdded((prev) => [{
      id: `added-${s.id}`,
      person: s.person,
      metServiceId: s.serviceId,
      metDaysAgo: 0,
      unread: 0,
      isDemo: s.isDemo,
    }, ...prev]);
  }

  return (
    <div className="mx-auto max-w-4xl px-4 pb-24 pt-8 sm:px-8 sm:pt-12">
      <p className="label">{gameName}</p>
      <h1 className="mt-0.5 text-[1.5rem] font-extrabold tracking-[-0.035em] text-ink">
        Contacts
      </h1>
      <p className="mt-2 max-w-[62ch] text-[0.9375rem] leading-relaxed text-ink-soft">
        The people you have actually played with. There is no way to add a
        stranger here on purpose — finishing something together is the only
        introduction, which is what keeps this from becoming a place people get
        messaged by anyone who fancies it.
      </p>

      {/* ---- offered once, then gone ---- */}
      {pending.length > 0 && (
        <section className="mt-7">
          <div className="mb-1 flex items-baseline justify-between gap-3">
            <h2 className="text-[1.0625rem] font-bold tracking-[-0.025em] text-ink">
              Add these to contacts?
            </h2>
            <span className="font-mono text-[0.5625rem] tracking-[0.08em] text-ink-faint">
              {pending.length} WAITING
            </span>
          </div>
          <p className="mb-3 max-w-[62ch] text-[0.8125rem] leading-relaxed text-ink-mute">
            From deals you just finished. These clear themselves when the deal
            does — each one shows how long it has left. Saying no is permanent,
            and they are never offered again.
          </p>
          <ul className="grid gap-2">
            {pending.map((s) => (
              <SuggestionCard key={s.id} suggestion={s} onAdd={add}
                onDeny={(id) => setAnswered((p) => ({ ...p, [id]: "denied" }))} />
            ))}
          </ul>
        </section>
      )}

      {/* ---- the people you kept ---- */}
      <section className="mt-7">
        <h2 className="mb-3 text-[1.0625rem] font-bold tracking-[-0.025em] text-ink">
          Your contacts
        </h2>

        {contacts.length === 0 ? (
          <div className="glass-quiet rounded-[var(--radius-panel)] px-6 py-14 text-center">
            <p className="text-[1.0625rem] font-bold tracking-[-0.02em] text-ink">
              Nobody yet
            </p>
            <p className="mx-auto mt-1.5 max-w-[40ch] text-[0.9375rem] leading-relaxed text-ink-mute">
              Finish a raid or a trade with somebody and they will be offered
              here straight afterwards, while you still remember how it went.
            </p>
          </div>
        ) : (
          <ul className="grid gap-2">
            {contacts.map((c) => {
              const service = findTemplate(c.metServiceId);
              return (
                <li key={c.id}>
                  <button
                    type="button" onClick={() => setOpen(c.id)}
                    className="glass flex w-full items-center gap-3 rounded-[var(--radius-inner)] p-3 text-left transition-colors hover:border-mint"
                  >
                    <Face name={c.person.username} url={c.person.avatarUrl}
                          online={c.person.online} size={40} />
                    <span className="min-w-0 flex-1">
                      <span className="flex items-center gap-2">
                        <span className="min-w-0 truncate text-[0.9375rem] font-bold tracking-[-0.015em] text-ink">
                          {c.person.username}
                        </span>
                        {c.unread > 0 && (
                          <span className="grid h-[17px] min-w-[17px] shrink-0 place-items-center rounded-full bg-mint px-1 font-mono text-[0.5625rem] font-bold text-ink">
                            {c.unread}
                          </span>
                        )}
                      </span>
                      <span className="mt-0.5 block truncate text-[0.8125rem] text-ink-mute">
                        {c.lastMessage ?? `Met on ${service?.name ?? "a deal"}`}
                      </span>
                    </span>
                    {c.lastMessageMinutesAgo !== undefined && (
                      <span className="shrink-0 font-mono text-[0.5625rem] text-ink-faint">
                        {agoLabel(c.lastMessageMinutesAgo)}
                      </span>
                    )}
                  </button>
                </li>
              );
            })}
          </ul>
        )}
      </section>

      {openContact && (
        <Thread
          contact={openContact}
          messages={threads[openContact.id] ?? []}
          onClose={() => setOpen(null)}
        />
      )}
    </div>
  );
}
