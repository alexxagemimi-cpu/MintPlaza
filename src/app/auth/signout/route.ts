import { NextResponse, type NextRequest } from "next/server";
import { serverSupabase } from "@/lib/supabase/server";

/** Sign-out is a POST so a stray link or prefetch cannot end a session. */
export async function POST(request: NextRequest) {
  const supabase = await serverSupabase();
  if (supabase) await supabase.auth.signOut();
  return NextResponse.redirect(new URL("/", new URL(request.url).origin), { status: 303 });
}
