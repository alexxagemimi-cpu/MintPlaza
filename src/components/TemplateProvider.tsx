"use client";

import { createContext, useContext, useMemo } from "react";
import {
  SERVICES, findService as findInCode, servicesFor as codeServicesFor,
  type Section, type Service,
} from "@/lib/sessions";

/**
 * The live template list, handed down from the server.
 *
 * Templates now come from two places — the code catalogue and rows the Studio
 * has edited — and the merge happens on the server. Every client component that
 * needs to turn an id into a name has to read the merged answer, or a template
 * invented in the Studio would post fine and then render as a card about
 * nothing.
 *
 * This is a context rather than a module-level variable on purpose. A module
 * variable would be per-process on the server, which means one request's
 * templates could be served to the next request's user — the kind of bug that
 * only shows up under load and looks like haunting. A context is per-render and
 * cannot do that.
 *
 * When there is no provider — a component rendered outside the app shell, or a
 * page that never needed the database — it falls back to the code catalogue,
 * which is exactly what shipped before this existed.
 */

const TemplateContext = createContext<readonly Service[] | null>(null);

export function TemplateProvider({
  templates, children,
}: {
  templates: readonly Service[];
  children: React.ReactNode;
}) {
  // Identity-stable, so the whole tree does not re-render whenever a parent does.
  const value = useMemo(() => templates, [templates]);
  return <TemplateContext.Provider value={value}>{children}</TemplateContext.Provider>;
}

/** Every template the site currently knows about. */
export function useTemplates(): readonly Service[] {
  return useContext(TemplateContext) ?? SERVICES;
}

/**
 * Turn an id into a template.
 *
 * The drop-in replacement for `findService` inside client components. Same
 * signature, same fallback, but it sees Studio edits.
 */
export function useFindTemplate(): (id: string) => Service | undefined {
  const all = useContext(TemplateContext);
  return useMemo(() => {
    if (!all) return findInCode;
    const byId = new Map(all.map((s) => [s.id, s]));
    // Falling through to code matters: a listing can name a template that was
    // retired, and the card still has to be able to say what it was about.
    return (id: string) => byId.get(id) ?? findInCode(id);
  }, [all]);
}

/** The templates for one board of one game. */
export function useTemplatesFor(gameSlug: string, section: Section = "services") {
  const all = useContext(TemplateContext);
  return useMemo(() => {
    if (!all) return codeServicesFor(gameSlug, section);
    return all.filter(
      (s) => s.gameSlug === gameSlug && (s.section ?? "services") === section,
    );
  }, [all, gameSlug, section]);
}
