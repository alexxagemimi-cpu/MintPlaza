import Link from "next/link";
import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { getGame, getGames } from "@/lib/data/games";
import { readProfile } from "@/lib/data/profile";
import { Profile, type GameChip } from "@/components/Profile";
import { touchPresence } from "@/lib/actions/board";

/**
 * Somebody else's profile.
 *
 * Reached from a contact, a voter or a comment — never from a search box.
 * There is no way to look a player up by name on MintPlaza, and that is
 * deliberate: a site where anybody can find anybody is a site where somebody
 * hunting for a target can find one.
 */

export async function generateMetadata({
  params,
}: {
  params: Promise<{ username: string }>;
}): Promise<Metadata> {
  const { username } = await params;
  return { title: `${username} on MintPlaza` };
}

export default async function PlayerProfilePage({
  params,
}: {
  params: Promise<{ game: string; username: string }>;
}) {
  const { game: slug, username } = await params;
  const game = await getGame(slug);
  if (!game) notFound();

  await touchPresence();

  const [profile, games] = await Promise.all([
    readProfile(decodeURIComponent(username)),
    getGames(),
  ]);

  if (!profile) {
    return (
      <div className="mx-auto max-w-3xl px-4 pt-8 sm:px-8 sm:pt-12">
        <div className="glass-quiet rounded-[var(--radius-panel)] px-6 py-14 text-center">
          <p className="text-[1.0625rem] font-bold tracking-[-0.02em] text-ink">
            No profile here
          </p>
          <p className="measure mx-auto mt-2 text-[0.875rem] leading-relaxed text-ink-mute">
            Either that player is not on MintPlaza, or their account is no longer
            open. Nothing else is worth reading into it.
          </p>
          <Link href={`/app/${slug}/contacts`} className="pill pill-ghost mt-7 py-2.5">
            Back to contacts
          </Link>
        </div>
      </div>
    );
  }

  const chips: GameChip[] = games.map((g) => ({
    slug: g.slug, name: g.name, shortName: g.shortName, art: g.art, hue: g.hue,
  }));

  return <Profile profile={profile} games={chips} gameSlug={slug} />;
}
