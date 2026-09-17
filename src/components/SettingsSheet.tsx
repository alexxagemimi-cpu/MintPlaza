"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import Link from "next/link";
import { setDisplayName, setHidePresence, deleteAccount } from "@/lib/actions/account";

/**
 * Settings.
 *
 * Seven things, and nothing else. A settings screen fills with plausible
 * switches faster than any other screen in a product, and every one of them is
 * a thing somebody has to read past to reach the thing they came for — which,
 * nine times in ten, is signing out.
 *
 * So the test each row had to pass was: does a real person open this panel
 * wanting it? Log out, yes. Switch account, yes — one tablet, several
 * siblings. The name people see, the green dot, and the safety reminder they
 * dismissed too fast, yes. Leaving for good, yes, and it belongs here rather
 * than buried in an email to nobody. A theme picker, a notifications page with
 * nothing to notify, a language list with one language: no.
 *
 * The order is deliberate too. Who you are, then what people see, then the
 * ways out — least destructive first, and the irreversible one last, behind a
 * confirmation you have to type.
 */

export interface SettingsProfile {
  username: string;
  displayName: string | null;
  avatarUrl: string | null;
  robloxUserId: string;
  hidePresence: boolean;
  joinedAt?: string | null;
}

/**
 * Where the safety notice records that it was dismissed.
 *
 * Must stay identical to the key in SafetyNotice.tsx — two spellings of the
 * same idea would give a switch that says the reminder is back on while the
 * notice goes on reading the other key and staying hidden.
 */
const SAFETY_KEY = "mintplaza.safety.services.v1";

function Row({
  title, hint, children,
}: {
  title: string;
  hint?: string;
  children?: React.ReactNode;
}) {
  return (
    <div className="border-b border-line-soft px-4 py-3.5 last:border-b-0">
      <div className="flex items-center justify-between gap-3">
        <div className="min-w-0">
          <p className="text-[0.9375rem] font-semibold text-ink">{title}</p>
          {hint && (
            <p className="mt-0.5 text-[0.75rem] leading-relaxed text-ink-mute">{hint}</p>
          )}
        </div>
        {children}
      </div>
    </div>
  );
}

/** A switch that says what it is, out loud, to anything reading the page. */
function Toggle({
  on, busy, onChange, label,
}: {
  on: boolean; busy: boolean; onChange: (v: boolean) => void; label: string;
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={on}
      aria-label={label}
      disabled={busy}
      onClick={() => onChange(!on)}
      className={`relative h-[26px] w-[46px] shrink-0 rounded-full transition-colors disabled:opacity-50 ${
        on ? "bg-mint" : "bg-line"
      }`}
    >
      <span
        aria-hidden="true"
        className="absolute top-[3px] h-5 w-5 rounded-full bg-surface shadow-sm transition-[left]"
        style={{ left: on ? 23 : 3 }}
      />
    </button>
  );
}

