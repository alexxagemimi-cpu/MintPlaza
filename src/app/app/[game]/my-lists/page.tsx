import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { getGame } from "@/lib/games";
import { getBoard } from "@/lib/data/board";
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

  const [all] = await Promise.all([getBoard(game.slug), touchPresence()]);

  return (
    <MyLists
      posted={all.filter((l) => l.yours)}
      joined={all.filter((l) => !l.yours && l.youVoted)}
    />
  );
}
