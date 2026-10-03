import { NextResponse, type NextRequest } from "next/server";
import { createServerClient } from "@supabase/ssr";
import { SUPABASE_ANON_KEY, SUPABASE_READY, SUPABASE_URL } from "@/lib/supabase/config";
import { CANONICAL_HOST, CANONICAL_ORIGIN } from "@/lib/site";

const IS_PRODUCTION = process.env.VERCEL_ENV === "production";

/**
 * One address for the whole site.
 *
 * The same production build answers on www.mintplaza.in, mintplaza.in,
 * mintplaza.vercel.app and a per-deployment *.vercel.app URL. Without this,
 * search engines and AdSense can file inner pages under a vercel.app host.
 * In production every other host gets a permanent (308) redirect to the same
 * path on www.mintplaza.in. Preview deployments are left reachable for testing
 * but marked noindex so they never compete with the real site.
 */
function canonicalRedirect(request: NextRequest): NextResponse | null {
  const host = (request.headers.get("host") ?? "").toLowerCase();
  if (!IS_PRODUCTION || !host || host === CANONICAL_HOST) return null;
  if (host.startsWith("localhost") || host.startsWith("127.")) return null;
  const target = new URL(request.nextUrl.pathname + request.nextUrl.search, CANONICAL_ORIGIN);
  return NextResponse.redirect(target, 308);
}

function finish(request: NextRequest, response: NextResponse): NextResponse {
  if (IS_PRODUCTION) {
    response.headers.set(
      "Link",
      `<${CANONICAL_ORIGIN}${request.nextUrl.pathname}>; rel="canonical"`,
    );
  } else {
    response.headers.set("X-Robots-Tag", "noindex, nofollow");
  }
  return response;
}

/**
 * Keeps the session cookie fresh.
 *
 * Server Components cannot write cookies, so a refreshed token has to be
 * written here or the session silently expires mid-visit. When no project is
 * configured this is a pass-through, which is what lets the site run without a
 * database at all.
 *
 * Named `proxy` rather than `middleware`: Next 16 renamed the convention and
 * warns on every build that still uses the old name. The behaviour is
 * unchanged — same function, same `config.matcher`.
 */
export async function proxy(request: NextRequest) {
  const redirect = canonicalRedirect(request);
  if (redirect) return redirect;

  if (!SUPABASE_READY) return finish(request, NextResponse.next());

  let response = NextResponse.next({ request });

  const supabase = createServerClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(toSet) {
        toSet.forEach(({ name, value }) => request.cookies.set(name, value));
        response = NextResponse.next({ request });
        toSet.forEach(({ name, value, options }) =>
          response.cookies.set(name, value, options),
        );
      },
    },
  });

  // Touching the user is what performs the refresh. Do not remove.
  await supabase.auth.getUser();

  return finish(request, response);
}

export const config = {
  matcher: [
    // Everything except static assets, image files, and the API routes.
    //
    // `api/` is excluded because neither route behind it has a session to
    // refresh and both pay for the attempt. /api/item-image is one request per
    // catalogue tile — thirty of them on a single Pet Simulator 99 explore
    // screen — and every one was opening a Supabase auth round-trip from the
    // edge before the picture could even start loading. /api/level-up/webhook
    // is authenticated by an HMAC signature, not a cookie, so an auth call
    // there buys nothing and adds a way for a payment to go missing.
    //
    // Server Actions post to the page they live on rather than to /api, so
    // they keep the refresh they need.
    "/((?!api/|_next/static|_next/image|favicon.ico|games/|items/|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};
