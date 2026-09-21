import Link from "next/link";
import { GAMES, MODULE_LABELS } from "@/lib/games";
import { GameCover } from "@/components/GameArt";
import { WantMarquee } from "@/components/WantMarquee";

/* ------------------------------------------------------------------ */

function Wordmark({ className = "" }: { className?: string }) {
  return (
    <Link
      href="/"
      className={`inline-flex items-baseline text-[1.0625rem] font-extrabold tracking-[-0.04em] ${className}`}
    >
      <span className="text-ink">Mint</span>
      <span className="text-mint">Plaza</span>
    </Link>
  );
}

function SectionLabel({ children }: { children: React.ReactNode }) {
  return <p className="label mb-4">{children}</p>;
}

/* ------------------------------------------------------------------
   Hero visual: the reciprocal match.

   The most characteristic thing in MintPlaza's world is two players whose
   wants intersect in both directions. Showing that mechanic says more than a
   screenshot of a dashboard would.
   ------------------------------------------------------------------ */

function MatchSide({
  who,
  has,
  wants,
  align = "left",
}: {
  who: string;
  has: string;
  wants: string;
  align?: "left" | "right";
}) {
  return (
    <div className={`glass rounded-[var(--radius-inner)] p-5 ${align === "right" ? "sm:text-right" : ""}`}>
      <p className="label mb-3">{who}</p>
      <div className="space-y-3">
        <div>
          <p className="text-[0.6875rem] font-semibold uppercase tracking-[0.08em] text-mint">Has</p>
          <p className="mt-1 text-[0.9375rem] font-semibold text-ink">{has}</p>
        </div>
        <div className="hairline" />
        <div>
          <p className="text-[0.6875rem] font-semibold uppercase tracking-[0.08em] text-ink-mute">Wants</p>
          <p className="mt-1 text-[0.9375rem] font-semibold text-ink-soft">{wants}</p>
        </div>
      </div>
    </div>
  );
}

function HeroMatch() {
  return (
    <div className="glass-lift rounded-[var(--radius-panel)] p-5 sm:p-7">
      <div className="mb-5 flex items-center justify-between gap-4">
        <p className="label">Potential match</p>
        <span className="rounded-full border border-mint/30 bg-mint-wash px-2.5 py-1 font-mono text-[0.625rem] font-medium tracking-[0.08em] text-mint">
          BOTH DIRECTIONS
        </span>
      </div>

      <div className="grid gap-3 sm:grid-cols-[1fr_auto_1fr] sm:items-center sm:gap-4">
        <MatchSide who="You" has="Permanent Dough" wants="Permanent Kitsune" />

        <div
          aria-hidden="true"
          className="flex items-center justify-center gap-1 sm:flex-col sm:gap-1.5"
        >
          <span className="h-px w-8 bg-mint/30 sm:h-8 sm:w-px" />
          <span className="grid h-7 w-7 shrink-0 place-items-center rounded-full border border-mint/30 bg-mint-wash text-mint">
            <svg width="13" height="13" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
              <path d="M2 5.5h9.5M9 3l2.5 2.5L9 8" />
              <path d="M14 10.5H4.5M7 13l-2.5-2.5L7 8" />
            </svg>
          </span>
          <span className="h-px w-8 bg-mint/30 sm:h-8 sm:w-px" />
        </div>

        <MatchSide who="Them" has="Permanent Kitsune" wants="Permanent Dough" align="right" />
      </div>

      <p className="mt-5 text-[0.8125rem] leading-relaxed text-ink-mute">
        MintPlaza surfaces the overlap and tells you why it matched. It does not
        hold, escrow or complete the trade — you finish that in-game, the normal way.
      </p>
    </div>
  );
}

/* ------------------------------------------------------------------ */

