import { NextResponse, type NextRequest } from "next/server";
import { isValuesIntent, outboundUrl } from "@/lib/referrals";
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
 * a game slug and, at most, one of two fixed words; the slug is looked up in a
 * registry compiled into the build, the word is checked against a two-element
 * list, and the URL is rebuilt from the partner entry. An attacker who controls
 * the entire query string can choose, at most, which of a partner's own two
 * pages they are sent to.
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

  // Anything other than the one word we accept degrades to the value list
  // rather than 404ing. A player who followed a link from a stale page still
  // lands somewhere that answers their question.
  const raw = new URL(request.url).searchParams.get("for");
  const intent = isValuesIntent(raw) ? raw : "values";

  const out = outboundUrl(game, intent);
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
