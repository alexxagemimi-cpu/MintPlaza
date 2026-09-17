"use client";

import { useEffect, useState } from "react";
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
 */
export function SettingsButton({
  profile,
  levelUp,
}: {
  profile: SettingsProfile | null;
  levelUp: LevelUpStatus;
}) {
  const [open, setOpen] = useState(false);
  const params = useSearchParams();
  const router = useRouter();
  const pathname = usePathname();

  // ?settings=1 opens it, then the parameter is dropped from the URL. Leaving
  // it there would mean the back button reopens the panel, and a shared link
  // would open somebody else's settings screen at them.
  useEffect(() => {
    if (params.get("settings") !== "1") return;
    setOpen(true);
    router.replace(pathname, { scroll: false });
  }, [params, router, pathname]);

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
