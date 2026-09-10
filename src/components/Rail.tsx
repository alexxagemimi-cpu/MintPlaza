"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { DEFAULT_GAME_SLUG, getGame, hasModule, type ModuleId } from "@/lib/games";

type Item = {
  href: string;
  label: string;
  icon: React.ReactNode;
  /** Only rendered when the current game enables this module (§5). */
  module?: ModuleId;
};

const icon = (d: string) => (
  <svg width="19" height="19" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
    <path d={d} />
  </svg>
);

/**
 * The dashboard's primary navigation.
 *
 * A slim icon rail on desktop, a bottom bar on touch. Which destinations exist
 * is decided by the current game's enabled modules, so a game that does not run
 * services never shows a services tab.
 */
export function Rail() {
  const pathname = usePathname();
  const slug = pathname.split("/")[2] ?? DEFAULT_GAME_SLUG;
  const game = getGame(slug) ?? getGame(DEFAULT_GAME_SLUG)!;
  const base = `/app/${game.slug}`;

  const allItems: Item[] = [
    { href: base, label: "Home", icon: icon("M3.5 8.2 10 3l6.5 5.2V16a1 1 0 0 1-1 1h-11a1 1 0 0 1-1-1V8.2Z") },
    { href: `${base}/explore`, label: "Explore", icon: icon("M9 15.5A6.5 6.5 0 1 0 9 2.5a6.5 6.5 0 0 0 0 13ZM17.5 17.5 13.7 13.7") },
    { href: `${base}/trades`, label: "Trades", icon: icon("M3 6.5h11M11.5 4 14 6.5 11.5 9M17 13.5H6M8.5 11 6 13.5 8.5 16"), module: "trades" },
    // Profile, not Inventory. The two lists that feed matching still exist and
    // are still reachable from the dashboard, but they were never a place a
    // player went to look at anything — a tab is for a destination, and the
    // destination people actually want here is the person, theirs or somebody
    // else's. Drawn in the same hand as the home glyph: one closed shape, same
    // stroke, so the rail reads as one set.
    { href: `${base}/profile`, label: "Profile", icon: icon("M10 10.4a3.2 3.2 0 1 0 0-6.4 3.2 3.2 0 0 0 0 6.4ZM4.2 17v-1a3.6 3.6 0 0 1 3.6-3.6h4.4a3.6 3.6 0 0 1 3.6 3.6v1") },
    { href: `${base}/my-lists`, label: "My lists", icon: icon("M4 5h12M4 10h12M4 15h7") },
    // Contacts absorbs what a separate Messages tab would have been: the people
    // and the conversation with them are the same thing, and two tabs that both
    // open a list of names is one tab too many on a 390px bar.
    { href: `${base}/contacts`, label: "Contacts", icon: icon("M13 16.5v-1.2a3 3 0 0 0-3-3H5.5a3 3 0 0 0-3 3v1.2M7.75 9.5a3 3 0 1 0 0-6 3 3 0 0 0 0 6ZM17.5 16.5v-1.2a3 3 0 0 0-2.25-2.9M12.75 3.7a3 3 0 0 1 0 5.8") },
  ];

  const items = allItems.filter((i) => !i.module || hasModule(game, i.module));

  const isActive = (href: string) =>
    href === base ? pathname === base : pathname.startsWith(href);

  return (
    <>
      {/* ---- desktop rail ---- */}
      <nav
        aria-label="Main"
        className="glass-overlay fixed left-4 top-1/2 z-40 hidden -translate-y-1/2 flex-col items-center gap-1 rounded-[22px] p-2 lg:flex"
      >
        {items.map((item) => {
          const active = isActive(item.href);
          return (
            <Link
              key={item.label}
              href={item.href}
              aria-label={item.label}
              aria-current={active ? "page" : undefined}
              title={item.label}
              className={`grid h-11 w-11 place-items-center rounded-[15px] transition-colors duration-200 ${
                active
                  ? "bg-mint-wash text-mint"
                  : "text-ink-mute hover:bg-line hover:text-ink"
              }`}
            >
              {item.icon}
            </Link>
          );
        })}

        <span aria-hidden="true" className="my-1 h-px w-6 bg-line" />

        <Link
          href={`${base}?settings=1`}
          aria-label="Settings"
          title="Settings"
          className="grid h-11 w-11 place-items-center rounded-[15px] text-ink-mute transition-colors duration-200 hover:bg-line hover:text-ink"
        >
          {icon("M10 12.5a2.5 2.5 0 1 0 0-5 2.5 2.5 0 0 0 0 5ZM16.2 12.2a1.4 1.4 0 0 0 .3 1.5l.1.1a1.6 1.6 0 1 1-2.3 2.3l-.1-.1a1.4 1.4 0 0 0-2.4 1v.2a1.6 1.6 0 1 1-3.2 0v-.1a1.4 1.4 0 0 0-2.4-1l-.1.1a1.6 1.6 0 1 1-2.3-2.3l.1-.1a1.4 1.4 0 0 0-1-2.4H2.8a1.6 1.6 0 1 1 0-3.2h.1a1.4 1.4 0 0 0 1-2.4l-.1-.1a1.6 1.6 0 1 1 2.3-2.3l.1.1a1.4 1.4 0 0 0 2.4-1V2.8a1.6 1.6 0 1 1 3.2 0v.1a1.4 1.4 0 0 0 2.4 1l.1-.1a1.6 1.6 0 1 1 2.3 2.3l-.1.1a1.4 1.4 0 0 0 1 2.4h.2a1.6 1.6 0 1 1 0 3.2h-.1a1.4 1.4 0 0 0-1.3.8Z")}
        </Link>
      </nav>

      {/* ---- touch bar ---- */}
      <nav
        aria-label="Main"
        className="glass-overlay fixed inset-x-3 bottom-3 z-40 flex items-center justify-around rounded-[22px] p-1.5 lg:hidden"
        style={{ paddingBottom: "max(0.375rem, env(safe-area-inset-bottom))" }}
      >
        {items.map((item) => {
          const active = isActive(item.href);
          return (
            <Link
              key={item.label}
              href={item.href}
              aria-current={active ? "page" : undefined}
              className={`flex min-w-[3.5rem] flex-col items-center gap-1 whitespace-nowrap rounded-[15px] px-2.5 py-2 transition-colors duration-200 ${
                active ? "bg-mint-wash text-mint" : "text-ink-mute"
              }`}
            >
              {item.icon}
              <span className="text-[0.625rem] font-semibold tracking-[0.01em]">{item.label}</span>
            </Link>
          );
        })}
      </nav>
    </>
  );
}
