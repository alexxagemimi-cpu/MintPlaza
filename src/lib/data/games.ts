import { GAMES, type Game } from "@/lib/games";
import { catalogFor, type CatalogItem } from "@/lib/items";
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

export async function getCatalog(gameSlug: string): Promise<readonly CatalogItem[]> {
  const supabase = await serverSupabase();
  if (!supabase) return catalogFor(gameSlug);

  const { data, error } = await supabase
    .from("game_items")
    .select("id, game_slug, name, category, attributes")
    .eq("game_slug", gameSlug)
    .eq("is_active", true)
    .order("name");

  if (error || !data || data.length === 0) return catalogFor(gameSlug);

  // Rows carry their catalogue slug ("bf-dragon") alongside the database uuid.
  // The uuid is the id everything else keys on, so a parent recorded by slug
  // has to be translated back before it will resolve.
  const uuidBySlug = new Map<string, string>();
  for (const row of data) {
    const slug = (row.attributes as Record<string, unknown> | null)?.slug;
    if (typeof slug === "string") uuidBySlug.set(slug, row.id);
  }

  return data.map((row) => {
    const attrs = (row.attributes ?? {}) as Record<string, unknown>;
    const parentSlug = attrs.parentSlug;
    return {
      id: row.id,
      gameSlug: row.game_slug,
      name: row.name,
      category: row.category ?? "",
      rarity: attrs.rarity as CatalogItem["rarity"],
      type: attrs.type as string | undefined,
      formerly: Array.isArray(attrs.formerly) ? (attrs.formerly as string[]) : undefined,
      aliases: Array.isArray(attrs.aliases) ? (attrs.aliases as string[]) : undefined,
      parentId:
        typeof parentSlug === "string" ? uuidBySlug.get(parentSlug) : undefined,
      // Absent means tradeable, so only an explicit false may turn it off —
      // otherwise a row that predates the column would silently vanish from
      // every listing picker.
      tradeable: attrs.tradeable === false ? false : undefined,
      chromatic: attrs.chromatic === true ? true : undefined,
      robux: typeof attrs.robux === "number" ? attrs.robux : undefined,
      beli: typeof attrs.beli === "number" ? attrs.beli : undefined,
      // Only build a value object when the row actually has one, so an
      // unpriced item stays unpriced instead of becoming a zero.
      value:
        typeof attrs.valuePhysical === "number" || typeof attrs.valuePermanent === "number"
          ? {
              physical: typeof attrs.valuePhysical === "number" ? attrs.valuePhysical : undefined,
              permanent: typeof attrs.valuePermanent === "number" ? attrs.valuePermanent : undefined,
            }
          : undefined,
      demand:
        typeof attrs.demand === "number" && attrs.demand >= 1 && attrs.demand <= 5
          ? (attrs.demand as CatalogItem["demand"])
          : undefined,
      note: attrs.note as string | undefined,
      verified: attrs.verified === false ? false : undefined,
      art: attrs.art as string | undefined,
    };
  });
}
