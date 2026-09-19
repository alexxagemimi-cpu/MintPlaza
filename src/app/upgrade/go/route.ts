import { NextResponse, type NextRequest } from "next/server";
import { checkoutUrlFor, isCountryCode } from "@/lib/level-up";
import { currentProfile } from "@/lib/supabase/server";

/**
 * The hand-off to whoever is taking the money.
 *
 * ---------------------------------------------------------------------------
 * Why this is a route and not an href
 * ---------------------------------------------------------------------------
 *
 * The checkout URL is read from the environment, and putting it straight in the
 * page would mean prefixing the variable with NEXT_PUBLIC_ so the client could
 * see it — which bakes it into the JavaScript bundle at build time. A checkout
 * link is not a secret, but a value baked into a bundle can only be changed by
 * rebuilding, and the one thing you want to be able to change in a hurry is
 * where your payment button points. Reading it here makes swapping processors a
 * deploy rather than a rebuild.
 *
 * The same open-redirect rule as /go/[game] applies and for the same reason:
 * nothing about the destination comes from the request. The only thing taken
 * from the query string is a two-letter country code, checked against a fixed
 * list, and used to choose between two URLs that the environment supplies. An
 * attacker who controls the entire query string can, at most, choose which of
 * two prices they are sent to pay.
 *
 * On a site whose users are mostly children, a link carrying MintPlaza's domain
 * that forwards anywhere the caller likes would be a ready-made payment-phishing
 * page — which is exactly the shape this avoids.
 *
 * ---------------------------------------------------------------------------
 * Why the username goes with them
 * ---------------------------------------------------------------------------
 *
 * The webhook grants Level Up to a username. If the checkout page has to ask
 * the player to type theirs, then every typo is money that arrives with no
 * account to put it on — a 422, a log line, and somebody's parent asking where
 * ₹399 went. So the username travels in the URL as `u`, and the checkout page
 * shows it back rather than asking for it.
 *
 * It is not a secret and it is not a credential: a Roblox username is on every
 * profile page on this site. Anybody can edit it to somebody else's, and all
 * that achieves is paying for a stranger's subscription — which is generous,
 * not an attack. What it must never become is the thing the checkout page
 * TRUSTS silently: the page has to show whose account is being upgraded, so a
 * hand-edited link is visible before the money moves, not after.
 *
 * ---------------------------------------------------------------------------
 * And why signing in comes first
 * ---------------------------------------------------------------------------
 *
 * A signed-out visitor has no username to send. Letting them through would
 * mean taking a payment that cannot be granted to anybody — the single worst
 * outcome this route can produce, and one that costs a refund and a apology
 * rather than a retry. So they are sent to sign in, and come back to the same
 * price.
 */
export async function GET(request: NextRequest) {
  const raw = new URL(request.url).searchParams.get("country");

  // An unknown country is not an error worth a page. Send them back to pick
  // one, which is where they would have to go anyway.
  if (!isCountryCode(raw)) {
    return NextResponse.redirect(new URL("/upgrade", request.url), 302);
  }

  const url = checkoutUrlFor(raw!);
  if (!url) {
    // No processor configured. The upgrade page says so honestly rather than
    // this route inventing a destination.
    return NextResponse.redirect(new URL(`/upgrade?country=${raw}`, request.url), 302);
  }

  // Who is paying. Read from the session, never from the query string — the
  // caller does not get to say who a payment is for.
  const me = await currentProfile();
  if (!me?.username) {
    return NextResponse.redirect(
      new URL(`/login?next=${encodeURIComponent(`/upgrade?country=${raw}`)}`, request.url),
      302,
    );
  }

  // Appended rather than assigned, because a processor's own checkout link
  // usually already carries query parameters of its own and replacing them
  // would break the link.
  const destination = new URL(url);
  destination.searchParams.set("u", me.username);

  const response = NextResponse.redirect(destination.toString(), 302);
  // The processor needs to know a payment started, not which page of MintPlaza
  // the player was reading when they decided to pay.
  response.headers.set("Referrer-Policy", "no-referrer");
  // 302 and no-store: a processor's checkout link changes with their product
  // catalogue, and a cached permanent redirect would outlive the price.
  response.headers.set("Cache-Control", "no-store");
  return response;
}