export function SettingsSheet({
  profile, onClose,
}: {
  profile: SettingsProfile;
  onClose: () => void;
}) {
  const [name, setName] = useState(profile.displayName ?? "");
  const [savedName, setSavedName] = useState(profile.displayName ?? "");
  const [hidden, setHidden] = useState(profile.hidePresence);
  const [error, setError] = useState<string | null>(null);
  const [note, setNote] = useState<string | null>(null);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [typed, setTyped] = useState("");
  const [safetyHidden, setSafetyHidden] = useState(false);
  const [busy, start] = useTransition();
  const panel = useRef<HTMLDivElement>(null);

  // Escape closes it, and focus starts inside rather than wherever the page
  // left it — a panel that opens with focus behind it is a panel a keyboard
  // user has to hunt for.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", onKey);
    panel.current?.focus();
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  // Reading storage can throw outright in a locked-down browser, so the answer
  // is treated as unknown rather than letting the whole panel fail to render.
  useEffect(() => {
    try { setSafetyHidden(localStorage.getItem(SAFETY_KEY) === "hidden"); } catch { /* ignore */ }
  }, []);

  const dirty = name.trim() !== savedName.trim();

  function saveName() {
    setError(null); setNote(null);
    start(async () => {
      const result = await setDisplayName(name);
      if (!result.ok) { setError(result.error); return; }
      const saved = result.data ?? "";
      setSavedName(saved);
      setName(saved);
      setNote(saved ? "Saved." : "Cleared — people see your Roblox name.");
    });
  }

  function togglePresence(next: boolean) {
    setError(null); setNote(null);
    setHidden(next);            // shows at once
    start(async () => {
      const result = await setHidePresence(next);
      if (!result.ok) { setHidden(!next); setError(result.error); }  // and rolls back
    });
  }

  function bringBackSafety() {
    try { localStorage.removeItem(SAFETY_KEY); } catch { /* ignore */ }
    setSafetyHidden(false);
    setNote("It will show again next time you open a board.");
  }

  function remove() {
    setError(null);
    start(async () => {
      const result = await deleteAccount(typed);
      if (!result.ok) { setError(result.error); return; }
      // The profile is gone, but the session cookie is not — so leave through
      // the real sign-out route rather than just navigating away, or the next
      // page load is a signed-in user with nothing behind them.
      const form = document.createElement("form");
      form.method = "post";
      form.action = "/auth/signout";
      document.body.appendChild(form);
      form.submit();
    });
  }

  return (
    <div
      className="fixed inset-0 z-[80] grid place-items-end sm:place-items-center"
      role="dialog" aria-modal="true" aria-label="Settings"
    >
      <div aria-hidden="true" onClick={onClose} className="absolute inset-0 bg-ink/35" />

      <div
        ref={panel} tabIndex={-1}
        className="glass-overlay relative flex max-h-[90vh] w-full max-w-md flex-col overflow-hidden rounded-t-[var(--radius-panel)] outline-none sm:rounded-[var(--radius-panel)]"
      >
        {/* ---- who you are ---- */}
        <div className="flex shrink-0 items-center gap-3 border-b border-line-soft px-4 py-4">
          <span
            aria-hidden="true"
            className="grid h-12 w-12 shrink-0 place-items-center overflow-hidden rounded-full bg-fill font-bold text-ink-mute"
          >
            {profile.avatarUrl
              ? /* eslint-disable-next-line @next/next/no-img-element */
                <img src={profile.avatarUrl} alt="" className="h-full w-full object-cover" />
              : profile.username.slice(0, 2).toUpperCase()}
          </span>
          <div className="min-w-0 flex-1">
            <p className="truncate text-[1.0625rem] font-bold tracking-[-0.02em] text-ink">
              {savedName || profile.username}
            </p>
            <p className="truncate text-[0.75rem] text-ink-mute">
              {savedName ? `${profile.username} · ` : ""}Signed in with Roblox
            </p>
          </div>
          <button type="button" onClick={onClose} aria-label="Close settings"
            className="grid h-8 w-8 shrink-0 place-items-center rounded-full border border-line text-ink-mute">
            <svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor"
                 strokeWidth="2" strokeLinecap="round" aria-hidden="true">
              <path d="M4 4l8 8M12 4l-8 8" />
            </svg>
          </button>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto">
          {/* ---- what people see ---- */}
          <p className="px-4 pb-1.5 pt-4 font-mono text-[0.5625rem] font-medium tracking-[0.1em] text-ink-faint">
            WHAT PEOPLE SEE
          </p>
          <div className="mx-3 rounded-[14px] border border-line-soft bg-surface">
            <div className="border-b border-line-soft px-4 py-3.5">
              <p className="text-[0.9375rem] font-semibold text-ink">Display name</p>
              <p className="mt-0.5 text-[0.75rem] leading-relaxed text-ink-mute">
                Shown instead of your Roblox name, which is still shown beside
                it. You cannot take a name another player signs in under —
                otherwise anybody could wear a trusted trader&rsquo;s.
              </p>
              <div className="mt-2.5 flex items-center gap-2">
                <input
                  value={name}
                  onChange={(e) => { setName(e.target.value.slice(0, 24)); setNote(null); }}
                  placeholder={profile.username}
                  aria-label="Display name"
                  maxLength={24}
                  className="min-w-0 flex-1 rounded-[10px] border border-line bg-surface px-3 py-2 text-[0.9375rem] text-ink outline-none focus:border-mint"
                />
                <button
                  type="button" onClick={saveName} disabled={!dirty || busy}
                  className="pill pill-mint shrink-0 py-2 text-[0.8125rem] disabled:opacity-40"
                >
                  Save
                </button>
              </div>
            </div>

            <Row
              title="Appear offline"
              hint="Turns off your green dot everywhere, for everyone. You can still post, vote and message."
            >
              <Toggle on={hidden} busy={busy} onChange={togglePresence}
                      label="Appear offline" />
            </Row>
          </div>

          {/* ---- safety ---- */}
          <p className="px-4 pb-1.5 pt-5 font-mono text-[0.5625rem] font-medium tracking-[0.1em] text-ink-faint">
            SAFETY
          </p>
          <div className="mx-3 rounded-[14px] border border-line-soft bg-surface">
            <Row
              title="Show the recording reminder again"
              hint={
                safetyHidden
                  ? "You turned it off. It is the only warning you get before handing something over."
                  : "It is on. It appears the first time you open a board."
              }
            >
              {safetyHidden ? (
                <button type="button" onClick={bringBackSafety}
                        className="pill pill-ghost shrink-0 py-1.5 text-[0.8125rem]">
                  Turn on
                </button>
              ) : (
                <span className="shrink-0 font-mono text-[0.5625rem] tracking-[0.08em] text-mint">
                  ON
                </span>
              )}
            </Row>
            <Row title="What MintPlaza can see"
                 hint="Your username, avatar and account age. Never your inventory, and it can never act in a game as you." />
          </div>

          {/* ---- the ways out ---- */}
          <p className="px-4 pb-1.5 pt-5 font-mono text-[0.5625rem] font-medium tracking-[0.1em] text-ink-faint">
            THIS ACCOUNT
          </p>
          <div className="mx-3 rounded-[14px] border border-line-soft bg-surface">
            <div className="border-b border-line-soft px-4 py-3">
              <form id="mintplaza-signout" action="/auth/signout" method="post">
                <button type="submit" className="w-full text-left text-[0.9375rem] font-semibold text-ink">
                  Log out
                </button>
              </form>
            </div>
            <div className="px-4 py-3">
              {/* Same thing mechanically, different intent — and worth its own
                  row on a tablet several people share, where "log out" reads
                  as leaving and "switch" reads as handing it over. */}
              <form action="/auth/signout?next=/login" method="post">
                <button type="submit" className="w-full text-left">
                  <span className="block text-[0.9375rem] font-semibold text-ink">
                    Switch account
                  </span>
                  <span className="mt-0.5 block text-[0.75rem] text-ink-mute">
                    Signs out and goes back to Roblox sign-in.
                  </span>
                </button>
              </form>
            </div>
          </div>

          {/* ---- the one that cannot be undone ---- */}
          <p className="px-4 pb-1.5 pt-5 font-mono text-[0.5625rem] font-medium tracking-[0.1em] text-bad">
            LEAVING FOR GOOD
          </p>
          <div className="mx-3 rounded-[14px] border border-bad/25 bg-bad-wash">
            {!confirmDelete ? (
              <div className="px-4 py-3.5">
                <p className="text-[0.9375rem] font-semibold text-ink">Delete my account</p>
                <p className="mt-0.5 text-[0.75rem] leading-relaxed text-ink-mute">
                  Removes your profile, your posts, your votes and your contacts.
                  Your Roblox account is not touched — MintPlaza only ever had
                  your name and your picture.
                </p>
                <button type="button" onClick={() => setConfirmDelete(true)}
                        className="pill pill-ghost mt-2.5 py-1.5 text-[0.8125rem] text-bad">
                  Delete my account
                </button>
              </div>
            ) : (
              <div className="px-4 py-3.5">
                <p className="text-[0.9375rem] font-semibold text-ink">
                  Type <b>{profile.username}</b> to confirm
                </p>
                <p className="mt-0.5 text-[0.75rem] leading-relaxed text-ink-mute">
                  This cannot be undone, and pressing it again will not bring
                  anything back.
                </p>
                <input
                  value={typed}
                  onChange={(e) => setTyped(e.target.value)}
                  aria-label="Type your username to confirm deletion"
                  autoComplete="off"
                  className="mt-2.5 w-full rounded-[10px] border border-bad/30 bg-surface px-3 py-2 text-[0.9375rem] text-ink outline-none focus:border-bad"
                />
                <div className="mt-2.5 flex gap-2">
                  <button
                    type="button" onClick={remove}
                    disabled={busy || typed.trim().toLowerCase() !== profile.username.toLowerCase()}
                    className="pill flex-1 bg-bad py-2 text-[0.875rem] font-bold text-white disabled:opacity-40"
                  >
                    {busy ? "Deleting…" : "Delete for good"}
                  </button>
                  <button type="button" onClick={() => { setConfirmDelete(false); setTyped(""); }}
                          className="pill pill-ghost flex-1 py-2 text-[0.875rem]">
                    Keep it
                  </button>
                </div>
              </div>
            )}
          </div>

          {(error || note) && (
            <p role="alert"
               className={`mx-3 mt-3 rounded-[10px] px-3 py-2 text-[0.8125rem] ${
                 error ? "border border-bad/30 bg-bad-wash text-bad" : "bg-fill text-ink-mute"
               }`}>
              {error ?? note}
            </p>
          )}

          <MakerCard />

          <div className="flex items-center justify-center gap-4 px-4 pb-6 pt-5 text-[0.75rem] text-ink-faint">
            <Link href="/privacy" className="hover:text-ink">Privacy</Link>
            <span aria-hidden="true">·</span>
            <Link href="/terms" className="hover:text-ink">Terms</Link>
            <span aria-hidden="true">·</span>
            <Link href="/support" className="hover:text-ink">Tell us your problem</Link>
          </div>
        </div>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */

/**
 * Who made this.
 *
 * Every other card in here changes something. This one does not, and that is
 * the point: a site with a person's name on it reads differently from one
 * without, and a player deciding whether to trust a trading site with their
 * account is making exactly that judgement.
 *
 * The Instagram mark is inline SVG rather than an image from Instagram's
 * servers. A remote logo would mean every player who opens Settings quietly
 * makes a request to Meta carrying their IP and referrer, which is a real cost
 * for a decorative glyph. Drawn here it also inherits currentColor and works
 * in both themes.
 */
function MakerCard() {
  return (
    <div className="mx-3 mt-4 rounded-[var(--radius-inner)] border border-line bg-surface p-4">
      <p className="font-mono text-[0.5625rem] tracking-[0.1em] text-mint">
        MADE BY AN INNOVATIVE TEENAGER
      </p>
      <p className="mt-1.5 text-[0.9375rem] font-bold tracking-[-0.02em] text-ink">
        Albert Whitestroke <span className="font-semibold text-ink-mute">(Shashwat)</span>
      </p>
      <a
        href="https://instagram.com/alx22n"
        target="_blank"
        rel="noopener noreferrer"
        className="mt-2 inline-flex items-center gap-1.5 text-[0.8125rem] font-semibold text-ink-soft transition-colors hover:text-mint"
      >
        <svg
          width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor"
          strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"
          className="shrink-0" aria-hidden="true"
        >
          <rect x="2" y="2" width="20" height="20" rx="5.5" />
          <circle cx="12" cy="12" r="4.2" />
          <circle cx="17.6" cy="6.4" r="1.2" fill="currentColor" stroke="none" />
        </svg>
        @alx22n
      </a>
    </div>
  );
}
