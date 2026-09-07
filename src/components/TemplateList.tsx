"use client";

import { useState } from "react";
import type { Section, Service } from "@/lib/sessions";
import { PostListing } from "./PostListing";
import { ServiceArt } from "./ServiceArt";

/**
 * The reference list of what a board covers.
 *
 * These used to be plain cards, and that was a mistake worth naming: on a
 * touch screen a card that looks exactly like the live listings above it but
 * does nothing when tapped reads as broken, not as a reference. Nothing on a
 * page should invite a tap and then ignore it.
 *
 * So each one starts the post it describes, with the template already chosen.
 * That also turns the list into the fastest route to posting — you are already
 * reading "Leviathan hunt · 5 players" when you decide you want one.
 */
export function TemplateList({
  templates, gameSlug, gameName, section,
}: {
  templates: readonly Service[];
  gameSlug: string;
  gameName: string;
  section: Section;
}) {
  const [start, setStart] = useState<string | null>(null);

  return (
    <>
      <ul className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
        {templates.map((sv) => (
          <li key={sv.id}>
            <button
              type="button"
              onClick={() => setStart(sv.id)}
              className="glass-quiet flex h-full w-full flex-col rounded-[var(--radius-inner)] p-3 text-left transition-colors hover:border-mint"
            >
              <span className="flex items-center gap-2.5">
                <ServiceArt service={sv} size={44} rounded={11} />
                <span className="min-w-0 flex-1">
                  <span className="block text-[0.875rem] font-bold leading-tight tracking-[-0.015em] text-ink">
                    {sv.name}
                  </span>
                  <span className="mt-1 block font-mono text-[0.5625rem] tracking-[0.08em] text-ink-faint">
                    {sv.kind.toUpperCase()}
                    {sv.players ? ` · ${sv.players} PLAYERS` : ""}
                  </span>
                </span>
                <span aria-hidden="true" className="shrink-0 text-ink-faint">
                  <svg width="13" height="13" viewBox="0 0 16 16" fill="none"
                       stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"
                       strokeLinejoin="round">
                    <path d="M8 3.5v9M3.5 8h9" />
                  </svg>
                </span>
              </span>
              <span className="mt-2 block font-mono text-[0.5rem] tracking-[0.09em] text-mint">
                {section === "recruit" ? "START A CREW" : "POST THIS"}
              </span>
            </button>
          </li>
        ))}
      </ul>

      {start && (
        <PostListing
          gameSlug={gameSlug}
          gameName={gameName}
          section={section}
          preselect={start}
          onClose={() => setStart(null)}
        />
      )}
    </>
  );
}
