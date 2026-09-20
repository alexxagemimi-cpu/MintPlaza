# MintPlaza

A player discovery and community platform for six games. Instead of the same
requests scrolling past in a Discord channel faster than anyone can read them,
MintPlaza organises what players are looking for into something searchable, and
surfaces the people whose wants line up with yours.

This is a standalone web application. It has no dependency on GitHub or any
other host; it builds to a normal Next.js application and deploys anywhere that
runs Node.

## Running it

```bash
npm install
cp .env.example .env.local
npm run dev
```

Open http://localhost:3000.

## Putting it live

**[docs/go-live.md](docs/go-live.md)** — the database, the deploy, Roblox
sign-in and taking payments, in order, in plain English. Start there.

| Document | What it covers |
| --- | --- |
| [docs/go-live.md](docs/go-live.md) | Deploying, and getting paid |
| [docs/roblox-sign-in.md](docs/roblox-sign-in.md) | The Roblox OIDC provider |
| [docs/legal-review.md](docs/legal-review.md) | What to take to a lawyer, and the one thing to decide before money moves |

## Scripts

| Command | What it does |
| --- | --- |
| `npm run dev` | Development server |
| `npm run build` | Production build |
| `npm start` | Serve the production build |
| `npm run typecheck` | TypeScript, no emit |
| `npm run proof` | 395 checks on the application |
| `npm run proof:db` | Installs the schema into a throwaway Postgres: 239 checks, then 17 more on re-running and recovering the install |
| `npm run redteam:webhook` | 14 checks against a live payment webhook |

## Layout

```
src/
  app/                     routes
    page.tsx               marketing homepage
    app/[game]/            the dashboard, per game
  components/              shared interface pieces
  lib/
    games.ts               the game registry — all per-game differences
    demo.ts                example content, and the rules that keep it honest
```

### The game registry

`src/lib/games.ts` is the reason this is one application rather than six. A game
declares which modules it enables, its item categories and variant attributes,
and its activity vocabulary. Navigation, Explore and the dashboard read that
configuration. Adding a seventh game is an entry in the registry plus an item
catalogue — never a new route tree, and never a `if (game === ...)` branch
inside a component.

### Example content

Nothing on the site invents activity. `src/lib/demo.ts` is the only source of
placeholder content, it is off unless `NEXT_PUBLIC_DEMO_MODE=on`, it refuses to
run in a production build, and everything it returns is badged as example
content on screen. With it off, the interface shows its real empty states.

### Glass surfaces

Translucency is used for depth, never for legibility. Anything that floats over
page content — menus, the navigation rail, the touch bar — uses `.glass-overlay`,
which has an opaque floor. `backdrop-filter` is dropped silently without GPU
compositing and by the reduce-transparency accessibility setting, so no text
depends on it.

## Not yet built

Sign-in, the database, listings, search, messaging and moderation. Unbuilt
surfaces say so rather than pretending to work.

Two things must happen outside the code before sign-in can exist:

1. The Roblox account must be ID-verified, which Roblox requires before it will
   let you register and publish an OAuth 2.0 app.
2. An unreviewed Roblox OAuth app serves at most 10 unique users. Passing that
   needs app review, which requires a published privacy policy and terms of
   service.

## Boundaries

MintPlaza is not affiliated with, endorsed by, or sponsored by Roblox
Corporation. It never asks for a password, cookie or session token; it never
holds, escrows or completes a trade; it does not sell Robux or game items.
