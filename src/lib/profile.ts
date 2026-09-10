import { SUPABASE_URL } from "@/lib/supabase/config";

/**
 * What a profile is, and what it is careful never to claim.
 *
 * ---------------------------------------------------------------------------
 * The word this file will not use
 * ---------------------------------------------------------------------------
 *
 * Not "verified". Not a tick, not a badge, not a shield.
 *
 * A player uploads a screenshot of their in-game profile. MintPlaza cannot
 * check it — a screenshot can be borrowed from a YouTube thumbnail, edited in
 * a phone gallery app, or taken on a friend's account — and a site that stamps
 * something it did not check with a badge has not built trust, it has built a
 * lie that is now wearing the site's own colours. The next scammer to post
 * three pictures gets handed that badge, and the player who believed it gets
 * hurt worse than if the badge had never existed.
 *
 * So the interface says what actually happened: this player has shown three
 * pictures of their account, MintPlaza has not checked them, and looking at
 * them is your job. That is the same standing a screenshot has in a Discord
 * trade channel, which is what everybody reading it already knows how to
 * judge. It is worth something — a person who posts three has staked their
 * account's reputation on them, and one who posts none has staked nothing —
 * and it is worth exactly that much and no more.
 *
 * ---------------------------------------------------------------------------
 * Why the numbers are separate from the words
 * ---------------------------------------------------------------------------
 *
 * Everything on a profile falls into one of two piles: what a player typed,
 * and what the site counted. The description, the tags and the pictures are
 * the first. The deals, the lists, the contacts and what they keep coming back
 * to are the second — nobody can type those, they are incremented by database
 * triggers off the board itself, and they are the only part of the page that
 * survives contact with somebody trying to look better than they are.
 *
 * The layout keeps that split visible rather than blending the two into one
 * flattering summary.
 */

/* ------------------------------------------------------------------ */
/* The shape a profile arrives in                                      */
/* ------------------------------------------------------------------ */

export interface ProofView {
  id: string;
  gameSlug: string;
  /** A path inside the `proofs` bucket. Never a URL from anywhere else. */
  storagePath: string;
  caption: string | null;
  sortOrder: number;
  createdAt: string;
}

export interface TallyRow {
  gameSlug: string;
  serviceId: string;
  times: number;
}

export interface ProfileStats {
  listsPosted: number;
  dealsDone: number;
  contacts: number;
  proofs: number;
}

export interface ProfileView {
  id: string;
  username: string;
  displayName: string | null;
  avatarUrl: string | null;
  bio: string | null;
  joinedAt: string;
  /** Null when they have gone invisible, so the setting means what it says. */
  lastSeenAt: string | null;
  isMe: boolean;
  gameTags: string[];
  tags: string[];
  stats: ProfileStats;
  top: TallyRow[];
  proofs: ProofView[];
}

/* ------------------------------------------------------------------ */
/* The rules, kept here so the form can say them before the round trip */
/* ------------------------------------------------------------------ */

/**
 * How many pictures the site asks for, per game.
 *
 * Three, and the number is not arbitrary. One picture proves nothing — anybody
 * can find one. Three of the same account, taken together, are awkward to fake
 * and easy to cross-read: the same username in the corner of all three, the
 * same level, the same inventory. It is the smallest number that is actually
 * worth looking at.
 */
export const PROOFS_WANTED = 3;

/** The most any one game will hold. A profile is not an album. */
export const PROOFS_MAX_PER_GAME = 6;

export const BIO_MAX = 240;
export const TAGS_MAX = 6;
export const GAME_TAGS_MAX = 8;
export const TAG_MIN_LENGTH = 2;
export const TAG_MAX_LENGTH = 20;
export const CAPTION_MAX = 120;

export const PROOF_MAX_BYTES = 3 * 1024 * 1024;
export const PROOF_TYPES = ["image/png", "image/jpeg", "image/webp"] as const;

/** Whitespace collapsed, edges trimmed — the same normalising the database does. */
export function normalizeTag(raw: string): string {
  return raw.trim().replace(/\s+/g, " ");
}

/**
 * Why a tag will be refused, in the words the player should read.
 *
 * The database refuses the same things and is what actually enforces them.
 * This exists so the answer arrives while they are still typing rather than
 * after a round trip, and the two must agree — if you change one, change both.
 */
