"use client";

import { useEffect, useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  windowLabel, WINDOW_CHOICES, VOTE_CAP_CHOICES, MAX_TEAM,
  RECRUIT_WINDOW_MINUTES, LIVE_WINDOW_MINUTES,
  type Section, type Service, type ListingSide,
} from "@/lib/sessions";
import { postListing } from "@/lib/actions/board";
import { RefTile } from "./RefTile";
import { useTemplatesFor } from "./TemplateProvider";
import { ServiceArt } from "./ServiceArt";
import { ConsoleShortcut } from "@/components/ConsoleShortcut";

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

/**
 * The two sides of a favour.
 *
 * Only the services board has them. On the recruitment board every post is one
 * direction — you are starting a crew — because the other direction does not
 * describe anything anybody can act on: "I am free to join something" with no
 * raid attached is a post with no answer to it. People join by voting on a
 * real crew call instead.
 */
const SIDES: { id: ListingSide; label: string; blurb: string }[] = [
  { id: "request", label: "I need help", blurb: "You are stuck on one thing." },
  { id: "offer", label: "I can help", blurb: "You have time, and can run several." },
];

export function PostListing({
  gameSlug, gameName, section = "services", preselect, onClose,
}: {
  gameSlug: string;
  gameName: string;
  /** Which board this post is going on. Decides the wording and the clock. */
  section?: Section;
  /**
   * A template chosen before the form opened, from tapping one in the
   * reference list. Saves the one step that made those cards look decorative.
   */
  preselect?: string;
  onClose: () => void;
}) {
  const all = useTemplatesFor(gameSlug, section);
  const recruiting = section === "recruit";
  const [side, setSide] = useState<ListingSide>("request");

  const [picked, setPicked] = useState<string[]>(preselect ? [preselect] : []);
  const [refId, setRefId] = useState<string>("");
  const [detail, setDetail] = useState("");
  const [terms, setTerms] = useState<"free" | "split">("free");

  // The three limits the poster sets. Defaults are the board's old fixed
  // behaviour, so somebody who changes nothing gets exactly what they got
  // before and never has to think about any of this.
  const [windowMinutes, setWindowMinutes] = useState<number>(
    section === "recruit" ? RECRUIT_WINDOW_MINUTES : LIVE_WINDOW_MINUTES,
  );
  const [voteCap, setVoteCap] = useState<number | null>(null);
  const [slots, setSlots] = useState<number | null>(null);
  const [query, setQuery] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, start] = useTransition();
  const router = useRouter();

  // A request is about one thing. An offer can advertise several. A crew
  // call is always one thing — you are sailing for the Leviathan or you are not.
  const many = !recruiting && side === "offer";
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
        windowMinutes,
        voteCap,
        slots,
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
                {recruiting ? `Start a crew · ${gameName}` : `Post to ${gameName}`}
              </h2>
              <p className="mt-0.5 text-[0.8125rem] text-ink-mute">
                {recruiting
                  ? "Stays up for forty minutes, then disappears."
                  : "Stays up for two hours, then disappears."}
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
          {/* ---- which way round: services only ---- */}
          {!recruiting && (
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
          )}

          {/* ---- what it is about ---- */}
          <p className="mb-2 mt-4 font-mono text-[0.5625rem] font-medium tracking-[0.1em] text-ink-faint">
            {recruiting
              ? "WHAT NEEDS A TEAM?"
              : many ? "WHAT CAN YOU RUN?" : "WHAT ARE YOU STUCK ON?"}
          </p>
          <input
            value={query} onChange={(e) => setQuery(e.target.value)}
            placeholder="Search" aria-label="Search what you can get help with"
            className="mb-2 w-full rounded-[10px] border border-line bg-surface px-3 py-2.5 text-[0.9375rem] text-ink outline-none focus:border-mint"
          />
          <ConsoleShortcut query={query} />
          {/* Picture, name, crew size. Nothing else.
              The game's requirement used to sit under every row here, and it
              turned choosing between twenty things into reading twenty
              paragraphs — the requirement matters once you have posted, not
              while you are still scanning for the right one. It is still on the
              listing itself, where somebody deciding whether to join needs it. */}
          <ul className="grid gap-1.5">
            {shown.map((s) => {
              const on = picked.includes(s.id);
              return (
                <li key={s.id}>
                  <button
                    type="button" onClick={() => toggle(s.id)} aria-pressed={on}
                    className={`flex w-full items-center gap-2.5 rounded-[12px] border p-2 text-left transition-colors ${
                      on ? "border-mint bg-mint-wash" : "border-line-soft bg-surface"
                    }`}
                  >
                    <ServiceArt service={s} size={40} rounded={10} />
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-[0.875rem] font-bold text-ink">
                        {s.name}
                      </span>
                      <span className="mt-0.5 block font-mono text-[0.5rem] tracking-[0.08em] text-ink-faint">
                        {s.kind.toUpperCase()}
                        {s.players ? ` · ${s.players} PLAYERS` : ""}
                      </span>
                    </span>
                    {on && (
                      <span aria-hidden="true" className="shrink-0 text-mint">
                        <svg width="16" height="16" viewBox="0 0 16 16" fill="none"
                             stroke="currentColor" strokeWidth="2.2" strokeLinecap="round"
                             strokeLinejoin="round">
                          <path d="m3.5 8.5 3 3 6-6.5" />
                        </svg>
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

          {/* ---- your limits ----

              Three questions the site used to answer on the poster's behalf,
              and got wrong in both directions: cutting short somebody who was
              on all evening, and leaving a crew call up long after the crew
              sailed. Trades never see this block — a trade is one person to one
              person, so there is no voting to cap and no team to size. */}
          <p className="mb-1 mt-4 font-mono text-[0.5625rem] font-medium tracking-[0.1em] text-ink-faint">
            YOUR LIMITS
          </p>
          <p className="mb-2 text-[0.75rem] leading-relaxed text-ink-mute">
            Leave these alone and you get the usual. Change them if you know
            better — you do.
          </p>

          <p className="mb-1.5 text-[0.8125rem] font-semibold text-ink">
            Keep it up for
          </p>
          <div className="mb-3 flex flex-wrap gap-1.5">
            {WINDOW_CHOICES[section].map((mins) => (
              <button
                key={mins} type="button" onClick={() => setWindowMinutes(mins)}
                aria-pressed={windowMinutes === mins}
                className={`rounded-full border px-3 py-1.5 text-[0.8125rem] font-semibold transition-colors ${
                  windowMinutes === mins
                    ? "border-mint bg-mint-wash text-ink"
                    : "border-line bg-surface text-ink-mute"
                }`}
              >
                {windowLabel(mins)}
              </button>
            ))}
          </div>

          <p className="mb-1.5 text-[0.8125rem] font-semibold text-ink">
            Let at most this many vote
          </p>
          <div className="mb-3 flex flex-wrap gap-1.5">
            {VOTE_CAP_CHOICES.map((cap) => (
              <button
                key={String(cap)} type="button" onClick={() => setVoteCap(cap)}
                aria-pressed={voteCap === cap}
                className={`rounded-full border px-3 py-1.5 text-[0.8125rem] font-semibold transition-colors ${
                  voteCap === cap
                    ? "border-mint bg-mint-wash text-ink"
                    : "border-line bg-surface text-ink-mute"
                }`}
              >
                {cap === null ? "No limit" : cap}
              </button>
            ))}
          </div>

          <p className="mb-1 text-[0.8125rem] font-semibold text-ink">
            How many will you pick?
          </p>
          <p className="mb-2 text-[0.75rem] leading-relaxed text-ink-mute">
            Shown on your post. &ldquo;12 voted&rdquo; means something very
            different when you are taking ten than when you are taking one, and
            people deserve to know which before they wait.
          </p>
          <div className="mb-1 flex flex-wrap gap-1.5">
            {([null, 1, 2, 3, 4, 5, 6, 8, 10] as (number | null)[])
              .filter((n) => n === null || n <= MAX_TEAM)
              .map((n) => (
                <button
                  key={String(n)} type="button" onClick={() => setSlots(n)}
                  aria-pressed={slots === n}
                  className={`rounded-full border px-3 py-1.5 text-[0.8125rem] font-semibold transition-colors ${
                    slots === n
                      ? "border-mint bg-mint-wash text-ink"
                      : "border-line bg-surface text-ink-mute"
                  }`}
                >
                  {n === null ? "Not sure yet" : n}
                </button>
              ))}
          </div>

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
