import { GAMES, type Game } from "@/lib/games";
import { catalogFor, applyCatalogOverrides, type CatalogItem, type CatalogRow } from "@/lib/items";
import { serverSupabase } from "@/lib/supabase/server";

/**
 * Game and item data, from the database when there is one.
 *
 * The code registry is the fallback, not the source of truth — once a game row
 * exists it wins, which is what makes the admin surface meaningful. Until then
 * the site runs exactly as it does today.
 *
 * A read failure falls back rather than throwing: a database hiccup should not
 * take the whole site down when perfectly good defaults are compiled in.
 */

export async function getGames(): Promise<readonly Game[]> {
  const supabase = await serverSupabase();
  if (!supabase) return GAMES;

  const { data, error } = await supabase
    .from("games")
    .select("slug, name, short_name, blurb, hue, art, sort_order")
    .eq("is_active", true)
    .order("sort_order");

  if (error || !data || data.length === 0) return GAMES;

  // The database owns the editable fields; the registry supplies the structural
  // ones that have no column yet — explore tabs, wants, item attributes.
  return data
    .map((row) => {
      const fallback = GAMES.find((g) => g.slug === row.slug);
      if (!fallback) return null;
      return {
        ...fallback,
        name: row.name ?? fallback.name,
        shortName: row.short_name ?? fallback.shortName,
        blurb: row.blurb ?? fallback.blurb,
        hue: row.hue ?? fallback.hue,
        art: row.art ?? fallback.art,
      } satisfies Game;
    })
    .filter((g): g is Game => g !== null);
}

export async function getGame(slug: string): Promise<Game | undefined> {
  return (await getGames()).find((g) => g.slug === slug);
}

/**
 * One game's catalogue: the code registry, with the control panel's edits
 * laid over it.
 *
 * The merge itself is `applyCatalogOverrides` in src/lib/items.ts, which is pure and
 * therefore provable -- the reasoning for why this merges rather than chooses,
 * and why an id is a slug and never a uuid, lives beside it. Both rules were
 * written after each was broken in production: a partial seed had removed
 * 4,944 items from Pet Simulator 99, and uuid ids made it impossible to list
 * or stock anything in any game that had rows at all.
 *
 * Inactive rows are fetched rather than filtered out in the query on purpose.
 * `is_active: false` is how the panel removes an item, and a row excluded here
 * would simply let the registry's copy through, making deactivation a no-op.
 */
export async function getCatalog(gameSlug: string): Promise<readonly CatalogItem[]> {
  const base = catalogFor(gameSlug);

  const supabase = await serverSupabase();
  if (!supabase) return base;

  const { data, error } = await supabase
    .from("game_items")
    .select("id, game_slug, name, category, attributes, verified_at, is_active")
    .eq("game_slug", gameSlug)
    .order("name");

  if (error || !data || data.length === 0) return base;

  return applyCatalogOverrides(base, data as CatalogRow[]);
}
