import type { Voter } from "@/lib/sessions";

/**
 * The faces of everyone who voted on a listing.
 *
 * A count alone ("41 votes") says how many; faces say who, and on a board where
 * you are deciding whether to spend an hour helping a stranger, who matters
 * more. Three faces then "+38" is enough — beyond that it is a crowd either
 * way, and more circles just cost width on a phone.
 *
 * Avatars come from Roblox once a real account has signed in. Until then a
 * lettered circle stands in. It never invents a face: putting a real person's
 * avatar on demo activity would be exactly the fake the specification forbids.
 */

const MAX_FACES = 3;

function Face({ voter, index }: { voter: Voter; index: number }) {
  let h = 0;
  for (let i = 0; i < voter.username.length; i++) {
    h = (h * 31 + voter.username.charCodeAt(i)) % 360;
  }

  return (
    <span
      title={`${voter.username}${voter.online ? " — online now" : ""}`}
      className="relative -ml-2 first:ml-0"
      style={{ zIndex: MAX_FACES - index }}
    >
      <span
        className="grid h-[26px] w-[26px] place-items-center overflow-hidden rounded-full text-[0.5625rem] font-bold"
        style={{
          color: `hsl(${h} 42% 30%)`,
          background: `hsl(${h} 46% 92%)`,
          // The ring is the page colour, so overlapping circles read as
          // separate discs rather than one blob.
          boxShadow: "0 0 0 2px var(--surface)",
        }}
      >
        {voter.avatarUrl ? (
          /* eslint-disable-next-line @next/next/no-img-element */
          <img src={voter.avatarUrl} alt="" className="h-full w-full object-cover" />
        ) : (
          voter.username.slice(0, 2).toUpperCase()
        )}
      </span>
      {voter.online && (
        <span
          aria-hidden="true"
          className="absolute -bottom-px -right-px h-[9px] w-[9px] rounded-full bg-mint"
          style={{ boxShadow: "0 0 0 2px var(--surface)" }}
        />
      )}
    </span>
  );
}

export function VoterStack({
  voters, total, online,
}: {
  /** A sample, for the faces. The server never sends them all. */
  voters: readonly Voter[];
  /** Everyone who voted, including the ones not sent. */
  total: number;
  /** How many of them are here right now. */
  online: number;
}) {
  if (total === 0) {
    return (
      <span className="font-mono text-[0.5625rem] tracking-[0.07em] text-ink-faint">
        NO VOTES YET
      </span>
    );
  }

  const shown = voters.slice(0, MAX_FACES);
  const rest = total - shown.length;

  return (
    <span className="flex items-center gap-1.5">
      <span className="flex items-center">
        {shown.map((v, i) => <Face key={v.username} voter={v} index={i} />)}
      </span>
      {rest > 0 && (
        <span className="font-mono text-[0.6875rem] font-bold tabular-nums text-ink-mute">
          +{rest}
        </span>
      )}
      {online > 0 && (
        <span
          title={`${online} of them online now`}
          className="font-mono text-[0.5625rem] tracking-[0.07em] text-mint"
        >
          {online} ON
        </span>
      )}
    </span>
  );
}

/** A green dot for somebody who is on MintPlaza right now. */
export function OnlineDot({ online }: { online: boolean }) {
  if (!online) return null;
  return (
    <span
      title="On MintPlaza right now"
      aria-label="Online now"
      className="inline-block h-[7px] w-[7px] shrink-0 rounded-full bg-mint"
    />
  );
}
