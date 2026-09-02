import { notFound } from "next/navigation";
import { getGame } from "@/lib/games";
import { NotBuiltYet } from "@/components/NotBuiltYet";

export default async function InventoryPage({ params }: { params: Promise<{ game: string }> }) {
  const game = getGame((await params).game);
  if (!game) notFound();

  const fields = game.itemAttributes.map((a) => a.label).join(", ");

  return (
    <NotBuiltYet title={`Your ${game.shortName} lists`} step="5" backHref={`/app/${game.slug}`} backLabel="Back to dashboard">
      <p>
        What you have and what you want, using the fields {game.name} actually
        trades on{fields ? `: ${fields}.` : "."}
      </p>
      <p>
        Screenshots can be attached as proof, always shown with the date they
        were taken — a picture from months ago is evidence, not proof of what
        you hold today.
      </p>
    </NotBuiltYet>
  );
}
