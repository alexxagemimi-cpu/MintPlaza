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
    { href: `${base}/inventory`, label: "Inventory", icon: icon("M3 7.2 10 3.5l7 3.7v5.6L10 16.5l-7-3.7V7.2ZM3 7.2 10 11l7-3.8M10 11v5.5"), module: "inventory" },
    { href: `${base}/my-lists`, label: "My lists", icon: icon("M4 5h12M4 10h12M4 15h7") },
    { href: "/messages", label: "Messages", icon: icon("M17 9.6c0 3.2-3.1 5.8-7 5.8a8 8 0 0 1-2.1-.3L4 16.5l1.1-2.7A5.5 5.5 0 0 1 3 9.6c0-3.2 3.1-5.8 7-5.8s7 2.6 7 5.8Z") },
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
          href="/settings"
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
