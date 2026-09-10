"use client";

import { useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { useFindTemplate } from "@/components/TemplateProvider";
import { ReportButton } from "@/components/ReportButton";
import { saveProfile, uploadProof, deleteProof } from "@/lib/actions/profile";
import {
  BIO_MAX, CAPTION_MAX, GAME_TAGS_MAX, PROOFS_MAX_PER_GAME, PROOFS_WANTED,
  TAGS_MAX, TAG_SUGGESTIONS, bioProblem, isOnline, joinedLabel, normalizeTag,
  proofStanding, proofUrl, proofsFor, tagProblem,
  type ProfileView,
} from "@/lib/profile";

/**
 * A player's profile.
 *
 * Two halves, and the page never lets them blur into each other.
 *
 * The top half is what the player says: a picture, a name, a line about
 * themselves, the games they play, a few tags. None of it is evidence and the
 * page does not pretend otherwise — it is there so a stranger deciding whether
 * to join your raid has something human to read.
 *
 * The bottom half is what the site counted: deals finished, lists posted,
 * contacts kept, and the raids this person keeps coming back to. Nobody typed
 * those. They are incremented by triggers on the board, they survive the
 * listing being deleted, and they are the only numbers here that a person
 * trying to look better than they are cannot touch. The page says so under
 * them, in one line, because a number nobody explains is a number everybody
 * assumes was typed.
 *
 * Proofs sit last, and are the reason the page exists. Read the long note in
 * lib/profile.ts for why the word "verified" appears nowhere on this screen.
 */

export interface GameChip {
  slug: string;
  name: string;
  shortName: string;
  art: string;
  hue: string;
}

/* ------------------------------------------------------------------ */

function Avatar({ url, name, size = 84 }: { url: string | null; name: string; size?: number }) {
  return (
    <span
      className="relative grid shrink-0 place-items-center overflow-hidden rounded-full bg-sunk text-ink-mute"
      style={{ width: size, height: size, fontSize: size * 0.36 }}
    >
      {url ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={url} alt="" className="h-full w-full object-cover" />
      ) : (
        <span className="font-bold">{name.slice(0, 1).toUpperCase()}</span>
      )}
      <span
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 rounded-full"
        style={{ boxShadow: "inset 0 0 0 1px rgba(13,22,19,0.12)" }}
      />
    </span>
  );
}

function GameTag({ game }: { game: GameChip }) {
  return (
    <span className="flex items-center gap-2 rounded-full bg-surface py-1 pl-1 pr-3 text-[0.8125rem] font-semibold text-ink shadow-[inset_0_0_0_1px_var(--color-line)]">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={game.art} alt="" className="h-6 w-6 rounded-full object-cover" />
      {game.shortName}
    </span>
  );
}

