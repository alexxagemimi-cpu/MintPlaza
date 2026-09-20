import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { getGame } from "@/lib/games";
import { getBoard } from "@/lib/data/board";
import { readMyListings } from "@/lib/data/trades";
import { touchPresence } from "@/lib/actions/board";
import { MyLists } from "@/components/MyLists";

/**
 * Your own corner of the board.
 *
 * Scoped to one game, like Trades and Inventory, because the rail is — somebody
 * deep in Blox Fruits should not have Royale High requests in the way.
 */

export async function generateMetadata({
  params,
}: { params: Promise<{ game: string }> }): Promise<Metadata> {
  const game = getGame((await params).game);
  return { title: game ? `Your ${game.shortName} lists` : "My lists" };
}

export default async function MyListsPage({
  params,
}: { params: Promise<{ game: string }> }) {
  const game = getGame((await params).game);
  if (!game) notFound();

  // Trades are read here as well as on the Trades tab. "My lists" says it
  // shows what you posted, and a trade listing is something you posted — it
  // only ever appeared under Trades, so posting one and then looking here
  // found nothing, which reads as the post having failed.
  const [all, trades] = await Promise.all([
    getBoard(game.slug),
    readMyListings(game.slug),
    touchPresence(),
  ]);

  return (
    <MyLists
      gameSlug={game.slug}
      posted={all.filter((l) => l.yours)}
      trades={trades}
      joined={all.filter((l) => !l.yours && l.youVoted)}
    />
  );
}
