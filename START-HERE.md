# MintPlaza — how to get it running

Everything in order. Nothing here needs a code editor.

---

## 1. The database

Open your Supabase project → **SQL Editor** → paste the whole of
`supabase/schema.sql` → **Run**.

It is safe to run more than once. Running it again on a database that already
has data changes nothing it should not — that is tested by
`npm run proof:db`, which applies it three times in a row and checks the result
is identical to a single clean run, and stops it at twelve different points
mid-way to check it recovers.

You will see a lot of green "NOTICE" lines. Those are the script telling you
what it did, not errors.

### What it will tell you about

- **Retired games.** Murder Mystery 2, Royale High and the original Grow a
  Garden are removed. It prints how many listings and items it is taking with
  each one *before* deleting, so a surprise is impossible.
- **Old values.** If you ran an earlier version, it drops the value-history
  table and strips `valuePhysical`, `valuePermanent` and `demand` out of every
  item. Beli and Robux prices are kept — those are the game's own shop prices
  and they do not move.

---

## 2. The control panel

### The phrase

The panel has **no link anywhere on the site**. You reach it by typing one of
these into the site's own search bar, signed in as your admin account:

```
control panel
console
studio
admin
```

Any of the four works. For anyone who is not on the allowlist the phrase
matches nothing, so as far as search is concerned the panel does not exist.

### The passcode

**1927.** The schema seeds it the first time it runs.

It is stored bcrypt-hashed, so nobody can read it back out of the database —
including me. 1927 is what it is set TO, not something recovered from anywhere.

Re-running the schema will **not** reset it back to 1927 once you have changed
it. The seed only fires when no passcode exists at all, so a code you set
deliberately is never quietly undone by an apply.

To change it, SQL Editor → run:

```sql
select mintplaza.set_console_passcode('your-new-code-here');
```

Minimum four characters. Setting a new one also signs out every open panel
session, so an old tab cannot keep the door open.

To check one is set at all:

```sql
select count(*) from mintplaza.console_secret;
```

`1` means set, `0` means not set yet.

### Getting yourself on the allowlist

```sql
insert into mintplaza.admin_allowlist (roblox_username) values ('alx22n')
on conflict do nothing;
```

Then **sign in once**. The first sign-in that matches pins your numeric Roblox
id, and every check after that is against the id — so renaming yourself later
does not lock you out, and nobody who takes your old username gets in.

---

## 3. Deploying

Push to GitHub, import into Vercel, and set these environment variables:

**Required**

| Name | Where to get it |
| --- | --- |
| `NEXT_PUBLIC_SUPABASE_URL` | Supabase → Settings → API |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Supabase → Settings → API → `anon` / public |

**For the payment webhook (section 4)**

| Name | Notes |
| --- | --- |
| `SUPABASE_SERVICE_ROLE_KEY` | Supabase → Settings → API → `service_role`. **Never** prefix `NEXT_PUBLIC_`. |
| `LEVEL_UP_WEBHOOK_SECRET` | Make one: `node -e "console.log(require('node:crypto').randomBytes(32).toString('hex'))"` |

**Optional**

| Name | Notes |
| --- | --- |
| `LEVEL_UP_CHECKOUT_URL_INR` | Your ₹399 checkout page |
| `LEVEL_UP_CHECKOUT_URL_USD` | Your $6 checkout page |
| `NEXT_PUBLIC_DEMO_MODE` | Leave unset. `on` shows badged example listings. |

With the checkout URLs unset, the upgrade screen says honestly that Level Up is
not on sale yet. That is correct behaviour, not a placeholder.

---

## 4. Wiring up the payment page

Build the checkout wherever you like. When a payment succeeds, have it send
one HTTP request to MintPlaza and the player gets Level Up immediately.

```
POST  https://your-site.example/api/level-up/webhook

Headers:
  content-type: application/json
  x-mintplaza-timestamp: <unix seconds, e.g. 1789459200>
  x-mintplaza-signature: sha256=<see below>

Body:
  {
    "username": "alx22n",
    "payment_ref": "order_12345",
    "country": "IN",
    "days": 60
  }
```

The signature is an HMAC-SHA256 of the string `` `${timestamp}.${rawBody}` ``
using `LEVEL_UP_WEBHOOK_SECRET`, as hex. In Node:

```js
const sig = require("node:crypto")
  .createHmac("sha256", process.env.LEVEL_UP_WEBHOOK_SECRET)
  .update(`${timestamp}.${rawBody}`)
  .digest("hex");
```

