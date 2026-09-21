import { NextResponse, type NextRequest } from "next/server";
import { serverSupabase } from "@/lib/supabase/server";
import { internalPath } from "@/lib/redirect";

/** Sign-out is a POST so a stray link or prefetch cannot end a session. */
export async function POST(request: NextRequest) {
  const supabase = await serverSupabase();
  if (supabase) await supabase.auth.signOut();

  const url = new URL(request.url);
  // "Switch account" wants the sign-in page; plain sign-out wants the front
  // door. Only same-origin paths are honoured, so this cannot be turned into
  // an open redirect by anybody who can get a person to submit the form.
  const next = internalPath(url.searchParams.get("next"), url.origin, "/");

  return NextResponse.redirect(new URL(next, url.origin), { status: 303 });
}
