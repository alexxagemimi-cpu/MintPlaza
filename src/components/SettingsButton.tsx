"use client";

import { Suspense, useEffect, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { SettingsSheet, type SettingsProfile } from "./SettingsSheet";
import type { LevelUpStatus } from "@/lib/level-up";

/**
 * The gear in the corner of the dashboard.
 *
 * A button rather than a link to a page, because everything behind it is a
 * decision about the screen you are already on — losing your place to a
 * separate page and then having to find your way back is the wrong shape for
 * "log me out".
 *
 * Signed out, it is a plain link to sign in instead. A gear that opens a panel
 * of controls that cannot do anything is worse than no gear.
 *
 * ---------------------------------------------------------------------------
 * Why ?settings=1 is handled by a child behind Suspense
 * ---------------------------------------------------------------------------
 *
 * useSearchParams() opts the whole tree above it out of static rendering, and
 * Next refuses to prerender a page that reaches it without a Suspense boundary
 * in between. The dashboard is normally dynamic, so the hook sat directly in
 * this component for a long time without complaint -- right up until the page
 * became prerenderable, at which point the build failed on a page nobody had
 * touched.
 *
 * It is prerenderable whenever Supabase is not configured, which is exactly
 * the state src/lib/supabase/config.ts promises to support. So the boundary
 * lives here rather than at the call site: a consumer cannot forget it, and
 * the gear still renders while the query string is being read.
 */
export function SettingsButton({
  profile,
  levelUp,
}: {
  profile: SettingsProfile | null;
  levelUp: LevelUpStatus;
}) {
  const [open, setOpen] = useState(false);

  const gear = (
    <svg width="18" height="18" viewBox="0 0 20 20" fill="none" stroke="currentColor"
         strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <circle cx="10" cy="10" r="2.6" />
      <path d="M16.2 12.2a1.4 1.4 0 0 0 .3 1.5l.1.1a1.6 1.6 0 1 1-2.3 2.3l-.1-.1a1.4 1.4 0 0 0-2.4 1v.2a1.6 1.6 0 1 1-3.2 0v-.1a1.4 1.4 0 0 0-2.4-1l-.1.1a1.6 1.6 0 1 1-2.3-2.3l.1-.1a1.4 1.4 0 0 0-1-2.4H2.8a1.6 1.6 0 1 1 0-3.2h.1a1.4 1.4 0 0 0 1-2.4l-.1-.1a1.6 1.6 0 1 1 2.3-2.3l.1.1a1.4 1.4 0 0 0 2.4-1V2.8a1.6 1.6 0 1 1 3.2 0v.1a1.4 1.4 0 0 0 2.4 1l.1-.1a1.6 1.6 0 1 1 2.3 2.3l-.1.1a1.4 1.4 0 0 0 1 2.4h.2a1.6 1.6 0 1 1 0 3.2h-.1a1.4 1.4 0 0 0-1.3.8Z" />
    </svg>
  );

  if (!profile) {
    return (
      <Link
        href="/login"
        aria-label="Sign in"
        title="Sign in"
        className="glass-quiet grid h-10 w-10 place-items-center rounded-full text-ink-soft transition-colors hover:text-ink"
      >
        {gear}
      </Link>
    );
  }

  return (
    <>
      <Suspense fallback={null}>
        <OpenOnSettingsParam onOpen={setOpen} />
      </Suspense>
      <button
        type="button"
        onClick={() => setOpen(true)}
        aria-label="Settings"
        aria-haspopup="dialog"
        aria-expanded={open}
        title="Settings"
        className="glass-quiet grid h-10 w-10 place-items-center rounded-full text-ink-soft transition-colors hover:text-ink"
      >
        {gear}
      </button>
      {open && (
        <SettingsSheet profile={profile} levelUp={levelUp} onClose={() => setOpen(false)} />
      )}
    </>
  );
}

/**
 * Reads ?settings=1, opens the panel, and drops the parameter from the URL.
 *
 * Renders nothing. It exists only so the useSearchParams() call sits under a
 * Suspense boundary instead of above one.
 *
 * Dropping the parameter is the point of the replace: left in place, the back
 * button would reopen the panel, and a shared link would open somebody else's
 * settings screen at them.
 *
 * onOpen is a useState setter, which React keeps stable across renders, so it
 * is safe in the dependency list -- an inline closure there would re-run this
 * effect on every render and fight the replace it just performed.
 */
function OpenOnSettingsParam({ onOpen }: { onOpen: (open: boolean) => void }) {
  const params = useSearchParams();
  const router = useRouter();
  const pathname = usePathname();

  useEffect(() => {
    if (params.get("settings") !== "1") return;
    onOpen(true);
    router.replace(pathname, { scroll: false });
  }, [params, router, pathname, onOpen]);

  return null;
}