Sign the **raw body string you are about to send**, not a re-serialised object —
`JSON.stringify` reorders keys and the signature will not match.

### Things worth knowing

- **`payment_ref` must be unique per payment.** It is what stops a retried
  delivery granting 60 days twice. Every payment provider retries; this is
  normal, and a repeat delivery returns `already_applied: true` and changes
  nothing.
- **The signature expires in five minutes.** A captured request cannot be
  replayed tomorrow.
- **The player must have signed in to MintPlaza at least once**, or there is no
  account to attach the subscription to. That case returns a 422 and logs
  loudly — somebody's money arrived and their account did not, and a human has
  to fix it. You can then grant it by hand in the control panel.
- **With no secret set, the endpoint refuses everything** with a 503, including
  a perfectly signed request. It fails closed on purpose.

Test it yourself with `npm run redteam:webhook`, which attacks a running copy
twelve ways and checks all twelve are refused.

### Or do nothing at all

The control panel's **Level Up** section grants it by hand: type a username,
pick a country, press the button. That is a real path, not a stopgap — you will
still want it for gifts, refunds, and payments that arrive some other way.

---

## 5. Checking it works

```
npm run typecheck      # types
npm run proof          # 135 checks on the app
npm run proof:db       # 128 checks + 17 recovery checks, needs local Postgres
npm run redteam:webhook  # 12 attacks on the payment endpoint
npm run build          # production build
```

---

## 6. What Level Up actually is

60 days. One payment, no auto-renew, nothing to cancel — after 60 days it
simply stops.

| | Free | Level Up |
| --- | --- | --- |
| Listings up at once, per game | 3 | **10** |
| How long a listing lasts | 24 hours | **3 days** |

That is the whole list, and the short list is the point.

**Why listings expire in a day on free.** A trading board dies when it fills
with posts for items that were traded away last week — a player who scrolls
past four dead listings stops trusting the fifth. A day is long enough that
posting in the evening still works next morning.

**What is deliberately not sold:**

- **Bumping.** Everyone gets one bump every 6 hours. The board sorts by most
  recently bumped, so a paid bump is the one perk that takes something from
  everybody else — it pushes their listings down. That turns the board into a
  pay-to-be-seen ladder, which is how every marketplace that tries it ends up.
- **Live posts.** The 25-minute recruitment posts with the voting are 3 per
  game for everybody, free and paid alike.
- **A badge.** There is no Level Up mark on a profile. On a site where
  strangers hand each other valuable items, a mark you can buy for ₹399 is
  worth more to a scammer than to anybody honest — they would be first in the
  queue — and small print underneath does nothing about what it looks like at
  a glance.

---

## 7. There is no blocking, on purpose

A scammer's last move is to block the person they just took an item from. It
buries the conversation, ends the confrontation, and leaves the victim with
nothing to point at. Blocking hands the tool to whoever uses it first, and on a
trading board that is nearly always the person in the wrong.

**Reporting replaces it.** A report lands in your panel with the message
attached. From there you set that profile's status to `restricted` or
`suspended`, and the database stops them messaging **anybody** — not just the
one person who complained.

That is the better shape: a block protects one person, a suspension protects
everybody the account has not reached yet.

**The honest trade-off:** somebody being pestered cannot make it stop
themselves; they have to report and wait for you. That puts real weight on you
actually reading the report queue. If it ever gets too big to keep up with,
the thing to add is not blocking — it is a mute that hides a conversation
without hiding it from you or from moderation.

---

## 8. Before you launch — read docs/legal-review.md

The Terms of Service and Privacy Policy are written and live at `/terms` and
`/privacy`. Every player has to tick a box agreeing to them before they can use
the site, and that agreement is recorded against the version they saw.

**`docs/legal-review.md` lists what still needs a real lawyer**, hardest first.
One item on it is not optional and has to be settled before a single payment is
taken: the site's operator is 13, a minor cannot form a binding contract in
India, and no payment processor will open an account for one. The terms already
name a parent or guardian as the responsible operator — that has to become true
in fact, with the payment account in their name.

## 9. Still to do
- Decide whether to turn on a referral partner. `src/lib/referrals.ts` has all
  six value sites wired up with `active: false`. Flip one to `true` and set its
  `PARTNER_ID_*` variable **only once an agreement actually exists** — the
  "we earn commission" disclosure appears automatically, and claiming it
  without an agreement is a lie in the other direction.
