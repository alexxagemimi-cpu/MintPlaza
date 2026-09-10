import Link from "next/link";
import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { getGame, getGames } from "@/lib/data/games";
import { readMyProfile } from "@/lib/data/profile";
import { Profile, type GameChip } from "@/components/Profile";
import { touchPresence } from "@/lib/actions/board";
import { PROOFS_WANTED } from "@/lib/profile";

/**
 * Your own profile.
 *
 * Lives under the current game like every other tab, but what it shows is not
 * scoped to it: a player is one person across the whole site, and splitting
 * their deals into six unrelated totals would make every one of them look like
 * a beginner. Only the Proofs picker starts on the game you are in, because
 * that is the one part of the page that genuinely is per-game.
 */

export async function generateMetadata(): Promise<Metadata> {
  return { title: "Your profile" };
}

export default async function MyProfilePage({
  params,
}: {
  params: Promise<{ game: string }>;
}) {
  const slug = (await params).game;
  const game = await getGame(slug);
  if (!game) notFound();

  await touchPresence();

  const [profile, games] = await Promise.all([readMyProfile(), getGames()]);

  if (!profile) {
    return (
      <div className="mx-auto max-w-3xl px-4 pt-8 sm:px-8 sm:pt-12">
        <div className="glass-quiet rounded-[var(--radius-panel)] px-6 py-14 text-center">
          <p className="text-[1.0625rem] font-bold tracking-[-0.02em] text-ink">
            Sign in to set up your profile
          </p>
          <p className="measure mx-auto mt-2 text-[0.875rem] leading-relaxed text-ink-mute">
            A profile is how somebody decides whether to take your raid. Post{" "}
            {PROOFS_WANTED} pictures of your account in-game, say when you are usually
            on, and the rest fills itself in as you use the boards.
          </p>
          <Link href={`/login?next=/app/${slug}/profile`} className="pill pill-mint mt-7 py-2.5">
            Sign in
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
