import { redirect } from "next/navigation";
import { GAMES } from "@/lib/games";

/**
 * Inventory moved into the Trades screen as a subtab.
 *
 * The route stays as a redirect rather than being deleted, because links to it
 * are already out there — the dashboard prompts pointed here for months, and a
 * player who bookmarked their own lists should land on them rather than on a
 * 404 that tells them nothing about where it went.
 */

export function generateStaticParams() {
  return GAMES.map((g) => ({ game: g.slug }));
}

export default async function InventoryPage({
  params,
}: {
  params: Promise<{ game: string }>;
}) {
  redirect(`/app/${(await params).game}/trades?tab=inventory`);
}