function Stat({ value, label }: { value: number; label: string }) {
  return (
    <div className="rounded-[var(--radius-tile)] bg-sunk px-3 py-3.5 text-center">
      <p className="numeral text-[1.375rem] font-extrabold tracking-[-0.03em] text-ink">
        {value.toLocaleString()}
      </p>
      <p className="mt-0.5 text-[0.6875rem] font-semibold uppercase tracking-[0.06em] text-ink-mute">
        {label}
      </p>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Proofs                                                              */
/* ------------------------------------------------------------------ */

function ProofsSection({
  profile, games, initialGame,
}: {
  profile: ProfileView;
  games: readonly GameChip[];
  initialGame: string;
}) {
  const router = useRouter();
  const [slug, setSlug] = useState(
    () => (games.some((g) => g.slug === initialGame) ? initialGame : games[0]?.slug) ?? "",
  );
  const [open, setOpen] = useState(false);
  const [caption, setCaption] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, start] = useTransition();
  const fileInput = useRef<HTMLInputElement>(null);

  const game = games.find((g) => g.slug === slug);
  const shown = proofsFor(profile, slug);
  const standing = proofStanding(shown.length);
  const full = shown.length >= PROOFS_MAX_PER_GAME;

  function pick(file: File) {
    setError(null);
    const form = new FormData();
    form.set("file", file);
    form.set("gameSlug", slug);
    form.set("caption", caption);
    start(async () => {
      const result = await uploadProof(form);
      if (!result.ok) { setError(result.error); return; }
      setCaption("");
      router.refresh();
    });
  }

  function remove(id: string) {
    setError(null);
    start(async () => {
      const result = await deleteProof(id);
      if (!result.ok) { setError(result.error); return; }
      router.refresh();
    });
  }

  if (!game) return null;

  return (
    <section className="mt-8">
      <div className="mb-3 flex items-baseline justify-between gap-3">
        <h2 className="text-[1.0625rem] font-extrabold tracking-[-0.025em] text-ink">Proofs</h2>
        <p className="text-[0.75rem] text-ink-mute">{profile.stats.proofs} across all games</p>
      </div>

      <p className="measure mb-4 text-[0.875rem] leading-relaxed text-ink-soft">
        {profile.isMe
          ? `Post ${PROOFS_WANTED} screenshots of your in-game profile for a game you play. MintPlaza does not check them — what they do is let the person on the other side of a deal see the account they are dealing with, the same way they would ask in a Discord.`
          : `Screenshots this player posted of their own in-game profile. MintPlaza has not checked them and cannot. Read them yourself: the username in the corner should match, and three pictures of the same account should agree with each other.`}
      </p>

      {/* The picker. One card-shaped button, the size of a tab, because the
          question it answers — which game are we talking about — is the only
          thing standing between a player and posting their first picture. */}
      <div className="relative">
        <button
          type="button"
          onClick={() => setOpen((v) => !v)}
          aria-expanded={open}
          className="flex w-full items-center gap-3.5 rounded-[var(--radius-inner)] border border-line bg-surface p-3 text-left transition-colors hover:bg-sunk"
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={game.art} alt="" className="h-12 w-12 shrink-0 rounded-[14px] object-cover" />
          <span className="min-w-0 flex-1">
            <span className="block truncate text-[0.9375rem] font-bold tracking-[-0.015em] text-ink">
              {game.name}
            </span>
            <span
              className={`mt-0.5 block truncate text-[0.8125rem] font-semibold ${
                standing.tone === "full" ? "text-mint" : "text-ink-mute"
              }`}
            >
              {standing.title}
            </span>
          </span>
          <svg
            width="18" height="18" viewBox="0 0 20 20" fill="none" stroke="currentColor"
            strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"
            className={`shrink-0 text-ink-faint transition-transform ${open ? "rotate-180" : ""}`}
            aria-hidden="true"
          >
            <path d="m5.5 8 4.5 4.5L14.5 8" />
          </svg>
        </button>

        {open && (
          <div className="glass-overlay absolute inset-x-0 top-[calc(100%+6px)] z-20 max-h-[19rem] overflow-y-auto rounded-[var(--radius-inner)] p-1.5">
            {games.map((g) => {
              const count = proofsFor(profile, g.slug).length;
              return (
                <button
                  key={g.slug}
                  type="button"
                  onClick={() => { setSlug(g.slug); setOpen(false); setError(null); }}
                  className={`flex w-full items-center gap-3 rounded-[13px] p-2 text-left transition-colors ${
                    g.slug === slug ? "bg-mint-wash" : "hover:bg-fill"
                  }`}
                >
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={g.art} alt="" className="h-9 w-9 shrink-0 rounded-[11px] object-cover" />
                  <span className="min-w-0 flex-1 truncate text-[0.875rem] font-semibold text-ink">
                    {g.shortName}
                  </span>
                  <span className="shrink-0 text-[0.75rem] font-semibold text-ink-mute">
                    {count === 0 ? "none yet" : `${count} shown`}
                  </span>
                </button>
              );
            })}
          </div>
        )}
      </div>

      <p
        className={`mt-3 text-[0.8125rem] leading-relaxed ${
          standing.tone === "full" ? "text-ink-soft" : "text-ink-mute"
        }`}
      >
        {standing.detail}
      </p>

      {shown.length > 0 && (
        <ul className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-3">
          {shown.map((proof) => (
            <li key={proof.id} className="group relative">
              <a
                href={proofUrl(proof.storagePath)}
                target="_blank"
                rel="noopener noreferrer"
                className="block overflow-hidden rounded-[var(--radius-tile)] border border-line bg-sunk"
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={proofUrl(proof.storagePath)}
                  alt={proof.caption ?? `Screenshot ${profile.username} posted`}
                  loading="lazy"
                  className="aspect-[4/3] w-full object-cover"
                />
              </a>
              {proof.caption && (
                <p className="mt-1.5 line-clamp-2 text-[0.75rem] leading-snug text-ink-mute">
                  {proof.caption}
                </p>
              )}
              {profile.isMe && (
                <button
                  type="button"
                  onClick={() => remove(proof.id)}
                  disabled={busy}
                  aria-label="Remove this picture"
                  className="absolute right-1.5 top-1.5 grid h-7 w-7 place-items-center rounded-full bg-surface text-ink-mute shadow-sm transition-colors hover:text-bad disabled:opacity-50"
                >
                  <svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" aria-hidden="true">
                    <path d="m4 4 8 8M12 4l-8 8" />
                  </svg>
                </button>
              )}
            </li>
          ))}
        </ul>
      )}

      {profile.isMe && (
        <div className="mt-4 rounded-[var(--radius-inner)] bg-sunk p-3.5">
          <p className="text-[0.8125rem] font-semibold text-ink">
            Add a picture of your {game.shortName} profile
          </p>
          {/* Said every time rather than once, because the person who most
              needs to read it is the one posting in a hurry. */}
          <p className="measure mt-1 text-[0.75rem] leading-relaxed text-ink-mute">
            Crop out anything that is not the game — no real name, no age, no school,
            no messages from other people. Anyone can see these.
          </p>

          <input
            value={caption}
            onChange={(e) => setCaption(e.target.value.slice(0, CAPTION_MAX))}
            placeholder="What it shows — level, fruits, inventory (optional)"
            className="mt-3 w-full rounded-[12px] border border-line bg-surface px-3 py-2 text-[0.875rem] text-ink placeholder:text-ink-faint"
          />

          <input
            ref={fileInput}
            type="file"
            accept="image/png,image/jpeg,image/webp"
            className="hidden"
            onChange={(e) => {
              const file = e.target.files?.[0];
              // Cleared straight away so choosing the same file twice still fires.
              e.target.value = "";
              if (file) pick(file);
            }}
          />

          <div className="mt-3 flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={() => fileInput.current?.click()}
              disabled={busy || full}
              className="pill pill-mint py-2 disabled:opacity-50"
            >
              {busy ? "Posting…" : "Choose a screenshot"}
            </button>
            <span className="text-[0.75rem] text-ink-mute">
              {full
                ? `${PROOFS_MAX_PER_GAME} is the most for one game.`
                : "PNG, JPG or WEBP, up to 3 MB."}
            </span>
          </div>
        </div>
      )}

      {error && (
        <p role="alert" className="mt-3 text-[0.8125rem] font-semibold text-bad">{error}</p>
      )}
    </section>
  );
}

/* ------------------------------------------------------------------ */
/* Editing                                                             */
/* ------------------------------------------------------------------ */

function EditForm({
  profile, games, onDone,
}: {
  profile: ProfileView;
  games: readonly GameChip[];
  onDone: () => void;
}) {
  const router = useRouter();
  const [bio, setBio] = useState(profile.bio ?? "");
  const [picked, setPicked] = useState<string[]>(profile.gameTags);
  const [tags, setTags] = useState<string[]>(profile.tags);
  const [draft, setDraft] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, start] = useTransition();

  const bioIssue = bio.trim() ? bioProblem(bio) : null;

  function toggleGame(slug: string) {
    setPicked((current) =>
      current.includes(slug)
        ? current.filter((s) => s !== slug)
        : current.length >= GAME_TAGS_MAX
          ? current
          : [...current, slug],
    );
  }

  function addTag(raw: string) {
    const tag = normalizeTag(raw);
    const issue = tagProblem(tag);
    if (issue) { setError(issue); return; }
    if (tags.length >= TAGS_MAX) { setError(`${TAGS_MAX} tags is the most.`); return; }
    if (tags.some((t) => t.toLowerCase() === tag.toLowerCase())) { setDraft(""); return; }
    setTags([...tags, tag]);
    setDraft("");
    setError(null);
  }

  function submit() {
    setError(null);
    start(async () => {
      const result = await saveProfile({ bio, games: picked, tags });
      if (!result.ok) { setError(result.error); return; }
      onDone();
      router.refresh();
    });
  }

  return (
    <div className="mt-5 rounded-[var(--radius-inner)] border border-line bg-surface p-4">
      <label className="label" htmlFor="profile-bio">About you</label>
      <textarea
        id="profile-bio"
        value={bio}
        onChange={(e) => setBio(e.target.value.slice(0, BIO_MAX))}
        rows={3}
        placeholder="What you play, when you are usually on, what you are looking for."
        className="mt-1.5 w-full resize-none rounded-[12px] border border-line bg-page px-3 py-2.5 text-[0.9375rem] leading-relaxed text-ink placeholder:text-ink-faint"
      />
      <div className="mt-1 flex items-center justify-between gap-3">
        <p className="text-[0.75rem] text-bad">{bioIssue ?? ""}</p>
        <p className="shrink-0 text-[0.75rem] tabular-nums text-ink-faint">
          {bio.trim().length}/{BIO_MAX}
        </p>
      </div>

      <p className="label mt-5">Games you play</p>
      <div className="mt-2 flex flex-wrap gap-2">
        {games.map((g) => {
          const on = picked.includes(g.slug);
          return (
            <button
              key={g.slug}
              type="button"
              onClick={() => toggleGame(g.slug)}
              aria-pressed={on}
              className={`flex items-center gap-2 rounded-full py-1 pl-1 pr-3 text-[0.8125rem] font-semibold transition-colors ${
                on
                  ? "bg-mint-wash text-mint shadow-[inset_0_0_0_1px_var(--color-mint)]"
                  : "bg-surface text-ink-soft shadow-[inset_0_0_0_1px_var(--color-line)] hover:bg-sunk"
              }`}
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={g.art} alt="" className="h-6 w-6 rounded-full object-cover" />
              {g.shortName}
            </button>
          );
        })}
      </div>

      <p className="label mt-5">Your own tags</p>
      <p className="mt-1 text-[0.75rem] leading-relaxed text-ink-mute">
        Up to {TAGS_MAX}, and they sit next to your name — so they are worth what a
        stranger thinks they are worth. Nothing here is checked by MintPlaza.
      </p>

      {tags.length > 0 && (
        <div className="mt-2.5 flex flex-wrap gap-2">
          {tags.map((tag) => (
            <span
              key={tag}
              className="flex items-center gap-1.5 rounded-full bg-fill py-1 pl-3 pr-1.5 text-[0.8125rem] font-semibold text-ink"
            >
              {tag}
              <button
                type="button"
                onClick={() => setTags(tags.filter((t) => t !== tag))}
                aria-label={`Remove ${tag}`}
                className="grid h-5 w-5 place-items-center rounded-full text-ink-mute hover:text-ink"
              >
                <svg width="11" height="11" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true">
                  <path d="m4 4 8 8M12 4l-8 8" />
                </svg>
              </button>
            </span>
          ))}
        </div>
      )}

      <div className="mt-2.5 flex gap-2">
        <input
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") { e.preventDefault(); addTag(draft); }
          }}
          placeholder="Active daily"
          maxLength={40}
          className="min-w-0 flex-1 rounded-[12px] border border-line bg-page px-3 py-2 text-[0.875rem] text-ink placeholder:text-ink-faint"
        />
        <button
          type="button"
          onClick={() => addTag(draft)}
          disabled={!draft.trim() || tags.length >= TAGS_MAX}
          className="pill pill-ghost shrink-0 py-2 disabled:opacity-40"
        >
          Add
        </button>
      </div>

      {tags.length < TAGS_MAX && (
        <div className="mt-2.5 flex flex-wrap gap-1.5">
          {TAG_SUGGESTIONS.filter(
            (s) => !tags.some((t) => t.toLowerCase() === s.toLowerCase()),
          ).slice(0, 6).map((s) => (
            <button
              key={s}
              type="button"
              onClick={() => addTag(s)}
              className="rounded-full bg-sunk px-2.5 py-1 text-[0.75rem] font-semibold text-ink-soft transition-colors hover:bg-fill"
            >
              + {s}
            </button>
          ))}
        </div>
      )}

      {error && <p role="alert" className="mt-4 text-[0.8125rem] font-semibold text-bad">{error}</p>}

      <div className="mt-5 flex flex-wrap gap-2">
        <button
          type="button"
          onClick={submit}
          disabled={busy || bioIssue !== null}
          className="pill pill-primary py-2.5 disabled:opacity-50"
        >
          {busy ? "Saving…" : "Submit changes"}
        </button>
        <button type="button" onClick={onDone} disabled={busy} className="pill pill-ghost py-2.5">
          Cancel
        </button>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */

export function Profile({
  profile, games, gameSlug,
}: {
  profile: ProfileView;
  games: readonly GameChip[];
  gameSlug: string;
}) {
  const [editing, setEditing] = useState(false);
  const findTemplate = useFindTemplate();

  const online = isOnline(profile.lastSeenAt);
  const tagged = profile.gameTags
    .map((slug) => games.find((g) => g.slug === slug))
    .filter((g): g is GameChip => Boolean(g));

  return (
    <div className="mx-auto max-w-3xl px-4 pt-8 sm:px-8 sm:pt-12">
      {/* ---- who ---- */}
      <div className="flex items-start gap-4 sm:gap-5">
        <Avatar url={profile.avatarUrl} name={profile.username} />
        <div className="min-w-0 flex-1">
          <h1 className="truncate text-[1.5rem] font-extrabold tracking-[-0.035em] text-ink">
            {profile.displayName || profile.username}
          </h1>
          <p className="mt-0.5 flex flex-wrap items-center gap-x-2 gap-y-0.5 text-[0.875rem] text-ink-mute">
            {/* The Roblox name is always shown beside the display name. It is
                the only name another player can go and check. */}
            <span className="font-semibold text-ink-soft">@{profile.username}</span>
            {online && (
              <span className="flex items-center gap-1 font-semibold text-mint">
                <span aria-hidden="true" className="h-1.5 w-1.5 rounded-full bg-mint-vivid" />
                online
              </span>
            )}
            <span>{joinedLabel(profile.joinedAt)}</span>
          </p>
        </div>
        <div className="shrink-0">
          {profile.isMe ? (
            !editing && (
              <button type="button" onClick={() => setEditing(true)} className="pill pill-ghost py-2">
                Edit profile
              </button>
            )
          ) : (
            <ReportButton what="player" subject={profile.username} subjectId={profile.id} />
          )}
        </div>
      </div>

      {editing ? (
        <EditForm profile={profile} games={games} onDone={() => setEditing(false)} />
      ) : (
        <>
          {profile.bio ? (
            <p className="measure mt-5 text-[0.9375rem] leading-relaxed text-ink-soft">
              {profile.bio}
            </p>
          ) : profile.isMe ? (
            <p className="measure mt-5 text-[0.9375rem] leading-relaxed text-ink-mute">
              You have not written anything about yourself yet. A line about when you
              are on and what you play does more for a raid invite than anything else
              on this page.
            </p>
          ) : null}

          {(tagged.length > 0 || profile.tags.length > 0) && (
            <div className="mt-4 flex flex-wrap gap-2">
              {tagged.map((g) => <GameTag key={g.slug} game={g} />)}
              {profile.tags.map((tag) => (
                <span
                  key={tag}
                  className="rounded-full bg-fill px-3 py-1.5 text-[0.8125rem] font-semibold text-ink-soft"
                >
                  {tag}
                </span>
              ))}
            </div>
          )}
        </>
      )}

      {/* ---- what the site counted ---- */}
      <section className="mt-8">
        <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-4">
          <Stat value={profile.stats.dealsDone} label="Deals done" />
          <Stat value={profile.stats.listsPosted} label="Lists posted" />
          <Stat value={profile.stats.contacts} label="Contacts" />
          <Stat value={profile.stats.proofs} label="Pictures shown" />
        </div>
        <p className="mt-2 text-[0.75rem] leading-relaxed text-ink-faint">
          Counted by MintPlaza off the boards. Nobody can type these in.
        </p>
      </section>

      {/* ---- what they keep doing ---- */}
      {profile.top.length > 0 && (
        <section className="mt-8">
          <h2 className="text-[1.0625rem] font-extrabold tracking-[-0.025em] text-ink">
            {profile.isMe ? "What you keep doing" : "What they keep doing"}
          </h2>
          <ul className="mt-3 overflow-hidden rounded-[var(--radius-inner)] border border-line bg-surface">
            {profile.top.map((row) => {
              const template = findTemplate(row.serviceId);
              const game = games.find((g) => g.slug === row.gameSlug);
              return (
                <li
                  key={`${row.gameSlug}-${row.serviceId}`}
                  className="flex items-center gap-3 border-b border-line-soft px-3.5 py-3 last:border-b-0"
                >
                  {game && (
                    /* eslint-disable-next-line @next/next/no-img-element */
                    <img src={game.art} alt="" className="h-8 w-8 shrink-0 rounded-[10px] object-cover" />
                  )}
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-[0.9375rem] font-semibold text-ink">
                      {/* A retired template still has to render as what it was,
                          or a profile ages into a list of ids. */}
                      {template?.name ?? row.serviceId}
                    </span>
                    {game && (
                      <span className="block truncate text-[0.75rem] text-ink-mute">
                        {game.shortName}
                      </span>
                    )}
                  </span>
                  <span className="numeral shrink-0 text-[0.875rem] font-bold text-ink-soft">
                    {row.times}×
                  </span>
                </li>
              );
            })}
          </ul>
        </section>
      )}

      {/* ---- proofs ---- */}
      <ProofsSection profile={profile} games={games} initialGame={gameSlug} />

      <div className="h-24" />
    </div>
  );
}
