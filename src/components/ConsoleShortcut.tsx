"use client";

import { useEffect, useState } from "react";
import { searchShortcuts, type Shortcut } from "@/lib/admin/search";

/**
 * The one way into the control panel.
 *
 * ---------------------------------------------------------------------------
 * Why this is a component and not three copies of a card
 * ---------------------------------------------------------------------------
 *
 * The panel has no link in the interface. Typing one exact phrase into a
 * search box is how the owner reaches it — and "a search box" has to mean any
 * of them, because the owner does not know which screen they will be on when
 * they need it. It used to live in the Explore catalogue only, which meant the
 * door existed on one screen out of three and the other two silently did
 * nothing.
 *
 * So it is a component, dropped into every player-facing search box. Adding a
 * fourth search box later means one import, not a re-implementation that drifts
 * from this one.
 *
 * ---------------------------------------------------------------------------
 * What this component knows, which is nothing
 * ---------------------------------------------------------------------------
 *
 * It does not know the phrase, does not test it, and cannot. It sends whatever
 * was typed to the server on every search — the same request for "dragon" as
 * for the phrase — and renders whatever list comes back. For every account but
 * the owner's that list is empty, always, so there is nothing here to read and
 * nothing in the bundle to try. See src/lib/admin/search.ts.
 *
 * Rendered ABOVE the results, deliberately. It is a place, not a match, and a
 * place buried under 4,959 pets is a place nobody finds.
 */
export function ConsoleShortcut({ query }: { query: string }) {
  const [shortcuts, setShortcuts] = useState<Shortcut[]>([]);

  useEffect(() => {
    let cancelled = false;
    // Debounced so ordinary typing does not send a request per keystroke.
    const t = setTimeout(() => {
      searchShortcuts(query)
        .then((found) => { if (!cancelled) setShortcuts(found); })
        .catch(() => { if (!cancelled) setShortcuts([]); });
    }, 250);
    return () => { cancelled = true; clearTimeout(t); };
  }, [query]);

  return (
    <>
      {shortcuts.map((s) => (
        <a key={s.href} href={s.href}
           className="mt-3 flex items-center gap-3 rounded-[var(--radius-inner)] border border-mint bg-mint-wash px-3.5 py-3 transition-colors hover:border-ink">
          <span className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-surface text-mint">
            <svg width="16" height="16" viewBox="0 0 20 20" fill="none" stroke="currentColor"
                 strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <path d="M10 2.5 3.5 5.2v4.4c0 3.4 2.6 6.6 6.5 7.9 3.9-1.3 6.5-4.5 6.5-7.9V5.2Z" />
              <path d="m7.6 10 1.7 1.7 3.3-3.4" />
            </svg>
          </span>
          <span className="min-w-0 flex-1">
            <span className="block text-[0.9375rem] font-bold tracking-[-0.015em] text-ink">
              {s.title}
            </span>
            <span className="block text-[0.8125rem] text-ink-soft">{s.body}</span>
          </span>
          <svg width="15" height="15" viewBox="0 0 16 16" fill="none" stroke="currentColor"
               strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"
               className="shrink-0 text-ink-faint" aria-hidden="true">
            <path d="M6 3.5 10.5 8 6 12.5" />
          </svg>
        </a>
      ))}
    </>
  );
}
