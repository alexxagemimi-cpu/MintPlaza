"use client";

import { useCallback, useEffect, useId, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { GAMES, type Game } from "@/lib/games";
import { GameArt } from "./GameArt";

/**
 * The game switcher.
 *
 * The current game sits in a large card. Activating it drops the other games
 * out from underneath, and choosing one changes the dashboard's context by
 * navigating — so the selection is a real, shareable URL rather than hidden
 * component state (§4).
 *
 * It is a listbox, not a div that listens for clicks: arrow keys move, Home and
 * End jump, Enter and Space choose, Escape closes and returns focus. The
 * staggered entrance is suppressed under prefers-reduced-motion by the global
 * stylesheet, which leaves a plain instant panel.
 */
export function GameSwitcher({ current }: { current: Game }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [activeIndex, setActiveIndex] = useState(0);

  const rootRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const optionRefs = useRef<Array<HTMLLIElement | null>>([]);
  const listboxId = useId();

  const others = GAMES.filter((g) => g.slug !== current.slug);

  const close = useCallback((refocus: boolean) => {
    setOpen(false);
    if (refocus) triggerRef.current?.focus();
  }, []);

  const choose = useCallback(
    (game: Game) => {
      setOpen(false);
      router.push(`/app/${game.slug}`);
    },
    [router],
  );

  /* Close on outside pointer or Escape. */
  useEffect(() => {
    if (!open) return;

    function onPointerDown(e: PointerEvent) {
      if (!rootRef.current?.contains(e.target as Node)) setOpen(false);
    }
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") {
        e.stopPropagation();
        close(true);
      }
    }

    document.addEventListener("pointerdown", onPointerDown);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("pointerdown", onPointerDown);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [open, close]);

  /* Move DOM focus with the active option so screen readers follow along. */
  useEffect(() => {
    if (open) optionRefs.current[activeIndex]?.focus();
  }, [open, activeIndex]);

  function openAt(index: number) {
    setActiveIndex(index);
    setOpen(true);
  }

  function onTriggerKeyDown(e: React.KeyboardEvent) {
    if (e.key === "ArrowDown" || e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      openAt(0);
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      openAt(others.length - 1);
    }
  }

  function onOptionKeyDown(e: React.KeyboardEvent, index: number) {
    switch (e.key) {
      case "ArrowDown":
        e.preventDefault();
        setActiveIndex((index + 1) % others.length);
        break;
      case "ArrowUp":
        e.preventDefault();
        setActiveIndex((index - 1 + others.length) % others.length);
        break;
      case "Home":
        e.preventDefault();
        setActiveIndex(0);
        break;
      case "End":
        e.preventDefault();
        setActiveIndex(others.length - 1);
        break;
      case "Enter":
      case " ":
        e.preventDefault();
        choose(others[index]);
        break;
      case "Tab":
        setOpen(false);
        break;
    }
  }

  return (
    <div ref={rootRef} className="relative">
      {/* ---- current game ---- */}
      <button
        ref={triggerRef}
        type="button"
        onClick={() => (open ? close(false) : openAt(0))}
        onKeyDown={onTriggerKeyDown}
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-controls={open ? listboxId : undefined}
        className="glass-lift group w-full rounded-[var(--radius-panel)] p-5 text-left transition-transform duration-200 ease-[var(--ease-out-soft)] hover:-translate-y-px sm:p-6"
      >
        <span
          aria-hidden="true"
          className="pointer-events-none absolute inset-0 rounded-[var(--radius-panel)] opacity-70"
          style={{ background: `radial-gradient(24rem 13rem at 6% -35%, ${current.hue}24, transparent 72%)` }}
        />
        <span className="relative flex items-center gap-4">
          <GameArt game={current} size={54} />
          <span className="min-w-0 flex-1">
            <span className="label block">Current game</span>
            <span className="mt-1 block truncate text-[1.25rem] font-extrabold tracking-[-0.03em] text-ink sm:text-[1.375rem]">
              {current.name}
            </span>
          </span>
          <span
            className={`grid h-9 w-9 shrink-0 place-items-center rounded-full border border-line bg-fill text-ink-soft transition-all duration-300 ease-[var(--ease-out-soft)] group-hover:border-line group-hover:text-ink ${open ? "rotate-180" : ""}`}
          >
            <svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
              <path d="M4 6.5 8 10.5l4-4" />
            </svg>
          </span>
        </span>
        <span className="relative mt-3 block text-[0.8125rem] leading-relaxed text-ink-mute">
          {current.coordinates.join(" · ")}
        </span>
      </button>

      {/* ---- scrim, mobile only ---- */}
      {open && (
        <div
          aria-hidden="true"
          className="fixed inset-0 z-40 bg-ink/25 backdrop-blur-sm sm:hidden"
          onPointerDown={() => setOpen(false)}
        />
      )}

      {/* ---- the other games ---- */}
      {open && (
        <ul
          id={listboxId}
          role="listbox"
          aria-label="Switch game"
          className="glass-overlay fixed inset-x-3 bottom-3 z-50 max-h-[70dvh] overflow-y-auto rounded-[var(--radius-panel)] p-2 sm:absolute sm:inset-x-auto sm:bottom-auto sm:left-0 sm:top-[calc(100%+0.6rem)] sm:max-h-none sm:w-full sm:overflow-visible"
        >
          <li aria-hidden="true" className="px-3 pb-2 pt-2 sm:hidden">
            <span className="label">Switch game</span>
          </li>

          {others.map((g, i) => (
            <li
              key={g.slug}
              ref={(el) => {
                optionRefs.current[i] = el;
              }}
              role="option"
              aria-selected={false}
              tabIndex={activeIndex === i ? 0 : -1}
              onClick={() => choose(g)}
              onKeyDown={(e) => onOptionKeyDown(e, i)}
              onPointerEnter={() => setActiveIndex(i)}
              style={{ animationDelay: `${i * 38}ms` }}
              className="rise flex cursor-pointer items-center gap-3.5 rounded-[var(--radius-inner)] p-3 outline-none transition-colors duration-150 hover:bg-line focus-visible:bg-fill-strong aria-[selected]:bg-transparent"
            >
              <GameArt game={g} size={40} />
              <span className="min-w-0 flex-1">
                <span className="block truncate text-[0.9375rem] font-bold tracking-[-0.02em] text-ink">
                  {g.name}
                </span>
                <span className="mt-0.5 block truncate text-[0.75rem] text-ink-mute">
                  {g.coordinates.slice(0, 3).join(" · ")}
                </span>
              </span>
              <svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.8" className="shrink-0 text-ink-faint" strokeLinecap="round" strokeLinejoin="round">
                <path d="M6 3.5 10.5 8 6 12.5" />
              </svg>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
