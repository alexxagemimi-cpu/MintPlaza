import { notFound } from "next/navigation";
import { getGame } from "@/lib/games";
import { NotBuiltYet } from "@/components/NotBuiltYet";

export default async function ExplorePage({ params }: { params: Promise<{ game: string }> }) {
  const game = getGame((await params).game);
  if (!game) notFound();

  return (
    <NotBuiltYet title={`Explore ${game.shortName}`} step="7" backHref={`/app/${game.slug}`} backLabel="Back to dashboard">
      <p>
        Search and filters across everything posted for {game.name}, ranked by
        relevance to your lists rather than by whoever posted most recently.
      </p>
      <p>
        This lands after the database and listings are connected, because
        searching nothing would only ever return nothing.
      </p>
    </NotBuiltYet>
  );
}
