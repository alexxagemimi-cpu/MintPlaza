import { serverSupabase } from "@/lib/supabase/server";
import { SERVICES, type Section, type Service, type ServiceKind } from "@/lib/sessions";

/**
 * Where list templates come from.
 *
 * Two sources, deliberately, and the order matters:
 *
 *   1. The code catalogue in sessions.ts is the seed. It ships with the site,
 *      it is version-controlled, and it is what renders when the database is
 *      unreachable — which is the difference between a slow page and a blank
 *      one.
 *
 *   2. Rows in `service_templates` override it, id by id.
 *
 * Nothing is copied from one to the other. A template edited in the Studio gets
 * a database row the first time it is saved and is read from there afterwards;
 * one never touched has no row at all and goes on being read from code. That is
 * why there is no seeding step and no migration to keep in sync: there is only
 * ever one answer for a given id, and the merge decides it at read time.
 *
 * The consequences worth naming:
 *
 *   - Retiring a template that shipped in code works, because a row can say
 *     `is_active = false` about an id the code still defines.
 *   - A template invented in the Studio has no code counterpart and simply
 *     appears.
 *   - Deleting a database row does not delete the template; it reverts it to
 *     whatever the code says. That is a useful undo, not a bug.
 */

export interface TemplateRow {
  id: string;
  game_slug: string;
  name: string;
  kind: string;
  section: string;
  art: string | null;
  needs: string | null;
  players: number | null;
  gives: string | null;
  open_ended: boolean;
  aliases: string[] | null;
  refs: { id: string; label: string; hue?: string; art?: string }[] | null;
  verified: boolean;
  is_active: boolean;
  sort_order: number;
  updated_at: string | null;
}

/** One template as the Studio needs to see it, whichever source it came from. */
export interface StudioTemplate extends Service {
  /** False once retired. Code templates are always active until a row says otherwise. */
  isActive: boolean;
  /** True where a database row exists — i.e. this has been edited at least once. */
  edited: boolean;
  sortOrder: number;
  updatedAt?: string;
}

function fromRow(row: TemplateRow): StudioTemplate {
  return {
    id: row.id,
    gameSlug: row.game_slug,
    name: row.name,
    kind: row.kind as ServiceKind,
    section: row.section as Section,
    art: row.art ?? undefined,
    needs: row.needs ?? undefined,
    players: row.players ?? undefined,
    gives: row.gives ?? undefined,
    openEnded: row.open_ended || undefined,
    aliases: row.aliases ?? undefined,
    refs: row.refs ?? undefined,
    verified: row.verified,
    isActive: row.is_active,
    edited: true,
    sortOrder: row.sort_order,
    updatedAt: row.updated_at ?? undefined,
  };
}

function fromCode(s: Service, index: number): StudioTemplate {
  return { ...s, isActive: true, edited: false, sortOrder: index };
}

/**
 * Every template for a game, merged, including retired ones.
 *
 * For the Studio, which has to show what is switched off in order to switch it
 * back on. The site uses `liveTemplates` instead.
 */
export async function allTemplates(gameSlug?: string): Promise<StudioTemplate[]> {
  const code = SERVICES
    .filter((s) => !gameSlug || s.gameSlug === gameSlug)
    .map(fromCode);

  const supabase = await serverSupabase();
  if (!supabase) return code;

  let query = supabase
    .from("service_templates")
    .select("id, game_slug, name, kind, section, art, needs, players, gives, open_ended, aliases, refs, verified, is_active, sort_order, updated_at");
  if (gameSlug) query = query.eq("game_slug", gameSlug);

  const { data, error } = await query;
  if (error || !Array.isArray(data)) return code;

  const overrides = new Map<string, StudioTemplate>(
    (data as TemplateRow[]).map((r) => [r.id, fromRow(r)]),
  );

  const merged = code.map((c) => overrides.get(c.id) ?? c);
  // Anything invented in the Studio has no code counterpart, so it is appended
  // rather than replacing something.
  const seen = new Set(merged.map((t) => t.id));
  for (const [id, t] of overrides) if (!seen.has(id)) merged.push(t);

  return merged.sort(
    (a, b) => a.sortOrder - b.sortOrder || a.name.localeCompare(b.name),
  );
}

/** What the site should actually offer: everything not retired. */
export async function liveTemplates(
  gameSlug: string, section: Section = "services",
): Promise<Service[]> {
  const all = await allTemplates(gameSlug);
  return all
    .filter((t) => t.isActive && (t.section ?? "services") === section)
    .map(({ isActive, edited, sortOrder, updatedAt, ...service }) => {
      void isActive; void edited; void sortOrder; void updatedAt;
      return service;
    });
}

/* ------------------------------------------------------------------ */

export interface MediaRow {
  id: string;
  url: string;
  label: string;
  kind: "item" | "service" | "ref" | "game" | "other";
  game_slug: string | null;
}

/**
 * The picture library.
 *
 * One shelf for the whole site. The Angel race is uploaded once and reused on
 * every template that needs it, so re-skinning it later is one replacement
 * rather than four.
 */
export async function mediaLibrary(): Promise<MediaRow[]> {
  const supabase = await serverSupabase();
  if (!supabase) return [];
  const { data, error } = await supabase
    .from("media")
    .select("id, url, label, kind, game_slug")
    .order("created_at", { ascending: false })
    .limit(500);
  if (error || !Array.isArray(data)) return [];
  return data as MediaRow[];
}
