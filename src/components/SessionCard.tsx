import { findItem } from "@/lib/items";
import {
  findActivity, seatsLeft, sessionState, startsCopy, meetsGameMinimum,
  type SessionPost,
} from "@/lib/sessions";

/**
 * A raid, boss run or service somebody is forming.
 *
 * Built like the trade rows next door — compact enough to scan a screenful,
 * opening into the detail — because the job is the same: decide in a second
 * whether this one is for you.
 *
 * What is different is what has to be visible without opening anything. A trade
 * can wait; a raid cannot. So the resting row carries the two facts that decide
 * it: how many seats are left, and how long you have. Everything else can wait
 * until you have decided to look.
 *
 * The requirement line is the point of the whole section. Four players
 * gathering for a Leviathan that will not start for fewer than five is the
 * exact waste this replaces, so the game's own rule is printed on the card and
 * the card says plainly when a group has not met it.
 */

function Avatar({ name }: { name: string }) {
  let h = 0;
  for (let i = 0; i < name.length; i++) h = (h * 31 + name.charCodeAt(i)) % 360;
  return (
    <span
      aria-hidden="true"
      className="grid h-[34px] w-[34px] shrink-0 place-items-center rounded-full text-[0.6875rem] font-bold"
      style={{
        color: `hsl(${h} 42% 32%)`,
        background: `hsl(${h} 46% 93%)`,
        boxShadow: `inset 0 0 0 1px hsl(${h} 40% 82%)`,
      }}
    >
      {name.slice(0, 2).toUpperCase()}
    </span>
  );
}

/** Seats as dots. A party size is small enough to count at a glance. */
function Seats({ filled, total }: { filled: number; total: number }) {
  return (
    <span className="flex items-center gap-1" title={`${filled} of ${total} joined`}>
      {Array.from({ length: total }, (_, i) => (
        <span
          key={i}
          className={`h-[7px] w-[7px] rounded-full ${
            i < filled ? "bg-mint" : "border border-line bg-transparent"
          }`}
        />
      ))}
      <span className="ml-1 font-mono text-[0.625rem] tabular-nums text-ink-mute">
        {filled}/{total}
      </span>
    </span>
  );
}

const KIND_TONE: Record<string, string> = {
  Raid: "#8A5A12", Boss: "#A93226", Trial: "#6B4CA8",
  "Sea event": "#2C6C9E", Grind: "#2F7D57", Event: "#A8501E", Service: "#465650",
};

