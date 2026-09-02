import { notFound } from "next/navigation";
import { getGame } from "@/lib/games";
import { NotBuiltYet } from "@/components/NotBuiltYet";

export default async function TradesPage({ params }: { params: Promise<{ game: string }> }) {
  const game = getGame((await params).game);
  if (!game) notFound();

  return (
    <NotBuiltYet title={`${game.shortName} trades`} step="6" backHref={`/app/${game.slug}`} backLabel="Back to dashboard">
      <p>
        The global board for {game.name}: every active listing, with the three
        per three hours limit enforced by the database rather than the browser.
      </p>
      <p>
        Creating a listing needs an account, so this follows Roblox sign-in
        going live.
      </p>
    </NotBuiltYet>
  );
}
