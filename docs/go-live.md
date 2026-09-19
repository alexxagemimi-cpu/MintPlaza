# Putting MintPlaza on the internet

Plain English, in order. Nothing here needs a company, a lawyer or money up
front except the last part, which is about taking money.

There are four things to do and they are independent — you can do 1 and 2 today
and leave 3 and 4 for a month. The site works completely without payments.

1. [The database](#1-the-database) — paste one file into Supabase
2. [The website](#2-the-website) — one click on Vercel
3. [Roblox sign-in](#3-roblox-sign-in) — see `docs/roblox-sign-in.md`
4. [Getting paid](#4-getting-paid-upi-gpay-and-cards) — the longest part

---

## 1. The database

### Which file

**`supabase/schema.sql`.** That is the one. There is only one, there is no
folder of migrations to apply in order, and there is nothing to run before or
after it.

It is about 4,300 lines. That is normal — it is every table, every permission
rule, every function and the starting data for all six games in one place.

### How to paste it

1. Open your project at [supabase.com](https://supabase.com).
2. Left sidebar → **SQL Editor** → **New query**.
3. Open `supabase/schema.sql` in a text editor, select all, copy.
4. Paste into the box. Press **Run**.
5. Wait. It takes ten to thirty seconds.

You should see `Success. No rows returned`. That is what success looks like —
it is not an error, it just means the last statement was not a question.

### "Haven't I already pasted this?"

Probably, but paste it again. **The file is safe to run as many times as you
like**, and it has to be re-run because it has changed since — Level Up,
messaging, the terms record, the whole payments path and, in this last round,
the six games' categories and the panel phrase are all in it.

This is not a hope, it is tested: `npm run proof:db` installs the file into an
empty database, then installs it again, then a third time, and checks all three
land in exactly the same place. It also kills the install part-way through at
twelve different points and re-runs it, to prove a half-finished paste recovers.
17 checks, all passing.

What re-running does **not** do: it does not delete players, listings, messages
or subscriptions. It updates the structure and leaves your data alone.

### The one thing to do after

Two settings live in the database rather than in a file, because they are yours
and not the code's.

**Your admin account.** The allowlist ships **empty**, deliberately — an empty
allowlist means nobody is an admin and `/admin` stays shut, which is the right
way for this to fail. Until you run this, you have no panel. In SQL Editor:

```sql
insert into mintplaza.admin_allowlist (roblox_username) values ('alx22n')
on conflict do nothing;
```

Then sign in with that Roblox account. Your **username** goes in because it is
the only thing you know about your own account before you have ever signed in —
but it is used exactly once. The first sign-in that matches pins your numeric
Roblox id, and every check after that is against the id alone. So if somebody
later renames themselves to `alx22n`, they match nothing.

No password goes in this table and none is needed. Your Roblox account is the
credential.

**The panel passcode.** It is already `1927`. To change it:

```sql
select mintplaza.set_console_passcode('your-new-code');
```

Changing it closes every panel session that is open at the time.

### Opening the panel

Sign in as your admin account. Go to any screen with a search box — Explore,
your inventory, or the post-a-listing screen — and type exactly:

```
/openadminpanel
```

A green card appears above the results. Tap it, enter `1927`, and you are in.

It has to be that exact phrase. `openadminpanel` without the slash does not
work. `/openadminpane` does not work. Capitals are fine (`/OpenAdminPanel`
works) and so are spaces before or after, because a phone keyboard adds both —
but a wrong letter anywhere is simply not a match.

For anybody else, the phrase does nothing at all. It is not a password and
never was: the panel answers to your account and no other, so there is nothing
here for anyone to guess. `/admin` typed straight into the address bar is a 404
page for everyone else, not a login screen.

---

## 2. The website

Vercel is free at this size and made by the people who make Next.js.

1. Push your code to GitHub (it already is).
2. [vercel.com](https://vercel.com) → sign in with GitHub → **Add New Project**.
3. Pick the repository. Do not change any build setting — it detects Next.js.
4. Before deploying, add the environment variables below.
5. **Deploy.**

### The environment variables

Copy these from `.env.example`, which explains each one.

| Name | Where it comes from | Needed? |
| --- | --- | --- |
| `NEXT_PUBLIC_SUPABASE_URL` | Supabase → Settings → API | Yes |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Supabase → Settings → API → anon | Yes |
| `SUPABASE_SERVICE_ROLE_KEY` | Supabase → Settings → API → service_role | Yes |
| `NEXT_PUBLIC_DEMO_MODE` | Type `off` | Yes |
| `NEXT_PUBLIC_DEV_LOGIN` | Leave it out entirely | No |
| `DEV_PASSWORD` | Leave it out entirely | No |
| `LEVEL_UP_CHECKOUT_URL_INR` | Part 4 | Later |
| `LEVEL_UP_CHECKOUT_URL_USD` | Part 4 | Later |
| `LEVEL_UP_WEBHOOK_SECRET` | Part 4 | Later |

Three rules, and the third one is the one that bites people:

- **`SUPABASE_SERVICE_ROLE_KEY` is a real secret.** It ignores every permission
  rule in the database. Do not put it in a file you commit, do not paste it in
  a chat, do not put it in a screenshot.
- **Never put `NEXT_PUBLIC_` in front of it**, or of
  `LEVEL_UP_WEBHOOK_SECRET`. Anything starting `NEXT_PUBLIC_` is baked into the
  JavaScript that every visitor downloads. The proof script fails the build if
  either one is ever prefixed, so you cannot do this by accident.
- **Leave `NEXT_PUBLIC_DEV_LOGIN` out.** It is the password login used for
  testing. It also needs a non-production build to work at all, so shipping it
  by mistake still does not open a door — but do not ship it.

Level Up correctly says "not on sale yet" while the checkout URLs are empty,
and the webhook refuses everything while the secret is empty. That is the right
behaviour, not a broken state: a button that pretends to take money and does
not is worse than no button.

---

## 3. Roblox sign-in

`docs/roblox-sign-in.md` has the steps. The short version: Roblox's client ID
and secret go into the **Supabase dashboard** as a custom OIDC provider named
exactly `custom:roblox`. They never go into this codebase, into `.env.local`,
or into a message — Supabase does the token exchange itself, so the site never
holds the secret and cannot leak it.

There is a second half that does not exist while developing locally and is easy
to miss: Supabase must also be told that your live domain is allowed to receive
the player coming back from Roblox. Authentication → URL Configuration → add
`https://smart-rfid-and-password-door-lock-a.vercel.app/**` to Redirect URLs and
set Site URL to the same domain. Skip it and sign-in fails with no error at all
— Roblox approves, then drops the player on `localhost`. It is §3 of
`docs/roblox-sign-in.md`.

---

## 4. Getting paid: UPI, GPay and cards

This is the part you asked about, so it is the longest.

### The short answer first

**You cannot take UPI for a website subscription with a personal UPI ID and a
QR code.** Well — you can, technically, and it is a bad idea for four reasons:

1. Nothing tells the website a payment happened, so you would have to grant
   every subscription by hand, forever, at whatever hour it was bought.
2. There is no invoice and no refund trail. Your terms promise refunds. You
   cannot honour a promise you have no record of.
3. Banks close personal savings accounts used as business accounts. Not
   immediately, and not always — but it happens, and the money is frozen while
   it gets sorted out.
4. A parent who sees ₹399 leave and cannot tell what it was calls the bank, not
   you.

What you want is a **payment gateway**. It gives you a proper checkout page,
takes UPI, GPay, PhonePe, cards and netbanking, keeps the records, handles
refunds, and — the important part — **tells the website automatically** so
Level Up switches on by itself.

### Which one

| | For | Notes |
| --- | --- | --- |
| **Razorpay** | India, ₹399 | The default. Individual/sole-proprietor accounts allowed — PAN, Aadhaar and a bank account, no company needed. UPI usually costs 0%, cards about 2%. |
| **Cashfree** | India, ₹399 | Same shape. Worth a look if Razorpay's paperwork stalls. |
| **Instamojo** | India, ₹399 | Easiest sign-up of the three, slightly higher fees. Good fallback. |
| **Lemon Squeezy / Paddle** | The $6 tier | These become the **seller of record** — they take the money in their name, handle every country's sales tax themselves, and pay you out. For international sales this removes an enormous amount of tax paperwork. |

**Recommendation:** Razorpay for India, Lemon Squeezy for everywhere else. Two
accounts is not extra work, because the site already has two prices and two
checkout URLs.

### Whose name the account is in

You asked about your dad's account, so here it is straight.

You are 19. **You can open every one of these in your own name** — PAN,
Aadhaar, your own bank account. You do not need anybody to hold it for you, and
that is the option to take.

If the account is in your father's name instead, then in every way that
matters **he is the business**: the KYC is his, the settlement account is his,
the income is reported against his PAN at his tax slab, and a chargeback or a
tax notice is addressed to him. That is a fine arrangement if you both decide
on it. It is a bad one if it happens because it seemed easier, because:

- Most gateway agreements prohibit processing someone else's business through
  your account. Accounts get frozen for it, usually with money in them.
- Your Terms of Service say one person runs MintPlaza and is responsible for
  it. If a different person collects the money, a customer can fairly ask which
  of you they are dealing with. §2 now carries a sentence covering exactly
  this — but that is a patch over a mismatch, not a reason to create one.

**If you want your dad to have the money, open the account in your own name and
transfer it to him after it settles.** That is a family transfer and nobody's
business but yours. If he genuinely wants to run the business side, that is
also fine — but then change §2 to name him, and mean it.

`docs/legal-review.md` covers this, plus GST (ask an accountant *before* the
first payment, not in March).

### How it connects to the site

The site is already built for this and the hard part is done. Here is the whole
path:

```
Player taps "Get Level Up"
        │
        ▼
/upgrade  — asks which country they are in
        │
        ▼
/upgrade/go?country=IN
        │  checks they are signed in
        │  adds ?u=<their Roblox username>
        ▼
Your checkout page (Razorpay / your bolt.new page)
        │  shows the price and WHOSE account is being upgraded
        │  takes UPI / GPay / card
        ▼
Payment succeeds
        │
        ▼
Your page POSTs to  https://yoursite.com/api/level-up/webhook
        │  signed with LEVEL_UP_WEBHOOK_SECRET
        ▼
Level Up is on. Player refreshes. Done.
```

**The username travels in the link as `u`.** This matters: the webhook grants
Level Up to a username, so if your checkout page has to *ask* for it, every
typo is money that arrived with no account to put it on. Prefill it from `u`
and **show it on the page** — "Upgrading **alx22n**" — so anybody who edited
the link sees it before paying, not after.

Signed-out visitors are sent to sign in first and come back to the same price,
for the same reason: no username, nothing to grant.

### What your payment page must send

```
POST https://yoursite.com/api/level-up/webhook
x-mintplaza-timestamp: 1758240000
x-mintplaza-signature: sha256=<hex HMAC-SHA256 of `${timestamp}.${body}`>
Content-Type: application/json

{ "username": "alx22n", "payment_ref": "pay_QxYz123", "country": "IN",
  "days": 60, "amount": 399, "currency": "INR" }
```

- `username` — from `u`. Required.
- `payment_ref` — the gateway's own payment id. Required, and it is what stops
  a replayed request granting twice: it is unique in the database, so the
  second attempt is refused by Postgres itself and not by code somebody could
  forget to write.
- The signature covers `timestamp` **and** body together. Anything older than
  five minutes is refused, so a captured request is a five-minute key rather
  than a permanent one.

Generate the secret once:

```bash
node -e "console.log(require('node:crypto').randomBytes(32).toString('hex'))"
```

Put the same value in Vercel **and** in your payment page's environment.
Nowhere else. Never with `NEXT_PUBLIC_`.

### Testing it before real money

`npm run redteam:webhook` runs fourteen checks against a live endpoint:
thirteen attacks and one honest request, so it also proves a real payment still
gets through.

The attacks are: a GET instead of a POST; no signature at all; a wrong
signature; a signature made with the attacker's own secret; a valid signature
lifted onto a different body; a request from ten minutes ago; one dated ten
minutes into the future; an old signature re-sent with a fresh timestamp; a
body far too large; a truncated signature; a signed request missing the
username and payment reference; and — with the secret unset — both an unsigned
request and a signed one, to prove it fails **closed** rather than open.

All thirteen are refused. Run it against your deployment before switching the
checkout on.

Then buy one yourself, with your own card, for ₹399. It is the only test that
proves the whole chain, and it costs you ₹399 minus the fee.

### The two failures to watch for

**A payment arrives for a username that has never signed in.** The webhook
answers 422 and logs it loudly. That is deliberate — the money is real and the
account is not, so a human has to look. Grant it by hand in the panel once you
have worked out who they meant.

**A payment succeeds and the webhook does not fire.** Gateways retry, so wait
five minutes before doing anything. If it still has not landed, grant it by
hand and check your page is actually calling the webhook. The player is out
₹399 and waiting, so this is the one to fix fast.

---

## Checking it worked

| Check | Where |
| --- | --- |
| Site loads, six games | your Vercel URL |
| Sign in with Roblox | `/login` |
| Post a listing | any game → Trades |
| Send a message | any profile → Message |
| Terms box blocks sign-in until ticked | `/login`, signed out |
| Panel opens | any search box → `/openadminpanel` → `1927` |
| Level Up says "not on sale yet" | `/upgrade` |

Run `npm run proof` and `npm run proof:db` any time. 355 checks on the app,
239 on the database, 17 on installing and re-installing the database, and 14 on
the payment webhook with `npm run redteam:webhook`. If something is broken they
say which thing and where.