const FEATURES = [
  {
    title: "Two-way matching",
    icon: "M2.8 6.6h10.6M10.6 3.8 13.4 6.6l-2.8 2.8M17.2 13.4H6.6M9.4 10.6 6.6 13.4l2.8 2.8",
    body: "It looks for people whose wants point back at yours — they have what you are after and want what you have — and tells you which of the two it is.",
  },
  {
    title: "Messages",
    icon: "M17.5 9.6c0 3.3-3.4 6-7.5 6a8.7 8.7 0 0 1-2.3-.3L3.5 17l1.2-3A5.7 5.7 0 0 1 2.5 9.6c0-3.3 3.4-6 7.5-6s7.5 2.7 7.5 6Z",
    body: "Free for everyone. A thread stays attached to the trade or the group it came from, so nobody has to ask what this is about. Block and report from day one.",
  },
  {
    title: "Ask before you accept",
    icon: "M10 2.4 3.5 4.8v4c0 4.2 2.7 7.4 6.5 8.5 3.8-1.1 6.5-4.3 6.5-8.5v-4L10 2.4ZM7.3 9.6l1.9 2 3.6-3.8",
    body: "Every one of these communities checks whether a trade is win, fair or lose before accepting. Here that is a thing you can ask on the listing itself.",
  },
  {
    title: "Groups say what they need",
    icon: "M12.6 16.5v-1.3a3 3 0 0 0-3-3H5.2a3 3 0 0 0-3 3v1.3M7.4 9a2.8 2.8 0 1 0 0-5.6 2.8 2.8 0 0 0 0 5.6M17.8 16.5v-1.3a3 3 0 0 0-2.3-2.9M12.6 3.6a3 3 0 0 1 0 5.4",
    body: "\u201cThree players, all different races, V3 or above\u201d is a filter you can match on, not a sentence somebody has to read twice and then ask about.",
  },
  {
    title: "Standing you can trace",
    icon: "M10 2.5 4 5v4.3c0 3.6 2.4 6.9 6 8.2 3.6-1.3 6-4.6 6-8.2V5l-6-2.5ZM10 7.6v2.9M10 13.2h.01",
    body: "Reputation comes from interactions that actually happened here, tied to the trade or group they came from. Nothing is called verified without something real behind it.",
  },
  {
    title: "A board worth reading",
    icon: "M10 5.4v4.8l3 1.8M17.5 10a7.5 7.5 0 1 1-15 0 7.5 7.5 0 0 1 15 0Z",
    body: "Four listings a day, and a slot only comes back a full day after the listing that used it — enforced by the database rather than the page. Nobody can flood it, so the board stays worth scrolling.",
  },
];

const STEPS = [
  { t: "Sign in with Roblox", b: "One tap, official Roblox sign-in. No password, no cookie, no token — MintPlaza never asks for any of them." },
  { t: "Say what you have and want", b: "Per game, with the details that game actually uses. This is what the matching runs on." },
  { t: "Get the overlaps", b: "People whose wants meet yours, ranked by how well they fit, each with the reason attached." },
  { t: "Message, then finish in-game", b: "Talk here. Trade or team up in the game itself, exactly as you would have anyway." },
];

const NEVER = [
  { t: "Never asks for your password", b: "Or your cookie, or a session token. Sign-in goes through Roblox's own OAuth and nothing else is requested — ever." },
  { t: "Never touches your items", b: "No escrow, no middleman, no holding. Trades happen in-game between the two of you." },
  { t: "Never sells Robux or items", b: "MintPlaza is a place to find people. It is not a shop and there is no secondary market here." },
  { t: "Never fakes a number", b: "No invented listings, no inflated online counts, no verified badge without something real behind it." },
];

/* ------------------------------------------------------------------ */

