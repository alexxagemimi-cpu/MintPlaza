"use client";

import { useState, useTransition } from "react";
import type { ServiceListing } from "@/lib/sessions";
import { timeLeftCopy, expiresAt, listingState } from "@/lib/sessions";
import { useFindTemplate } from "./TemplateProvider";
import { ServiceListingCard } from "./ServiceListingCard";
import { LiveCountdown } from "./LiveCountdown";
import { Face } from "./VotersSheet";
import { answerRequest } from "@/lib/actions/board";

/**
 * Everything you have a stake in, in one place.
 *
 * Two halves, because there are exactly two ways to be involved: you posted it,
 * or you put your hand up for somebody else's. Splitting them is what keeps
 * "what do I need to do next" answerable in a glance.
 *
 * The half that matters most is at the top of the second tab: a request waiting
 * on your answer. Somebody has chosen you and cannot start until you reply, so
 * it sits above everything else with the two buttons that unblock them. Burying
 * that under a list of things you voted on last hour would strand the person
 * who picked you.
 */

type Tab = "mine" | "activity";

function Countdown({ listing }: { listing: ServiceListing }) {
  return (
    <span className="font-mono text-[0.625rem] tabular-nums text-ink-faint">
      <LiveCountdown expiresAt={expiresAt(listing)} initial={timeLeftCopy(listing)} />
    </span>
  );
}

/**
 * A request waiting on you.
 *
 * Says who asked, for what, and how many others they picked — because "am I
 * one of three or one of twelve" changes whether you say yes.
 */
function IncomingRequest({
  listing, onAnswer,
}: {
  listing: ServiceListing;
  onAnswer: (id: string, agreed: boolean) => void;
}) {
  const findTemplate = useFindTemplate();
  const service = findTemplate(listing.serviceIds[0]);
  const asked = listing.voters.filter((v) => v.reply !== "not-picked").length;

  return (
    <li className="rounded-[var(--radius-panel)] border border-mint bg-mint-wash p-3">
      <p className="font-mono text-[0.5625rem] font-bold tracking-[0.1em] text-mint">
        THEY PICKED YOU
      </p>
      <p className="mt-1.5 text-[0.9375rem] font-bold tracking-[-0.015em] text-ink">
        {service?.name ?? "A listing"}
      </p>
      <p className="mt-0.5 text-[0.8125rem] text-ink-soft">
        <b>{listing.author}</b> asked {asked}{" "}
        {asked === 1 ? "player" : "players"}, you among them.
      </p>
      {listing.detail && (
        <p className="mt-2 text-[0.8125rem] leading-relaxed text-ink-mute">
          &ldquo;{listing.detail}&rdquo;
        </p>
      )}
      <div className="mt-3 flex items-center gap-2">
        <button
          type="button"
          onClick={() => onAnswer(listing.id, true)}
          className="pill pill-mint flex-1 py-2 text-[0.875rem]"
        >
          I&rsquo;m in
        </button>
        <button
          type="button"
          onClick={() => onAnswer(listing.id, false)}
          className="pill pill-ghost flex-1 py-2 text-[0.875rem]"
        >
          Can&rsquo;t make it
        </button>
        <Countdown listing={listing} />
      </div>
    </li>
  );
}

