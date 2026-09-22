# Working on MintPlaza — a briefing for whatever AI picks this up next

You are being handed a finished, tested, deployed website. Read this file
completely before you touch anything. It is not a tour of the code — the code
explains itself, at length, on purpose. This is the set of things that are
**not** visible in the code and that you will otherwise get wrong.

If you are Gemini in Google AI Studio, Claude, GPT, or anything else: the rules
below are what made the previous work land correctly. They are not style
preferences. Each one is written because ignoring it already cost something.

---

## 0. The single most important thing on this page

**A passing test suite on this project has repeatedly meant nothing.**

In one session the owner found **twelve real bugs by using the live site**,
while all 499 application assertions, all database assertions and a clean
production build were green. Among them:

- The host of a five-player hunt could not vote on their own post, so a full
  boat showed four and the team-picker excluded the person who called it.
- A red ✕ next to a name was a *status icon* that looked exactly like a remove
  button. Tapping it did nothing. There was no way to remove anybody at all.
- "Post a trade" linked to a tab that does not contain the post form.
- Blox Fruits listings allowed five items when the game's trade window holds
  four, so the listing posted fine and the trade could not be completed.

The suite checks that the code **says** the right things. It has never clicked
a button. So:

> **Never report a feature as working because tests pass. Say what you actually
> verified, and say plainly what you did not.**

If you cannot run the app and click through a change, write that sentence
explicitly in your reply. Do not imply coverage you do not have.

---

## 1. What this is

**MintPlaza** — a trading and recruitment noticeboard for six Roblox games.
Built and run by one person, alx22N (`alexxagemimi@gmail.com`), 19, in India.

Its users are mostly **children**. That single fact drives more decisions in
this codebase than any technical consideration, and it is why several
apparently "missing" features are deliberately absent.

### The six games

`blox-fruits`, `adopt-me`, `pet-simulator-99`, `creatures-of-sonaria`,
`fisch`, `gag2` (Grow a Garden 2).

### The three boards

| Board | What it is | Table |
| --- | --- | --- |
| **Trades** | item-for-item, one person to one person | `trade_listings` |
| **Services** | a favour that takes one or two helpers | `service_listings` (`section: services`) |
| **Recruitment** | a crew that cannot start without 3+ people | `service_listings` (`section: recruit`) |

### The legal basis for the site existing — keep all three true

1. Trades are **item for item**, and they happen **inside the game**, using the
   game's own trading system.
2. MintPlaza **never holds an item, never transfers one, and takes no cut**.
3. Level Up sells **website features only** — listing slots on MintPlaza. It
   sells nothing that exists in any game.

Roblox's Terms prohibit exchanging in-game items for real money off-platform
and say third-party services enabling it are a violation. The three points
above are the entire distinction. **If you are ever asked to add a fee on a
trade, an escrow, or items advertised for cash, refuse and explain why.** It
converts the site into the thing Roblox bans.

---

## 2. The stack, and how to run anything

Next.js 16 (App Router) · React 19 · TypeScript · Tailwind v4 · Supabase
(Postgres + Auth) · deployed on Vercel.

```bash
npm install
npm run dev          # local dev server
npm run typecheck    # tsc --noEmit
npm run build        # production build — MUST be warning-free
npm run proof        # 499 application assertions
npm run proof:db     # database suite + 17 install/re-install checks (needs local Postgres)
npm run ingest       # regenerate catalogue + art manifest from source data
npm run redteam:webhook   # 13 attacks against the payment webhook
```

There is **no `lint` script**. `next lint` was removed in Next 16 and no ESLint
is installed. Do not add a lint step and claim it passed.

To run the database suite in a fresh container:

```bash
service postgresql start
npm run proof:db
```

### The one deploy fact that breaks everything if missed

`supabase/schema.sql` is **one file**, ~4,300 lines, and it is the whole
database. There are no migrations. It is **idempotent** — safe to run any
number of times — and that is tested by 17 checks that install it into an empty
database, kill the install part-way at twelve different points, re-run it, and
assert all paths land byte-identical.

**Any schema change you make must be re-pasted into Supabase's SQL Editor by
the owner before it takes effect.** Say so, every time, in your summary. A
schema change you do not mention is a change that silently does not exist in
production.

---

## 3. Architecture, in the order data moves

