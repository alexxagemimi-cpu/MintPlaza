import { NextResponse, type NextRequest } from "next/server";
import { findItem } from "@/lib/items";
import { outboundUrl } from "@/lib/referrals";
import { getGame } from "@/lib/games";

/**
 * Outbound value lookups, counted on the way past.
 *
 * ---------------------------------------------------------------------------
 * Why the destination is not a parameter
 * ---------------------------------------------------------------------------
 *
 * The obvious shape for this route is `/go?to=<url>`, and it is the wrong one.
 * A redirector that forwards to a URL from the query string is an open
 * redirect: anybody can mint `mintplaza.example/go?to=https://evil.example`,
 * and the link they paste into a trade chat carries MintPlaza's domain, which
 * is exactly the trust this site is trying to build. On a site whose users are
 * mostly children holding valuable inventories, that is not a theoretical
 * finding — it is a ready-made phishing page with our name on it.
 *
 * So nothing about the destination comes from the request. The route is handed
 * a game slug and, optionally, an item id; both are looked up in registries
 * compiled into the build; the URL is reconstructed from the partner entry. An
 * attacker who controls the entire query string can, at most, choose which of
 * the three partner sites they get sent to.
 *
 * The item id is validated by lookup rather than by pattern, and a mismatched
 * one degrades to the game's list page rather than 404ing: a player who
 * followed a link from a stale listing still gets somewhere useful.
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ game: string }> },
) {
  const { game } = await params;

  // An unregistered slug is not a redirect target, it is a typo or a probe.
  if (!getGame(game)) {
    return NextResponse.redirect(new URL("/app", request.url), 302);
  }

  const itemId = new URL(request.url).searchParams.get("item");
  const item = itemId ? findItem(itemId) : undefined;
  // An item id that belongs to a different game is ignored rather than
  // honoured — it would deep-link into the wrong game's value list.
  const scoped = item && item.gameSlug === game ? item : undefined;

  const out = outboundUrl(game, scoped);
  if (!out) {
    return NextResponse.redirect(new URL(`/app/${game}`, request.url), 302);
  }

  const response = NextResponse.redirect(out.url, 302);
  // Referrer is suppressed so the partner sees a click without seeing which
  // listing produced it. Attribution rides in the query parameter, which is
  // the part they are entitled to; who was trading what is not.
  response.headers.set("Referrer-Policy", "no-referrer");
  // 302 rather than 307/308: partner URLs change with their site, and a cached
  // permanent redirect would outlive the agreement that justified it.
  response.headers.set("Cache-Control", "no-store");
  return response;
}