export function MyLists({
  posted, joined,
}: {
  posted: readonly ServiceListing[];
  joined: readonly ServiceListing[];
}) {
  const [tab, setTab] = useState<Tab>("mine");
  const [answered, setAnswered] = useState<Record<string, boolean>>({});
  const [error, setError] = useState<string | null>(null);
  const [, start] = useTransition();

  /**
   * Answer a request. The reply shows at once and rolls back if the server
   * refuses — somebody waiting on you should see their answer land, and a
   * refusal should say why rather than silently doing nothing.
   */
  function answer(id: string, agreed: boolean) {
    setError(null);
    setAnswered((prev) => ({ ...prev, [id]: agreed }));
    if (joined.find((l) => l.id === id)?.isDemo) return;
    start(async () => {
      const result = await answerRequest(id, agreed);
      if (!result.ok) {
        setAnswered((prev) => {
          const next = { ...prev };
          delete next[id];
          return next;
        });
        setError(result.error);
      }
    });
  }

  // A request is waiting if they picked you and you have not answered yet.
  const waiting = joined.filter(
    (l) =>
      l.stage === "requested" &&
      listingState(l) === "live" &&
      answered[l.id] === undefined,
  );
  const rest = joined.filter((l) => !waiting.includes(l));

  const tabs: { id: Tab; label: string; count: number }[] = [
    { id: "mine", label: "My lists", count: posted.length },
    { id: "activity", label: "My activity", count: joined.length },
  ];

  return (
    <div className="mx-auto max-w-4xl px-4 pb-24 pt-8 sm:px-8 sm:pt-12">
      <p className="label">Your board</p>
      <h1 className="mt-0.5 text-[1.5rem] font-extrabold tracking-[-0.035em] text-ink">
        My lists
      </h1>
      <p className="mt-2 max-w-[62ch] text-[0.9375rem] leading-relaxed text-ink-soft">
        What you posted, and what you put your hand up for. Everything here
        disappears two hours after it went up, whether or not it came to anything.
      </p>

      <div className="mt-5 flex gap-2">
        {tabs.map((t) => (
          <button
            key={t.id}
            type="button"
            onClick={() => setTab(t.id)}
            aria-pressed={tab === t.id}
            className={`flex items-center gap-2 rounded-full border px-4 py-2 text-[0.875rem] font-bold transition-colors ${
              tab === t.id
                ? "border-ink bg-ink text-surface"
                : "border-line bg-surface text-ink-mute hover:border-mint"
            }`}
          >
            {t.label}
            <span className="font-mono text-[0.625rem] opacity-70">{t.count}</span>
            {t.id === "activity" && waiting.length > 0 && (
              <span className="h-1.5 w-1.5 rounded-full bg-mint" />
            )}
          </button>
        ))}
      </div>

      {tab === "mine" && (
        <div className="mt-5">
          {posted.length === 0 ? (
            <div className="glass-quiet rounded-[var(--radius-panel)] px-6 py-14 text-center">
              <p className="text-[1.0625rem] font-bold tracking-[-0.02em] text-ink">
                You have not posted anything
              </p>
              <p className="mx-auto mt-1.5 max-w-[38ch] text-[0.9375rem] leading-relaxed text-ink-mute">
                Post from Raids &amp; Services when you need a hand, or when you
                have time to give one.
              </p>
            </div>
          ) : (
            <ul className="grid gap-2">
              {posted.map((l) => (
                <li key={l.id}>
                  <ServiceListingCard listing={l} showOwnerControls />
                </li>
              ))}
            </ul>
          )}
        </div>
      )}

      {tab === "activity" && (
        <div className="mt-5 grid gap-5">
          {waiting.length > 0 && (
            <section>
              <h2 className="mb-2 text-[1.0625rem] font-bold tracking-[-0.025em] text-ink">
                Waiting on you
              </h2>
              {error && (
                <p role="alert" className="mb-2 text-[0.8125rem] text-bad">{error}</p>
              )}
              <ul className="grid gap-2">
                {waiting.map((l) => (
                  <IncomingRequest
                    key={l.id}
                    listing={l}
                    onAnswer={answer}
                  />
                ))}
              </ul>
            </section>
          )}

          <section>
            <h2 className="mb-2 text-[1.0625rem] font-bold tracking-[-0.025em] text-ink">
              You put your hand up for
            </h2>
            {rest.length === 0 && waiting.length === 0 ? (
              <div className="glass-quiet rounded-[var(--radius-panel)] px-6 py-14 text-center">
                <p className="text-[1.0625rem] font-bold tracking-[-0.02em] text-ink">
                  Nothing yet
                </p>
                <p className="mx-auto mt-1.5 max-w-[38ch] text-[0.9375rem] leading-relaxed text-ink-mute">
                  Vote on anything in Raids &amp; Services and it turns up here.
                </p>
              </div>
            ) : (
              <ul className="grid gap-2">
                {rest.map((l) => {
                  const reply = answered[l.id];
                  return (
                    <li key={l.id}>
                      {reply !== undefined && (
                        <p
                          className={`mb-1 flex items-center gap-1.5 font-mono text-[0.5625rem] tracking-[0.08em] ${
                            reply ? "text-mint" : "text-ink-faint"
                          }`}
                        >
                          <Face
                            voter={{
                              username: l.author, online: l.authorOnline,
                              votedMinutesAgo: 0, reply: "not-picked",
                            }}
                            size={16}
                          />
                          {reply ? "YOU SAID YES" : "YOU SAID NO"}
                        </p>
                      )}
                      <ServiceListingCard listing={l} />
                    </li>
                  );
                })}
              </ul>
            )}
          </section>
        </div>
      )}
    </div>
  );
}