export function SessionCard({ session }: { session: SessionPost }) {
  const activity = findActivity(session.activityId);
  if (!activity) return null;

  const left = seatsLeft(session);
  const state = sessionState(session);
  const possible = meetsGameMinimum(session);
  const tone = KIND_TONE[activity.kind] ?? "#465650";

  const termsItem =
    session.terms.kind === "item" ? findItem(session.terms.itemId) : undefined;

  return (
    <details className="glass group overflow-hidden rounded-[var(--radius-panel)] [&[open]]:bg-surface">
      <summary className="flex cursor-pointer list-none items-center gap-2.5 px-3 py-2.5 marker:hidden [&::-webkit-details-marker]:hidden">
        <Avatar name={session.host} />

        <span className="min-w-0 flex-1">
          <span className="flex items-center gap-1.5">
            <span className="min-w-0 truncate text-[0.8125rem] font-bold tracking-[-0.015em] text-ink">
              {activity.name}
            </span>
            <span
              className="shrink-0 rounded-[5px] px-1.5 py-0.5 font-mono text-[0.5rem] font-medium tracking-[0.07em]"
              style={{ color: tone, background: `${tone}14` }}
            >
              {activity.kind.toUpperCase()}
            </span>
            <span className="shrink-0 rounded-[5px] border border-warn/30 bg-warn-wash px-1.5 py-0.5 font-mono text-[0.5rem] font-medium tracking-[0.07em] text-warn">
              DEMO
            </span>
          </span>

          <span className="mt-1 flex items-center gap-2.5">
            <Seats filled={session.slotsFilled} total={session.slotsTotal} />
            <span
              className={`font-mono text-[0.625rem] tracking-[0.06em] ${
                state === "starting" ? "font-bold text-mint" : "text-ink-faint"
              }`}
            >
              {startsCopy(session).toUpperCase()}
            </span>
            <span className="ml-auto shrink-0">
              {state === "full" ? (
                <span className="rounded-full bg-fill px-2 py-0.5 font-mono text-[0.5625rem] font-bold tracking-[0.08em] text-ink-mute">
                  FULL
                </span>
              ) : (
                <span className="rounded-full bg-mint-wash px-2 py-0.5 font-mono text-[0.5625rem] font-bold tracking-[0.08em] text-mint">
                  {left} SEAT{left === 1 ? "" : "S"}
                </span>
              )}
            </span>
            <svg
              width="13" height="13" viewBox="0 0 16 16" fill="none" stroke="currentColor"
              strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"
              className="shrink-0 text-ink-faint transition-transform group-open:rotate-90"
              aria-hidden="true"
            >
              <path d="M6 3.5 10.5 8 6 12.5" />
            </svg>
          </span>
        </span>
      </summary>

      <div className="border-t border-line-soft px-3 pb-3 pt-3">
        {/* ---- what the game demands. The reason this section exists. ---- */}
        {activity.needs && (
          <div className="mb-3 rounded-[12px] border border-line-soft bg-fill px-3 py-2.5">
            <p className="font-mono text-[0.5625rem] font-medium tracking-[0.1em] text-ink-faint">
              THE GAME REQUIRES
            </p>
            <p className="mt-1 text-[0.875rem] leading-relaxed text-ink">{activity.needs}</p>
          </div>
        )}

        {!possible && (
          <p className="mb-3 rounded-[12px] border border-warn/30 bg-warn-wash px-3 py-2.5 text-[0.875rem] leading-relaxed text-warn">
            This group is set to {session.slotsTotal}, but {activity.name} does not start
            with fewer than {activity.minPlayers}. Somebody will need to open more seats.
          </p>
        )}

        <dl className="grid gap-x-4 gap-y-2 sm:grid-cols-2">
          <div>
            <dt className="font-mono text-[0.5625rem] tracking-[0.1em] text-ink-faint">HOST</dt>
            <dd className="mt-0.5 text-[0.875rem] font-semibold text-ink">
              {session.host}
              <span className="ml-1.5 font-mono text-[0.625rem] font-normal text-ink-faint">
                {session.hostSessions === 0
                  ? "NEW HERE"
                  : `${session.hostSessions} RUNS`}
              </span>
            </dd>
          </div>

          <div>
            <dt className="font-mono text-[0.5625rem] tracking-[0.1em] text-ink-faint">IN RETURN</dt>
            <dd className="mt-0.5 text-[0.875rem] font-semibold text-ink">
              {session.terms.kind === "free" && "Nothing — they just need players"}
              {session.terms.kind === "split" && "Split whatever drops"}
              {session.terms.kind === "item" && (termsItem?.name ?? "An item")}
            </dd>
          </div>

          {activity.reward && (
            <div>
              <dt className="font-mono text-[0.5625rem] tracking-[0.1em] text-ink-faint">YOU GET</dt>
              <dd className="mt-0.5 text-[0.875rem] text-ink-soft">{activity.reward}</dd>
            </div>
          )}

          {session.asks && (
            <div>
              <dt className="font-mono text-[0.5625rem] tracking-[0.1em] text-ink-faint">
                HOST ALSO ASKS
              </dt>
              <dd className="mt-0.5 text-[0.875rem] text-ink-soft">{session.asks}</dd>
            </div>
          )}
        </dl>

        {session.note && (
          <p className="mt-3 text-[0.8125rem] leading-relaxed text-ink-mute">
            &ldquo;{session.note}&rdquo;
          </p>
        )}

        {/* ---- the one rule that matters on this tab ---- */}
        <p className="mt-3 text-[0.6875rem] leading-relaxed text-ink-faint">
          Play it yourself. Nobody should ever ask for your account, your password
          or your login — a run done on your account is not a service, it is how
          accounts get taken.
        </p>

        <div className="mt-3 flex flex-wrap items-center justify-end gap-2">
          <button type="button" className="pill pill-ghost py-1.5 text-[0.8125rem]">
            Message host
          </button>
          <button
            type="button"
            disabled={state === "full"}
            className="pill pill-mint py-1.5 text-[0.8125rem] disabled:opacity-50"
          >
            {state === "full" ? "Full" : "Ask to join"}
          </button>
        </div>
      </div>
    </details>
  );
}