export function tagProblem(raw: string): string | null {
  const tag = normalizeTag(raw);
  if (!tag) return "Type something first.";
  if (tag.length < TAG_MIN_LENGTH) return "A little longer than that.";
  if (tag.length > TAG_MAX_LENGTH) return `Tags stop at ${TAG_MAX_LENGTH} characters.`;
  if (!/^[A-Za-z0-9][A-Za-z0-9 '\-+&.!]*$/.test(tag)) {
    return "Letters, numbers and spaces only.";
  }
  return null;
}

/** Why a description will be refused. Mirrors save_profile(). */
export function bioProblem(raw: string): string | null {
  const bio = raw.trim();
  if (bio.length > BIO_MAX) return `That is ${bio.length - BIO_MAX} characters too long.`;
  if (/(https?:\/\/|www\.|discord\.(gg|com)|t\.me\/|\.gg\/|\.com\/|\.net\/)/i.test(bio)) {
    return "No links here. Say it in words instead.";
  }
  return null;
}

/**
 * Tags worth offering, so the box is not a blank stare.
 *
 * Every one of these is something a player would actually want to know about
 * somebody before joining a raid with them, and none of them is a claim the
 * site would be endorsing. There is deliberately nothing here like "trusted"
 * or "legit" — a tag a player types about themselves is not evidence, and
 * offering those words as a suggestion would be the site putting them there.
 */
export const TAG_SUGGESTIONS = [
  "Active daily",
  "Evenings only",
  "Weekends only",
  "Beginner friendly",
  "Happy to teach",
  "Raid lead",
  "Grinder",
  "Trades often",
  "Quiet, no mic",
  "Voice chat fine",
] as const;

/* ------------------------------------------------------------------ */
/* Reading a profile                                                   */
/* ------------------------------------------------------------------ */

/** The public URL of a proof picture. Built here so nothing else guesses it. */
export function proofUrl(storagePath: string): string {
  return `${SUPABASE_URL}/storage/v1/object/public/proofs/${storagePath}`;
}

/** The proofs for one game, in the order the player put them in. */
export function proofsFor(profile: ProfileView, gameSlug: string): ProofView[] {
  return profile.proofs
    .filter((p) => p.gameSlug === gameSlug)
    .sort((a, b) => a.sortOrder - b.sortOrder || a.createdAt.localeCompare(b.createdAt));
}

/**
 * What the count of pictures for one game entitles the page to say.
 *
 * Three states, and none of them is a badge. `tone` drives the colour, and the
 * strongest one available is a neutral mint — the same treatment a finished
 * checklist gets, not the treatment a verification tick gets.
 */
export function proofStanding(count: number): {
  title: string;
  detail: string;
  tone: "none" | "part" | "full";
} {
  if (count === 0) {
    return {
      title: "Nothing shown yet",
      detail: `Post ${PROOFS_WANTED} pictures of this account in-game and people can see who they are dealing with.`,
      tone: "none",
    };
  }
  if (count < PROOFS_WANTED) {
    return {
      title: `${count} of ${PROOFS_WANTED} shown`,
      detail: `${PROOFS_WANTED - count} more and this reads as a real account rather than a new one.`,
      tone: "part",
    };
  }
  return {
    title: `${count} pictures shown`,
    detail: "MintPlaza has not checked these. Read them yourself before you deal.",
    tone: "full",
  };
}

/** "joined in March" — a month, never a date. A date is one more fact about a kid. */
export function joinedLabel(iso: string): string {
  const then = new Date(iso);
  if (Number.isNaN(then.getTime())) return "";
  const now = new Date();
  const months =
    (now.getFullYear() - then.getFullYear()) * 12 + (now.getMonth() - then.getMonth());
  if (months <= 0) return "joined this month";
  if (months === 1) return "joined last month";
  if (months < 12) return `${months} months here`;
  const years = Math.floor(months / 12);
  return years === 1 ? "a year here" : `${years} years here`;
}

/** Online means seen in the last ten minutes, matching the dot on the boards. */
export function isOnline(lastSeenAt: string | null): boolean {
  if (!lastSeenAt) return false;
  const seen = new Date(lastSeenAt).getTime();
  return Number.isFinite(seen) && Date.now() - seen < 10 * 60_000;
}
