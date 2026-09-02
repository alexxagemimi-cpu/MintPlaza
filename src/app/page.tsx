import Link from "next/link";
import { GAMES, MODULE_LABELS } from "@/lib/games";
import { GameMark } from "@/components/GameMark";

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
          <p className="text-[0.6875rem] font-semibold uppercase tracking-[0.08em] text-mint/70">Has</p>
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
        <span className="rounded-full border border-mint/25 bg-mint/10 px-2.5 py-1 font-mono text-[0.625rem] font-medium tracking-[0.08em] text-mint">
          BOTH DIRECTIONS
        </span>
      </div>

      <div className="grid gap-3 sm:grid-cols-[1fr_auto_1fr] sm:items-center sm:gap-4">
        <MatchSide who="You" has="Permanent Dough" wants="Permanent Kitsune" />

        <div
          aria-hidden="true"
          className="flex items-center justify-center gap-1 sm:flex-col sm:gap-1.5"
        >
          <span className="h-px w-8 bg-mint/40 sm:h-8 sm:w-px" />
          <span className="grid h-7 w-7 shrink-0 place-items-center rounded-full border border-mint/30 bg-mint/10 text-mint">
            <svg width="13" height="13" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
              <path d="M2 5.5h9.5M9 3l2.5 2.5L9 8" />
              <path d="M14 10.5H4.5M7 13l-2.5-2.5L7 8" />
            </svg>
          </span>
          <span className="h-px w-8 bg-mint/40 sm:h-8 sm:w-px" />
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