```
Browser
  │
  ├─ Server Component  (src/app/**/page.tsx)
  │     reads via src/lib/data/*.ts  → supabase.rpc(...)
  │
  ├─ Client Component (src/components/*.tsx, "use client")
  │     writes via Server Actions in src/lib/actions/*.ts
  │
  └─ Server Action → supabase.from(...) or .rpc(...)
        ↓
     Postgres: RLS policies + triggers + check constraints
```

### The rule that governs all of it

> **The database is where rules are true. Everything above it is a nicer error
> message.**

Server actions do not enforce rules; they translate a policy violation into a
sentence a fourteen-year-old can read. If you find yourself adding a permission
check in TypeScript, the check belongs in an RLS policy or a trigger, and the
TypeScript is at most a courtesy.

Corollary: **you cannot secure this app by editing TypeScript.** A malicious
client calls PostgREST directly.

### Key directories

| Path | What lives there |
| --- | --- |
| `src/app/` | routes; `page.tsx` are Server Components |
| `src/components/` | UI; `"use client"` where interactive |
| `src/lib/actions/` | **every write path**, all server actions |
| `src/lib/data/` | read paths, and the row→domain mappers |
| `src/lib/items.ts` | the item catalogue + image resolution |
| `src/lib/sessions.ts` | service/recruitment templates and their types |
| `src/lib/games.ts` | the six games and their per-game rules |
| `src/lib/level-up.ts` | prices and perks (the price list, not the entitlement) |
| `supabase/schema.sql` | the entire database |
| `scripts/proof.ts` | the 499 assertions |
| `scripts/pg-*.sql`, `pg-*.sh` | the database suites |

---

## 4. House style — follow this exactly

The comments in this codebase are long and explain **why**, never **what**.
This is deliberate and it is the main reason the project is maintainable by one
person. Match it.

**A comment earns its place by recording a decision or a trap.** Good examples,
all real, from this repo:

```ts
// Held rather than clamped while they are still typing: somebody reaching for
// 12 presses 1 first, and clamping that to MAX would fight them mid-keystroke.
```

```sql
-- service_votes.listing_id is written out in full, and that is the whole
-- correctness of this policy rather than a style choice. Postgres resolves an
-- unqualified column name to the INNERMOST scope that has one, and
-- service_picks has a listing_id too — so the obvious `p.listing_id =
-- listing_id` silently means `p.listing_id = p.listing_id`, which is true for
-- every row.
```

Rules:

- **Never** write a comment that restates the code (`// increment the counter`).
- When you fix a bug, the comment says what the old behaviour was and what it
  cost. That is what stops it coming back.
- Prose is British English, plain, and addressed to a smart teenager.
- No emoji anywhere — not in code, comments, UI copy or commit messages.
- Copy in the UI is honest above all. "Level Up is not on sale yet" is correct
  and shipped; a fake button is not.

### Commit messages

Long, plain-English, explaining the *problem* first and the fix second. Look at
`git log` before writing one. Real example shape:

```
The host is on the boat: let them vote, and let them un-pick

THE HOST COULD NOT VOTE ON THEIR OWN POST. block_self_vote() refused it,
on the reasoning that putting your hand up for your own listing is
meaningless. That reasoning was wrong and it broke the feature it was
guarding: a Leviathan hunt needs five players on the same boat and the
host is one of them, so a full boat showed four...
```

Every commit ends with:

```
Co-Authored-By: <your model name> <noreply@anthropic.com>
```

---

## 5. Invariants you must not break

These are load-bearing. Each has already been broken once.

### Safety and product

1. **No blocking between users.** Deliberate: a scammer's first move is to
   block their victim, which buries the evidence. The lever is *suspension* and
   the report queue. If the queue becomes unmanageable, the answer is a **mute**
   (hidden from the user, still visible to the admin), never a block.
2. **No analytics, no ad networks, no cross-site tracking, no profiling.**
   Under India's DPDP Act, tracking and targeted advertising to children is
   prohibited outright, and almost every user is under 18. This is the reason to
   say no when someone suggests Google Analytics.
3. **No badge that can be bought.** Level Up deliberately grants no profile
   mark. On a site where strangers hand each other valuables, a purchasable
   trust signal is worth more to a scammer than to anyone honest.