export default function HomePage() {
  return (
    <div className="min-h-dvh">
      {/* ---- nav ---- */}
      <header className="sticky top-0 z-50 border-b border-line-soft bg-surface/95 backdrop-blur-xl">
        <nav className="mx-auto flex h-16 max-w-6xl items-center justify-between gap-6 px-5 sm:px-8">
          <Wordmark />
          <div className="hidden items-center gap-7 text-[0.8125rem] font-medium text-ink-soft md:flex">
            <a href="#how" className="transition-colors hover:text-ink">How it works</a>
            <a href="#games" className="transition-colors hover:text-ink">Games</a>
            <a href="#trust" className="transition-colors hover:text-ink">Trust</a>
          </div>
          <Link href="/login" className="pill pill-mint">
            Continue with Roblox
          </Link>
        </nav>
      </header>

      <main>
        {/* ---- hero: the question, then what people are actually asking ---- */}
        <section className="pb-16 pt-14 sm:pb-20 sm:pt-20">
          <div className="mx-auto max-w-6xl px-5 text-center sm:px-8">
            <p className="label mb-6">Player discovery · six games</p>
            <h1 className="display mx-auto max-w-[15ch] text-[3rem] leading-[0.95] sm:text-[4.25rem] lg:text-[4.75rem]">
              What do you <span className="text-mint">want?</span>
            </h1>
            <p className="measure mx-auto mt-7 text-[1.0625rem] leading-relaxed text-ink-soft">
              Somebody in your game is asking for the other half of it right now.
              MintPlaza puts every one of these requests in one searchable place
              and tells you which ones fit you — instead of a Discord channel
              that scrolls past faster than you can read.
            </p>
          </div>

          {/* Full-bleed, because the promise is the point of this screen. */}
          <div className="mt-12 sm:mt-14">
            <WantMarquee />
          </div>

          <div className="mx-auto mt-12 max-w-6xl px-5 text-center sm:px-8">
            <div className="flex flex-wrap items-center justify-center gap-3">
              <Link href="/login" className="pill pill-mint px-7 py-4 text-[0.9375rem]">
                Try MintPlaza now
              </Link>
              <a href="#how" className="pill pill-ghost px-6 py-4 text-[0.9375rem]">
                See how it works
              </a>
            </div>
            <p className="mx-auto mt-6 flex max-w-[52ch] items-start justify-center gap-2.5 text-[0.8125rem] leading-relaxed text-ink-mute">
              <svg width="15" height="15" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.6" className="mt-px shrink-0 text-mint" strokeLinecap="round" strokeLinejoin="round">
                <path d="M8 1.8 3 3.9v3.4c0 2.9 2 5.6 5 6.9 3-1.3 5-4 5-6.9V3.9L8 1.8Z" />
                <path d="m5.9 7.9 1.5 1.5 2.8-2.9" />
              </svg>
              Free to use. Sign-in goes through Roblox — MintPlaza never asks for
              your password, cookie or session token.
            </p>
          </div>
        </section>

        {/* ---- what you get, with the messaging system among it ---- */}
        <section className="border-t border-line-soft py-20 sm:py-24">
          <div className="mx-auto max-w-6xl px-5 sm:px-8">
            <SectionLabel>What is here</SectionLabel>
            <h2 className="display measure text-[1.9rem] sm:text-[2.4rem]">
              Everything the request needed, in one place.
            </h2>

            <div className="mt-12 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {FEATURES.map((f) => (
                <div key={f.title} className="glass rounded-[var(--radius-panel)] p-6">
                  <span className="grid h-10 w-10 place-items-center rounded-[13px] bg-mint-wash text-mint">
                    <svg width="19" height="19" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                      <path d={f.icon} />
                    </svg>
                  </span>
                  <h3 className="mt-4 text-[1.0625rem] font-bold tracking-[-0.025em] text-ink">
                    {f.title}
                  </h3>
                  <p className="mt-2 text-[0.9375rem] leading-relaxed text-ink-soft">{f.body}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* ---- how it works ---- */}
        <section id="how" className="scroll-mt-20 border-t border-line-soft py-20 sm:py-24">
          <div className="mx-auto max-w-6xl px-5 sm:px-8">
            <SectionLabel>How it works</SectionLabel>
            <h2 className="display measure text-[1.9rem] sm:text-[2.4rem]">Four steps, then you are talking to someone.</h2>

            <ol className="mt-12 grid gap-px overflow-hidden rounded-[var(--radius-panel)] border border-line bg-line sm:grid-cols-2 lg:grid-cols-4">
              {STEPS.map((s, i) => (
                <li key={s.t} className="bg-surface/85 p-6 backdrop-blur-xl sm:p-7">
                  <span className="font-mono text-[0.6875rem] font-medium tracking-[0.1em] text-mint">
                    {String(i + 1).padStart(2, "0")}
                  </span>
                  <h3 className="mt-4 text-[1rem] font-bold tracking-[-0.015em] text-ink">{s.t}</h3>
                  <p className="mt-2 text-[0.875rem] leading-relaxed text-ink-mute">{s.b}</p>
                </li>
              ))}
            </ol>
          </div>
        </section>

        {/* ---- games ---- */}
        <section id="games" className="scroll-mt-20 border-t border-line-soft py-20 sm:py-24">
          <div className="mx-auto max-w-6xl px-5 sm:px-8">
            <SectionLabel>Six games at launch</SectionLabel>
            <h2 className="display measure text-[1.9rem] sm:text-[2.4rem]">Each one gets its own shape.</h2>
            <p className="measure mt-4 text-[1rem] leading-relaxed text-ink-soft">
              The dashboard changes with the game you pick — different fields,
              different activities, different things worth searching for.
            </p>

            <div className="mt-12 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {GAMES.map((g, i) => (
                <article
                  key={g.slug}
                  className="glass flex flex-col overflow-hidden rounded-[var(--radius-panel)]"
                >
                  <GameCover game={g} priority={i < 3} />
                  <div className="flex flex-1 flex-col p-6">
                    <h3 className="text-[1.0625rem] font-bold leading-tight tracking-[-0.025em] text-ink">
                      {g.name}
                    </h3>
                    <p className="mt-2.5 flex-1 text-[0.875rem] leading-relaxed text-ink-soft">
                      {g.blurb}
                    </p>
                    <div className="mt-5 flex flex-wrap gap-1.5">
                      {g.modules.map((m) => (
                        <span
                          key={m}
                          className="rounded-md border border-line bg-fill px-2 py-1 font-mono text-[0.625rem] tracking-[0.05em] text-ink-mute"
                        >
                          {MODULE_LABELS[m]}
                        </span>
                      ))}
                    </div>
                  </div>
                </article>
              ))}
            </div>
          </div>
        </section>

        {/* ---- trust ---- */}
        <section id="trust" className="scroll-mt-20 border-t border-line-soft py-20 sm:py-24">
          <div className="mx-auto max-w-6xl px-5 sm:px-8">
            <SectionLabel>Where the line is</SectionLabel>
            <h2 className="display measure text-[1.9rem] sm:text-[2.4rem]">
              Four things MintPlaza will never do.
            </h2>
            <p className="measure mt-4 text-[1rem] leading-relaxed text-ink-soft">
              Worth stating plainly, because plenty of sites around these games
              do the opposite.
            </p>

            <div className="mt-12 grid gap-4 sm:grid-cols-2">
              {NEVER.map((n) => (
                <div key={n.t} className="glass-quiet flex gap-4 rounded-[var(--radius-inner)] p-6">
                  <svg width="19" height="19" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.6" className="mt-0.5 shrink-0 text-mint" strokeLinecap="round">
                    <circle cx="10" cy="10" r="7.4" />
                    <path d="M6.6 6.6 13.4 13.4" />
                  </svg>
                  <div>
                    <h3 className="text-[0.9375rem] font-bold tracking-[-0.015em] text-ink">{n.t}</h3>
                    <p className="mt-1.5 text-[0.875rem] leading-relaxed text-ink-mute">{n.b}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* ---- final cta ---- */}
        <section className="border-t border-line-soft py-24 sm:py-32">
          <div className="mx-auto max-w-6xl px-5 text-center sm:px-8">
            <h2 className="display mx-auto max-w-[18ch] text-[2.1rem] sm:text-[2.9rem]">
              Find the person you already needed.
            </h2>
            <p className="mx-auto mt-5 max-w-[46ch] text-[1rem] leading-relaxed text-ink-soft">
              Pick a game, say what you are after, and see who lines up.
            </p>
            <div className="mt-9 flex justify-center">
              <Link href="/login" className="pill pill-mint px-7 py-4 text-[0.9375rem]">
                Continue with Roblox
              </Link>
            </div>
          </div>
        </section>
      </main>

      {/* ---- footer ---- */}
      <footer className="border-t border-line-soft py-12">
        <div className="mx-auto flex max-w-6xl flex-col gap-6 px-5 sm:px-8 md:flex-row md:items-start md:justify-between">
          <div>
            <Wordmark />
            <p className="mt-3 max-w-[42ch] text-[0.8125rem] leading-relaxed text-ink-faint">
              A player discovery and community platform. Not affiliated with,
              endorsed by, or sponsored by Roblox Corporation. Game names are
              used descriptively to organise community activity.
            </p>
          </div>
          <div className="flex gap-10 font-mono text-[0.6875rem] tracking-[0.06em] text-ink-faint">
            <div className="space-y-2">
              <p className="text-ink-mute">PRODUCT</p>
              <p><a href="#how" className="transition-colors hover:text-ink-soft">How it works</a></p>
              <p><a href="#games" className="transition-colors hover:text-ink-soft">Games</a></p>
            </div>
            <div className="space-y-2">
              <p className="text-ink-mute">LEGAL</p>
              <p><Link href="/privacy" className="transition-colors hover:text-ink-soft">Privacy</Link></p>
              <p><Link href="/terms" className="transition-colors hover:text-ink-soft">Terms</Link></p>
              {/* Named in full, and in the footer, because a payment provider
                  reviewing this site looks here for exactly these words. */}
              <p><Link href="/refunds" className="transition-colors hover:text-ink-soft">Refunds</Link></p>
            </div>
            <div className="space-y-2">
              <p className="text-ink-mute">HELP</p>
              <p><Link href="/support" className="transition-colors hover:text-ink-soft">Contact</Link></p>
              <p><Link href="/upgrade" className="transition-colors hover:text-ink-soft">Pricing</Link></p>
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
}