const PRINCIPLES = [
  {
    title: "Matching, not browsing",
    body: "Say what you have and what you want. MintPlaza looks for people whose lists point back at yours, and shows the reason it matched you — never a shuffled grid dressed up as a recommendation.",
  },
  {
    title: "Limits that keep it readable",
    body: "Three listings every three hours. Not a punishment — the reason the board is worth reading at all. Repeat posting stops working, so finding beats shouting.",
  },
  {
    title: "Built per game, not once",
    body: "A neon pet, a chroma knife and a permanent fruit are not the same kind of thing. Each game gets fields that fit its own economy instead of one shape forced onto six.",
  },
  {
    title: "Reputation you can trace",
    body: "Standing comes from interactions that actually happened here, tied to the trade or the group they came from. Nothing calls itself verified without something real behind it.",
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
      <header className="sticky top-0 z-50 border-b border-white/[0.055] bg-abyss/95 backdrop-blur-xl">
        <nav className="mx-auto flex h-16 max-w-6xl items-center justify-between gap-6 px-5 sm:px-8">
          <Wordmark />
          <div className="hidden items-center gap-7 text-[0.8125rem] font-medium text-ink-soft md:flex">
            <a href="#how" className="transition-colors hover:text-ink">How it works</a>
            <a href="#games" className="transition-colors hover:text-ink">Games</a>
            <a href="#trust" className="transition-colors hover:text-ink">Trust</a>
          </div>
          <Link href="/app" className="pill pill-primary">
            Continue with Roblox
          </Link>
        </nav>
      </header>

      <main>
        {/* ---- hero ---- */}
        <section className="mx-auto max-w-6xl px-5 pb-20 pt-14 sm:px-8 sm:pb-28 sm:pt-20">
          <div className="grid items-center gap-12 lg:grid-cols-[1.05fr_0.95fr] lg:gap-16">
            <div>
              <p className="label mb-6">Player discovery · six games</p>
              <h1 className="display max-w-[13ch] text-[2.6rem] leading-[0.98] sm:text-[3.4rem] lg:text-[3.75rem]">
                The trade you want is{" "}
                <span className="text-mint">already posted.</span> You just
                can&rsquo;t find it.
              </h1>

              <p className="measure mt-7 text-[1.0625rem] leading-relaxed text-ink-soft">
                Discord channels move faster than anyone can read, so the same
                requests get posted over and over by people who would have
                matched an hour ago. MintPlaza organises what players are
                already looking for into something you can search — and tells
                you who fits you, and why.
              </p>

              <div className="mt-9 flex flex-wrap items-center gap-3">
                <Link href="/app" className="pill pill-primary px-6 py-3.5 text-sm">
                  Continue with Roblox
                </Link>
                <a href="#how" className="pill pill-ghost px-6 py-3.5 text-sm">
                  See how matching works
                </a>
              </div>

              <p className="mt-6 flex items-start gap-2.5 text-[0.8125rem] leading-relaxed text-ink-mute">
                <svg width="15" height="15" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.6" className="mt-px shrink-0 text-mint" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M8 1.8 3 3.9v3.4c0 2.9 2 5.6 5 6.9 3-1.3 5-4 5-6.9V3.9L8 1.8Z" />
                  <path d="m5.9 7.9 1.5 1.5 2.8-2.9" />
                </svg>
                Free to use. Sign-in goes through Roblox — MintPlaza never asks
                for your password, cookie or session token.
              </p>
            </div>

            <HeroMatch />
          </div>
        </section>

        {/* ---- principles ---- */}
        <section className="border-t border-white/[0.055] py-20 sm:py-24">
          <div className="mx-auto max-w-6xl px-5 sm:px-8">
            <SectionLabel>Why it works</SectionLabel>
            <h2 className="display measure text-[1.9rem] sm:text-[2.4rem]">
              Posting louder was never the problem.
            </h2>
            <p className="measure mt-4 text-[1rem] leading-relaxed text-ink-soft">
              Every one of these games has the same bottleneck: the person you
              need is online right now and neither of you can see the other.
            </p>

            <div className="mt-12 grid gap-4 sm:grid-cols-2">
              {PRINCIPLES.map((p) => (
                <div key={p.title} className="glass rounded-[var(--radius-panel)] p-6 sm:p-7">
                  <h3 className="text-[1.0625rem] font-bold tracking-[-0.02em] text-ink">{p.title}</h3>
                  <p className="mt-2.5 text-[0.9375rem] leading-relaxed text-ink-soft">{p.body}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* ---- how it works ---- */}
        <section id="how" className="scroll-mt-20 border-t border-white/[0.055] py-20 sm:py-24">
          <div className="mx-auto max-w-6xl px-5 sm:px-8">
            <SectionLabel>How it works</SectionLabel>
            <h2 className="display measure text-[1.9rem] sm:text-[2.4rem]">Four steps, then you are talking to someone.</h2>

            <ol className="mt-12 grid gap-px overflow-hidden rounded-[var(--radius-panel)] border border-white/[0.07] bg-white/[0.055] sm:grid-cols-2 lg:grid-cols-4">
              {STEPS.map((s, i) => (
                <li key={s.t} className="bg-deep/70 p-6 backdrop-blur-xl sm:p-7">
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
        <section id="games" className="scroll-mt-20 border-t border-white/[0.055] py-20 sm:py-24">
          <div className="mx-auto max-w-6xl px-5 sm:px-8">
            <SectionLabel>Six games at launch</SectionLabel>
            <h2 className="display measure text-[1.9rem] sm:text-[2.4rem]">Each one gets its own shape.</h2>
            <p className="measure mt-4 text-[1rem] leading-relaxed text-ink-soft">
              The dashboard changes with the game you pick — different fields,
              different activities, different things worth searching for.
            </p>

            <div className="mt-12 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {GAMES.map((g) => (
                <article key={g.slug} className="glass flex flex-col rounded-[var(--radius-panel)] p-6">
                  <div className="flex items-center gap-3.5">
                    <GameMark game={g} size={42} />
                    <h3 className="text-[1rem] font-bold leading-tight tracking-[-0.02em] text-ink">{g.name}</h3>
                  </div>
                  <p className="mt-4 flex-1 text-[0.875rem] leading-relaxed text-ink-soft">{g.blurb}</p>
                  <div className="mt-5 flex flex-wrap gap-1.5">
                    {g.modules.map((m) => (
                      <span
                        key={m}
                        className="rounded-md border border-white/[0.07] bg-white/[0.035] px-2 py-1 font-mono text-[0.625rem] tracking-[0.05em] text-ink-mute"
                      >
                        {MODULE_LABELS[m]}
                      </span>
                    ))}
                  </div>
                </article>
              ))}
            </div>
          </div>
        </section>

        {/* ---- trust ---- */}
        <section id="trust" className="scroll-mt-20 border-t border-white/[0.055] py-20 sm:py-24">
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
        <section className="border-t border-white/[0.055] py-24 sm:py-32">
          <div className="mx-auto max-w-6xl px-5 text-center sm:px-8">
            <h2 className="display mx-auto max-w-[18ch] text-[2.1rem] sm:text-[2.9rem]">
              Find the person you already needed.
            </h2>
            <p className="mx-auto mt-5 max-w-[46ch] text-[1rem] leading-relaxed text-ink-soft">
              Pick a game, say what you are after, and see who lines up.
            </p>
            <div className="mt-9 flex justify-center">
              <Link href="/app" className="pill pill-primary px-7 py-4 text-[0.9375rem]">
                Continue with Roblox
              </Link>
            </div>
          </div>
        </section>
      </main>

      {/* ---- footer ---- */}
      <footer className="border-t border-white/[0.055] py-12">
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
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
}