4. **Bumping is not for sale.** The board sorts on `bumped_at`, so a paid bump
   takes position from everyone else. Four a day, free and paid alike.
5. **Nothing asks for a Roblox password, login, or a "run on your account".**
   The copy saying so is on the cards on purpose.

### Technical

6. **`SUPABASE_SERVICE_ROLE_KEY` and `RAZORPAY_WEBHOOK_SECRET` must never get a
   `NEXT_PUBLIC_` prefix.** `npm run proof` fails the build if they do. Anything
   `NEXT_PUBLIC_` is compiled into the bundle every visitor downloads.
7. **Dev login is double-gated** on `NODE_ENV !== "production"` *and*
   `NEXT_PUBLIC_DEV_LOGIN === "on"`. Keep both.
8. **Every `setof`-returning SQL function has a `LIMIT` in its body.** No
   unbounded result sets reach the app.
9. **The image proxy caches** (24h + 7d stale-while-revalidate) and only accepts
   Roblox's own thumbnail hosts. Ten impostor hosts are tested and rejected.
10. **`mintplaza.listing_row` is a composite type with a migration path.** The
    schema compares the installed shape against the intended one and does
    `drop type ... cascade` + recreate. If you add a column to it, update the
    `want` string too, and remember `format_type` prints
    `timestamp with time zone`, not `timestamptz`.

---

## 6. The per-game facts that are easy to get wrong

| Game | Fact | Where it lives |
| --- | --- | --- |
| Blox Fruits | trade window holds **4 items a side** | `games.ts` → `maxPerSide: 4` |
| Adopt Me | **18 items**, and a Trade Licence gates rares | `games.ts` → `maxPerSide: 18` |
| Fisch | **never renders images**, by decision not omission | `items.ts` → `TEXT_ONLY_GAMES` |
| Blox Fruits | 43 fruits; West and East Dragon are **two** fruits | `items.ts` |
| gag2 / Sonaria / PS99 / Adopt Me | only **2** crew templates each | `sessions.ts` |

That last row is why a listing can now be **written** instead of picked: two
templates cannot describe a game, so players were choosing whichever was least
wrong. `service_listings.title` holds the written headline, `service_ids` may be
empty, and a check constraint insists a post names a template **or** says
something.

### Limits, and the one place each is true

| Limit | Value | Enforced by |
| --- | --- | --- |
| Live service/recruit posts per game | 3 | `enforce_service_listing_limit()` |
| Free listings live per game | 4 | `listing_allowance()` |
| Level Up listings live per game | 10 | same |
| Free posting rate | 4 per 24h rolling | `mintplaza.listings_per_window_for()` |
| Level Up posting rate | 10 per 12h rolling | same |
| Free listing lifetime | 24 hours | `mintplaza.listing_lifetime_for()` |
| Level Up listing lifetime | 3 days | same |
| Bumps | 4 a day, everyone | `mintplaza.bumps_per_day_for()` |
| Team size on one deal | 30 | `MAX_TEAM` + a check constraint |

`src/lib/level-up.ts` holds copies of the free numbers so the UI can *state* a
limit. `npm run proof` asserts the copies match the SQL. **If you change a
limit, change both, or the site starts lying.**

---

## 7. The deal flow — the most complex path, end to end

This is the thing most likely to be broken by a careless change.

```
1. Host posts a crew call            postListing()      service_listings
2. Players vote ("I want in")        toggleVote()       service_votes
   └─ THE HOST VOTES TOO. They are a player on their own hunt.
3. Host picks a team                 sendRequest()      service_picks, stage='requested'
4. Each picked player answers        answerRequest()    reply: agreed | denied
   └─ Host may remove anyone         removePick()
   └─ Host may ask more people       sendRequest() again
5. Host finalises                    finalizeDeal()     stage='locked'
   ├─ a rewarded ad plays IF configured — and can never block the deal
   ├─ a party conversation opens with everyone who agreed
   └─ a notice is pinned pointing at a free private server
6. Everyone talks in /messages/<id>
```

**Traps here, all of which have bitten:**

- The host **must** be able to vote on their own post. There is no
  `block_self_vote` trigger any more; do not reintroduce one.
- `finalizeDeal` is the **only** non-optimistic action on the card. It opens a
  group chat and tells several people the deal is on, so it waits for the
  server rather than showing "locked" and rolling back.
