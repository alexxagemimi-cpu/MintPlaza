"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { usePathname } from "next/navigation";
import {
  dismissAnnouncement,
  readAnnouncement,
  type LiveAnnouncement,
} from "@/lib/actions/announcement";

/**
 * The owner's announcement, over the page, once.
 *
 * ---------------------------------------------------------------------------
 * Two buttons, because they mean two different things
 * ---------------------------------------------------------------------------
 *
 * "Okay" is "I have read it" — it closes for this visit and comes back next
 * time, which is what you want for something that is up for five days and
 * matters. "Don't show again" is a decision about this announcement forever,
 * so it is recorded against the account and follows the player to their phone.
 *
 * A signed-out visitor has no account to record it against, so the same choice
 * is kept in localStorage. That is the fallback and not the mechanism: for
 * anybody signed in, the row in the database is what decides.
 *
 * ---------------------------------------------------------------------------
 * Why it asks the server as late as it does
 * ---------------------------------------------------------------------------
 *
 * Storage is checked before anything is fetched. Somebody who has already put
 * this away is answered by their own browser and costs no request at all, and
 * the home page stays prerendered because nothing is read while it renders.
 *
 * Every storage call is wrapped: in a private window, or with site data
 * blocked, these throw rather than returning empty. A thrown read here must
 * mean "show it" and never "break the page".
 */

/** Read it, close it, see it again next visit. */
const seenKey = (id: string) => `mp_ann_seen_${id}`;
/** Never show me this one again. */
const hiddenKey = (id: string) => `mp_ann_hidden_${id}`;

function stored(store: "local" | "session", key: string): boolean {
  try {
    const s = store === "local" ? window.localStorage : window.sessionStorage;
    return s.getItem(key) !== null;
  } catch {
    return false;
  }
}

function remember(store: "local" | "session", key: string) {
  try {
    const s = store === "local" ? window.localStorage : window.sessionStorage;
    s.setItem(key, "1");
  } catch {
    // Private window, or site data blocked. The announcement will appear again,
    // which is a nuisance and not a fault.
  }
}

/**
 * Screens this never covers.
 *
 * The panel, because the owner posting the announcement should not have to
 * close their own work to see it. The legal documents, because they are opened
 * deliberately — usually from the consent box on the way in — and a popup over
 * the terms somebody was told to read is the wrong thing to do.
 */
const QUIET = ["/admin", "/terms", "/privacy", "/refunds"];

export function AnnouncementGate() {
  const pathname = usePathname();
  const [ann, setAnn] = useState<LiveAnnouncement | null>(null);
  const [mediaBroken, setMediaBroken] = useState(false);
  const closeRef = useRef<HTMLButtonElement | null>(null);
  const returnTo = useRef<Element | null>(null);

  const quiet = QUIET.some((p) => pathname === p || pathname.startsWith(p + "/"));

  useEffect(() => {
    if (quiet) return;
    let cancelled = false;

    (async () => {
      try {
        const found = await readAnnouncement();
        if (cancelled || !found) return;
        if (stored("local", hiddenKey(found.id))) return;
        if (stored("session", seenKey(found.id))) return;
        setAnn(found);
      } catch {
        // An announcement is the least important thing on the page.
      }
    })();

    return () => { cancelled = true; };
  }, [quiet]);

  const close = useCallback(() => {
    setAnn((current) => {
      if (current) remember("session", seenKey(current.id));
      return null;
    });
  }, []);

  const never = useCallback(() => {
    setAnn((current) => {
      if (current) {
        remember("local", hiddenKey(current.id));
        // Signed out this is a no-op on the server and localStorage above is
        // what holds. Failure is not worth reporting: the choice is already
        // kept on this device.
        void dismissAnnouncement(current.id).catch(() => {});
      }
      return null;
    });
  }, []);

  // Escape closes, focus moves in and comes back, and the page behind does not
  // scroll while this is up.
  useEffect(() => {
    if (!ann) return;
    returnTo.current = document.activeElement;
    closeRef.current?.focus();

    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") close(); };
    document.addEventListener("keydown", onKey);

    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = previous;
      (returnTo.current as HTMLElement | null)?.focus?.();
    };
  }, [ann, close]);

  if (!ann) return null;

  return (
    <div
      className="fixed inset-0 z-[70] grid place-items-center overflow-y-auto bg-bg/95 p-4 backdrop-blur"
      // The backdrop closes, the same as Okay. The handler is on the backdrop
      // itself rather than on every click inside it.
      onClick={(e) => { if (e.target === e.currentTarget) close(); }}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="announcement-title"
        className="glass w-full max-w-lg rounded-[var(--radius-panel)] p-6 sm:p-8"
      >
        <p className="label">Announcement</p>

        <h2
          id="announcement-title"
          className="mt-2 text-[1.5rem] font-extrabold leading-tight tracking-[-0.03em] text-mint sm:text-[1.75rem]"
        >
          {ann.title}
        </h2>

        {/* Plain text, rendered as text. Nothing the owner types is ever
            treated as markup — an announcement is the one place on this site
            where one person's words reach every visitor. */}
        <p className="mt-3 whitespace-pre-wrap text-[0.9375rem] leading-relaxed text-ink">
          {ann.body}
        </p>

        {ann.mediaUrl && !mediaBroken && (
          <div className="mt-5 overflow-hidden rounded-[var(--radius-inner)] border border-line bg-fill">
            {ann.mediaKind === "video" ? (
              <video
                src={ann.mediaUrl}
                controls
                playsInline
                preload="metadata"
                onError={() => setMediaBroken(true)}
                className="block max-h-[45vh] w-full"
              />
            ) : (
              // eslint-disable-next-line @next/next/no-img-element -- a remote
              // URL the owner pastes; next/image would need an allowlist of
              // every host they might ever use.
              <img
                src={ann.mediaUrl}
                alt=""
                onError={() => setMediaBroken(true)}
                className="block max-h-[45vh] w-full object-contain"
              />
            )}
          </div>
        )}

        <div className="mt-6 flex flex-col-reverse gap-2 sm:flex-row sm:items-center">
          <button
            type="button"
            onClick={never}
            className="pill pill-ghost flex-1 justify-center py-3 text-[0.875rem]"
          >
            Don&rsquo;t show again
          </button>
          <button
            ref={closeRef}
            type="button"
            onClick={close}
            className="pill pill-mint flex-1 justify-center py-3 text-[0.9375rem]"
          >
            Okay
          </button>
        </div>
      </div>
    </div>
  );
}
