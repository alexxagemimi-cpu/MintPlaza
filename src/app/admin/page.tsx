import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { adminProfile } from "@/lib/admin/auth";
import { isUnlocked } from "@/lib/admin/gate";
import { PasscodeScreen } from "@/components/admin/PasscodeScreen";
import { serverSupabase } from "@/lib/supabase/server";
import { ConsolePanel, type ConsoleGame, type ConsoleItem } from "@/components/admin/ConsolePanel";
import { listReports, listSupport, listLevelUps, listAnnouncements } from "@/lib/admin/actions";
import { allTemplates, mediaLibrary } from "@/lib/data/templates";

/**
 * The admin surface.
 *
 * Not linked from anywhere. For anyone who is not the admin — signed out,
 * signed in as somebody else, or poking at the URL — this is a 404, the same
 * response a route that does not exist would give. "Forbidden" would confirm
 * there is something here to be forbidden from; "not found" says nothing.
 *
 * The 404 is presentation only. Every write goes through a server action that
 * re-checks the identity, and under that, row-level security refuses a non-admin
 * write regardless of what any client sends.
 */

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Not found",
  // Never index it, and never let it appear in a link preview.
  robots: { index: false, follow: false, nocache: true },
};

export default async function AdminPage() {
  const profile = await adminProfile();
  if (!profile) notFound();

  // Being the admin gets you to the door. The code opens it.
  if (!(await isUnlocked())) return <PasscodeScreen />;

  const supabase = await serverSupabase();
  if (!supabase) notFound();

  const [{ data: games }, { data: items }, reports, support] = await Promise.all([
    supabase.from("games")
      .select("slug, name, short_name, blurb, hue, art, sort_order, explore_tabs")
      .order("sort_order"),
    supabase.from("game_items")
      .select("id, game_slug, name, category, attributes, is_active")
      .order("name"),
    listReports("open"),
    listSupport("open"),
  ]);

  const [templates, library, levelUps, announcements] = await Promise.all([
    allTemplates(),
    mediaLibrary(),
    listLevelUps(),
    listAnnouncements(),
  ]);

  return (
    <ConsolePanel
      who={profile.display_name ?? profile.username}
      games={(games ?? []) as ConsoleGame[]}
      items={(items ?? []) as ConsoleItem[]}
      reports={reports}
      support={support}
      templates={templates}
      library={library}
      levelUps={levelUps}
      announcements={announcements}
    />
  );
}