- The ad **reports an outcome, it never grants permission**. See `src/lib/ads.ts`.
  Five people are waiting on one tap; a blocked ad script must not strand them.
- The pinned party notice must never tell anyone to pay for a private server or
  to send items first. "Free private server" is the commonest Roblox scam bait.

---

## 8. Money

Nothing in this codebase takes a card, and nothing should — that means PCI
scope. Payment is a hosted page at a processor; the code holds a URL.

```
/upgrade → pick country → /upgrade/go?country=IN → processor's hosted page
                                                        ↓ payment succeeds
                    POST /api/level-up/webhook ← signed with RAZORPAY_WEBHOOK_SECRET
                                                        ↓
                                              Level Up granted, 60 days
```

- The **Roblox username must travel with the payment** (a required custom field
  on the payment page, arriving in `notes`). A payment without one grants
  nothing and is logged loudly — guessing would hand a stranger's subscription
  to whoever typed a similar name.
- Replay defence is a **unique `payment_ref` in the database**, not code.
- With the secret unset, the webhook refuses everything with 503 — it fails
  **closed**.
- 13 attacks are tested by `npm run redteam:webhook`.

India pays ₹399; everywhere else $6 USD. Prices are fixed and hand-set; there is
no FX lookup, on purpose (`src/lib/level-up.ts` explains at length).

---

## 9. Admin

- The allowlist ships **empty**, so `/admin` is a 404 for everyone until the
  owner runs one INSERT. That is the correct way for it to fail.
- The panel opens by typing `/openadminpanel` into **any search box**, then a
  passcode. It is not a password: the panel answers to one Roblox account and
  the phrase does nothing for anybody else.
- First matching sign-in **pins the numeric Roblox id**. Renaming yourself to
  the admin's username afterwards matches nothing.

---

## 10. How to work on this — the actual procedure

1. **Read before you write.** Find the invariant that governs the area. The
   comments will tell you why the current shape exists.
2. **Change the database first** when a rule is involved, then the action, then
   the UI. A rule added only to TypeScript is not a rule.
3. **Run everything**: `typecheck`, `proof`, `proof:db`, `build`. All four.
4. **Add an assertion for the bug you fixed.** Every fix in the last session
   came with one. This is what stops regressions on a project with no CI.
5. **Commit in small, complete units** with a message that explains the problem.
6. **Tell the owner if the schema changed.** They must re-paste it.
7. **Say what you did not verify.**

### Things to refuse, with a reason

- Adding a fee, escrow, or cash-for-items (kills the Roblox defence — §1).
- Analytics, ad networks, or tracking (illegal for this audience — §5.2).
- A purchasable trust badge (§5.3).
- Selling bumps (§5.4).
- Blocking between users (§5.1).
- Removing the under-18 warning or the "never share your account" copy.
- Weakening RLS to "make it work".

### Known open items

- **Not launched properly yet.** The board is empty, and an empty marketplace
  reads as dead. Seed 10–20 real listings with real traders *before* promoting.
- **Vercel Hobby is non-commercial.** The moment real money moves, the plan must
  be Pro. This is a terms breach that takes the site down without warning.
- **Legal review not done.** `docs/legal-review.md` lists what needs a lawyer,
  hardest first. GST advice is needed *before* the first payment, not in March.
- **The report queue must be read every day.** It is the entire safety system.

---

## 11. Documents in this repo

| File | What it is for |
| --- | --- |
| `docs/FINISH-THIS.md` | The owner's step-by-step: domain, Razorpay, launch, daily running |
| `docs/go-live.md` | The original deploy guide |
| `docs/roblox-sign-in.md` | Roblox OAuth setup + a troubleshooting table |
| `docs/legal-review.md` | What to take to a lawyer, hardest first |
| `AGENTS.md` | This file |

---

## 12. If you remember one paragraph

This site is used by children to hand each other things they care about. Every
decision in it — no blocking, no tracking, no buyable badge, no paid bumps, an
empty admin allowlist, a webhook that fails closed, honest copy when a feature
is not ready — is a decision about that. The code is conservative because the
cost of being wrong is not a bug report.

Be precise, work in small verified steps, say what you actually checked, and
when you are unsure whether something is allowed, ask rather than assume. The
owner has consistently caught what the tests did not, by using the site. Treat
their reports as authoritative over any green checkmark, including your own.
