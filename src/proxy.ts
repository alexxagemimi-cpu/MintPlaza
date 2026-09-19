import { NextResponse, type NextRequest } from "next/server";
import { createServerClient } from "@supabase/ssr";
import { SUPABASE_ANON_KEY, SUPABASE_READY, SUPABASE_URL } from "@/lib/supabase/config";

/**
 * Keeps the session cookie fresh.
 *
 * Server Components cannot write cookies, so a refreshed token has to be
 * written here or the session silently expires mid-visit. When no project is
 * configured this is a pass-through, which is what lets the site run without a
 * database at all.
 */
export async function middleware(request: NextRequest) {
  if (!SUPABASE_READY) return NextResponse.next();

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

  return response;
}

export const config = {
  matcher: [
    // Everything except static assets and image files.
    "/((?!_next/static|_next/image|favicon.ico|games/|items/|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};
