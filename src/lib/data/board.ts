import { readBoard } from "@/lib/actions/board";
import { demoServiceListings } from "@/lib/demo";
import { LIVE_WINDOW_MINUTES, type ServiceListing, type Voter, type ListingComment } from "@/lib/sessions";

/**
 * The board, from the database where there is one and from the example
 * generator where there is not.
 *
 * Both paths produce the same shape, so nothing downstream has to know which it
 * got — except that the example rows carry `isDemo` and the interface badges
 * them. Real listings never claim to be examples and examples never pretend to
 * be real.
 */

interface Row {
  id: string;
  game_slug: string;
  side: "offer" | "request";
  service_ids: string[];
  terms_kind: "free" | "split" | "item";
  terms_item_id: string | null;
  detail: string | null;
  ref_id: string | null;
  stage: "voting" | "requested" | "locked";
  created_at: string;
  expires_at: string;
  vote_count: number;
  voters_online: number;
  you_voted: boolean;
  yours: boolean;
  author: string;
  author_avatar_url: string | null;
  author_online: boolean;
  voters: {
    userId: string; username: string; avatarUrl: string | null;
    online: boolean; votedAt: string; reply: Voter["reply"];
  }[];
  comments: {
    id: string; author: string; avatarUrl: string | null; online: boolean;
    body: string; replyTo: string | null; createdAt: string;
  }[];
}

const minutesSince = (iso: string) =>
  Math.max(0, Math.round((Date.now() - new Date(iso).getTime()) / 60_000));

function toListing(row: Row): ServiceListing {
  const voters: Voter[] = (row.voters ?? []).map((v) => ({
    userId: v.userId,
    username: v.username,
    avatarUrl: v.avatarUrl ?? undefined,
    online: v.online,
    votedMinutesAgo: minutesSince(v.votedAt),
    reply: v.reply,
  }));

  const comments: ListingComment[] = (row.comments ?? []).map((c) => ({
    id: c.id,
    author: c.author,
    avatarUrl: c.avatarUrl ?? undefined,
    online: c.online,
    text: c.body,
    minutesAgo: minutesSince(c.createdAt),
    replyTo: c.replyTo ?? undefined,
  }));

  return {
    // Deliberately absent: this row is real, and the DEMO badge must not
    // appear on it.
    id: row.id,
    gameSlug: row.game_slug,
    side: row.side,
    author: row.author,
    authorAvatarUrl: row.author_avatar_url ?? undefined,
    authorOnline: row.author_online,
    completed: 0,
    serviceIds: row.service_ids,
    terms:
      row.terms_kind === "item" && row.terms_item_id
        ? { kind: "item", itemId: row.terms_item_id }
        : { kind: row.terms_kind === "split" ? "split" : "free" },
    detail: row.detail ?? undefined,
    refId: row.ref_id ?? undefined,
    // The card works in minutes-since-posting, which is what the two-hour
    // window is measured against.
    postedMinutesAgo: Math.max(
      0,
      LIVE_WINDOW_MINUTES - Math.max(0, Math.round(
        (new Date(row.expires_at).getTime() - Date.now()) / 60_000,
      )),
    ),
    taken: row.stage === "locked",
    voters,
    voteCount: row.vote_count,
    votersOnline: row.voters_online,
    stage: row.stage,
    comments,
    youVoted: row.you_voted,
    yours: row.yours,
  };
}

/** Live listings for a game. Falls back to examples when there is no database. */
export async function getBoard(gameSlug: string): Promise<readonly ServiceListing[]> {
  const rows = (await readBoard(gameSlug)) as Row[];
  if (rows.length > 0) return rows.map(toListing);
  return demoServiceListings(gameSlug);
}
