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

**I cannot tell you what yours is.** It is stored bcrypt-hashed, which means
even with full database access nobody can read it back — including me. That is
the point of hashing it.

If you have forgotten it, set a new one. SQL Editor → run:

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

## 6. Still to do

- **Terms of service and Privacy policy.** Both are placeholder pages
  (`src/app/terms/page.tsx`, `src/app/privacy/page.tsx`). For a site used by
  under-18s handling valuable items, these are not optional before you
  advertise it anywhere.
- Decide whether to turn on a referral partner. `src/lib/referrals.ts` has all
  six value sites wired up with `active: false`. Flip one to `true` and set its
  `PARTNER_ID_*` variable **only once an agreement actually exists** — the
  "we earn commission" disclosure appears automatically, and claiming it
  without an agreement is a lie in the other direction.
