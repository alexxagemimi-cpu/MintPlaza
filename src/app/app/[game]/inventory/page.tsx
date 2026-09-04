import Link from "next/link";
import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { GAMES } from "@/lib/games";
import { getGame, getCatalog } from "@/lib/data/games";
import { readInventory } from "@/lib/actions/inventory";
import { currentProfile } from "@/lib/supabase/server";
import { InventoryEditor } from "@/components/InventoryEditor";
import { GameArt } from "@/components/GameArt";

export function generateStaticParams() {
  return GAMES.map((g) => ({ game: g.slug }));
}

export async function generateMetadata({
  params,
}: { params: Promise<{ game: string }> }): Promise<Metadata> {
  const game = await getGame((await params).game);
  return { title: game ? `Your ${game.shortName} lists` : "Inventory" };
}

export default async function InventoryPage({
  params,
}: {
  params: Promise<{ game: string }>;
}) {
  const slug = (await params).game;
  const game = await getGame(slug);
  if (!game) notFound();

  const [profile, catalog] = await Promise.all([currentProfile(), getCatalog(slug)]);

  return (
    <div className="mx-auto max-w-5xl px-4 pt-8 sm:px-8 sm:pt-12">
      <div className="mb-6 flex items-center gap-4">
        <GameArt game={game} size={48} />
        <div className="min-w-0">
          <p className="label">Your lists</p>
          <h1 className="mt-0.5 truncate text-[1.5rem] font-extrabold tracking-[-0.035em] text-ink">
            {game.name}
          </h1>
        </div>
      </div>

      <p className="measure mb-7 text-[0.9375rem] leading-relaxed text-ink-soft">
        Matching runs on these two lists. When somebody offers what you want and
        wants what you have, that is a reciprocal match — and it is ranked above
        everything else.
      </p>

      {profile ? (
        <InventoryEditor
          gameSlug={slug}
          gameName={game.shortName}
          // Inventory feeds matching, and matching leads to a trade, so a row
          // the game will not let players swap has no business being in here.
          catalog={catalog.filter((i) => i.tradeable !== false)}
          initial={await readInventory(slug)}
        />
      ) : (
        <div className="glass-quiet rounded-[var(--radius-panel)] px-6 py-14 text-center">
          <p className="text-[1.0625rem] font-bold tracking-[-0.02em] text-ink">
            Sign in to build your lists
          </p>
          <p className="measure mx-auto mt-2 text-[0.875rem] leading-relaxed text-ink-mute">
            Your lists are private — nobody else can read them. They exist so
            MintPlaza can find the people whose lists point back at yours.
          </p>
          <Link href={`/login?next=/app/${slug}/inventory`} className="pill pill-mint mt-7 py-2.5">
            Sign in
          </Link>
        </div>
      )}
    </div>
  );
}
