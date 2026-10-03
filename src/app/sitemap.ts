import type { MetadataRoute } from "next";
import { GAMES } from "@/lib/games";
import { SITE_ORIGIN } from "@/lib/site";

export default function sitemap(): MetadataRoute.Sitemap {
  const pages = ["/", "/login", "/support", "/upgrade", "/terms", "/privacy", "/refunds"];
  const gamePages = GAMES.flatMap((g) => [
    `/app/${g.slug}`,
    `/app/${g.slug}/explore`,
    `/app/${g.slug}/trades`,
  ]);
  return [...pages, ...gamePages].map((path) => ({ url: `${SITE_ORIGIN}${path}` }));
}
