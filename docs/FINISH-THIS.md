# Finish MintPlaza — everything left to do, in order

This is the only file you need. Work top to bottom. Every step says what to do,
what you should see when it worked, and what to do when it did not.

Nothing in here needs code written. The site is finished and tested — 499 app
checks, 239 database checks, 17 install checks and 13 webhook attack checks all
pass. What is left is accounts, DNS and paperwork.

**Do the parts in order.** Part 5 (Razorpay) will reject you if Part 1 (domain)
is not done first.

---

## Table of contents

| Part | What | How long |
| --- | --- | --- |
| [0](#part-0--what-you-have) | What you have, and where | read once |
| [1](#part-1--connect-the-domain) | Connect the domain | 30 min + DNS wait |
| [2](#part-2--tell-supabase-about-the-domain) | Tell Supabase about the domain | 5 min |
| [3](#part-3--give-yourself-the-admin-panel) | Give yourself the admin panel | 5 min |
| [4](#part-4--check-the-whole-site-works) | Check the whole site works | 20 min |
| [5](#part-5--razorpay) | Razorpay | 1 hr + 2–5 days waiting |
| [6](#part-6--turn-level-up-on) | Turn Level Up on | 20 min |
| [7](#part-7--launch-it-properly) | Launch it properly | 1–2 weeks |
| [8](#part-8--running-it-every-day) | Running it every day | forever |
| [9](#part-9--when-something-breaks) | When something breaks | reference |
| [10](#part-10--money-tax-and-legal) | Money, tax and legal | reference |

---

## Part 0 — What you have

### Accounts

| Thing | Where | What it is |
| --- | --- | --- |
| Code | GitHub | Branch `claude/mintplaza-spec-review-o7zq7g` |
| Hosting | [vercel.com](https://vercel.com) | The website itself |
| Database | [supabase.com](https://supabase.com) | Project `bfmjslvpssufcujfhbce` |
| Domain | [godaddy.com](https://godaddy.com) | Under verification |
| Payments | Razorpay | Not created yet — Part 5 |

### Secret values you must never share

- **`SUPABASE_SERVICE_ROLE_KEY`** — ignores every security rule in the database.
  Anyone holding it owns all your data. Never in a screenshot, never in a chat,
  never in a file you commit.
- **`RAZORPAY_WEBHOOK_SECRET`** — anyone holding it can give themselves free
  Level Up forever.
- Neither one ever gets `NEXT_PUBLIC_` in front of it. Anything starting
  `NEXT_PUBLIC_` is downloaded by every visitor.

### Docs already in the repo

- `docs/go-live.md` — the original deploy guide
- `docs/roblox-sign-in.md` — Roblox login setup, with a troubleshooting table
- `docs/legal-review.md` — what to take to a lawyer, and why
- `supabase/schema.sql` — the whole database in one file, safe to re-run

---

## Part 1 — Connect the domain

Do this the moment GoDaddy finishes verifying your documents.

### 1.1 Add the domain in Vercel first

Doing this before touching DNS means Vercel shows you the exact records to add.

1. [vercel.com](https://vercel.com) → your MintPlaza project
2. **Settings → Domains**
3. Type your domain (e.g. `mintplaza.com`) → **Add**
4. Choose **Add `mintplaza.com` and redirect `www` to it** (the recommended option)

Vercel now shows you DNS records to add. **Use the values Vercel shows you, not
values from any guide including this one** — Vercel changes their IPs and the
dashboard is always right.

It will look roughly like:

| Type | Name | Value |
| --- | --- | --- |
| A | `@` | (an IP address Vercel gives you) |
| CNAME | `www` | (a hostname Vercel gives you) |

**Leave this Vercel tab open.** You need to copy from it.

### 1.2 Add those records in GoDaddy

1. [godaddy.com](https://godaddy.com) → sign in → **My Products**
2. Find your domain → **DNS** (or "Manage DNS")
3. **Delete** any existing `A` record on `@` and any `CNAME` on `www` that
   GoDaddy added by default — they point at a GoDaddy parking page.
   - GoDaddy often adds a `CNAME www → @` and an `A @ → some parking IP`.
   - Removing these is safe. Nothing of yours is on them.
4. **Add** each record Vercel showed you. Exactly as shown — no trailing dots,
   no `https://`, no spaces.
5. Save.

### 1.3 Wait

DNS takes 10 minutes to 48 hours. Usually under an hour with GoDaddy.

Back in Vercel → Settings → Domains, the domain shows:
- 🟡 **"Invalid Configuration"** → DNS has not spread yet, or a record is wrong.
  Wait 30 minutes and reload. If it still complains after 2 hours, re-check the
  records character by character.
- 🟢 **"Valid Configuration"** → done. Vercel issues the SSL certificate
  automatically within a few minutes.

**You should see:** `https://yourdomain.com` loads MintPlaza with a padlock in
the address bar.

### 1.4 Tell the site its own address

This one is easy to forget and it breaks every link preview if you skip it.

1. Vercel → your project → **Settings → Environment Variables**
2. Add:

   | Key | Value | Environments |
   | --- | --- | --- |
   | `NEXT_PUBLIC_SITE_URL` | `https://yourdomain.com` | Production |

   No trailing slash. Include the `https://`.

3. **Deployments** tab → the newest deployment → **⋯** menu → **Redeploy**

   Environment variables only take effect on a new build. Without this redeploy
   the variable does nothing.

**You should see:** pasting your link into Discord or WhatsApp shows the
MintPlaza preview card with the icon — not a broken image.

---

## Part 2 — Tell Supabase about the domain

**Skip this and Roblox sign-in breaks with no error message at all.** Roblox
will approve the login and then drop the player on `localhost`. This is the
single most common way a launch goes wrong.

1. [supabase.com](https://supabase.com) → your project
2. **Authentication → URL Configuration**
3. **Site URL**: set to `https://yourdomain.com`
4. **Redirect URLs**: click Add and enter exactly:

   ```
   https://yourdomain.com/**
   ```

   The `/**` on the end is required. The login carries a `next` parameter, so
   the exact address is never the same twice and a plain domain will not match.

5. **Keep the old Vercel URL entry too** (`https://mintplaza-alexxagemimi-cpu.vercel.app/**`).
   Costs nothing, and means the preview deployments keep working.
6. Save.

**You should see:** you can sign in with Roblox on your real domain and land
back on MintPlaza, signed in.

---

## Part 3 — Give yourself the admin panel

Without this you have **no moderation, no report queue, and no way to grant
Level Up by hand**. Do it before anyone else uses the site.

### 3.1 Make sure the database is current

Even if you pasted it before, paste it again. The file is safe to run any
number of times — this is tested by 17 automated checks.

1. Supabase → **SQL Editor** → **New query**
2. Open `supabase/schema.sql`, select all, copy, paste into the box
3. **Run**. Takes 10–30 seconds.

**You should see:** `Success. No rows returned`. That is what success looks
like — it is not an error.

It does **not** delete players, listings, messages or subscriptions.

### 3.2 Put yourself on the admin allowlist

New query, run this:

```sql
insert into mintplaza.admin_allowlist (roblox_username) values ('alx22n')
on conflict do nothing;
```

Change `alx22n` if that is not your Roblox username.

Your **username** goes in because it is the only thing you know about your
account before you have ever signed in. It is used exactly once: the first
sign-in that matches pins your numeric Roblox ID, and every check after that is
against the ID. If somebody later renames themselves to `alx22n`, they match
nothing.

No password goes in this table. Your Roblox account is the credential.

### 3.3 Change the panel passcode

It ships as `1927`. Change it:

```sql
select mintplaza.set_console_passcode('pick-something-only-you-know');
```

Changing it closes every open panel session.

**Write the new passcode down somewhere.** There is no recovery — you would
have to run this SQL again to reset it.

### 3.4 Open the panel

1. Sign in with your admin Roblox account
2. Go to any screen with a search box — Explore, your inventory, or post-a-listing
3. Type exactly: `/openadminpanel`
4. A green card appears above the results. Tap it.
5. Enter your passcode.

Capitals are fine (`/OpenAdminPanel` works). Spaces before or after are fine.
A wrong letter anywhere is not a match.

For everyone else the phrase does nothing, and `/admin` in the address bar is a
404 page. It is not a password — the panel answers to your account only.

**You should see:** the admin panel, with tabs for reports, support and
announcements.

---

## Part 4 — Check the whole site works

Do all of these on your **real domain**, on your **phone**, signed out first
and then signed in.

| # | Check | Where | Expected |
| --- | --- | --- | --- |
| 1 | Site loads, six games | `yourdomain.com` | Six game cards |
| 2 | Padlock in address bar | any page | Secure, no warning |
| 3 | Terms box blocks sign-in until ticked | `/login` signed out | Button disabled until ticked |
| 4 | Roblox sign-in works | `/login` | Lands back signed in |
| 5 | Post a listing | any game → Trades | Appears on the board |
| 6 | Send a message | any profile → Message | Arrives |
| 7 | Report button works | any listing → Report | Confirms, appears in panel |
| 8 | Panel opens | search box → `/openadminpanel` | Panel opens with your code |
| 9 | Level Up says "not on sale yet" | `/upgrade` | Honest message, no fake button |
| 10 | Footer links all work | bottom of home | Privacy, Terms, Refunds, Contact, Pricing |
| 11 | Link preview works | paste link in Discord | MintPlaza card, not broken image |

### Environment variables Vercel should have right now

Settings → Environment Variables:

| Key | Value | Required |
| --- | --- | --- |
| `NEXT_PUBLIC_SUPABASE_URL` | `https://bfmjslvpssufcujfhbce.supabase.co` | Yes |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Supabase → Settings → API → anon | Yes |
| `SUPABASE_SERVICE_ROLE_KEY` | Supabase → Settings → API → service_role | Yes |
| `NEXT_PUBLIC_DEMO_MODE` | `off` | Yes |
| `NEXT_PUBLIC_SITE_URL` | `https://yourdomain.com` | Yes |
| `NEXT_PUBLIC_DEV_LOGIN` | **leave out entirely** | No |
| `DEV_PASSWORD` | **leave out entirely** | No |

If `NEXT_PUBLIC_DEV_LOGIN` or `DEV_PASSWORD` are set in Production, **delete
them now**. They are for local testing. (They are also blocked from working in
a production build regardless, so this is belt and braces — but delete them.)

---

## Part 5 — Razorpay

**Do not start this until Part 1 is finished.** Razorpay's reviewer opens your
website. A `vercel.app` address is a common reason to be rejected.

### 5.1 Before you apply — the one thing that decides it

Razorpay will ask what your business sells. **How you answer decides whether
you are approved.**

You are selling **a subscription to website features** — extra listing slots
and longer listings on a classifieds site. That is ordinary software, and it is
an accepted category.

You are **not** selling game items, virtual currency, Robux, or anything inside
a game. You never touch an item, never hold one, never take a cut of a trade.
Trades happen inside Roblox using Roblox's own trading system.

That distinction is true, it is why the site is legal, and it is what you tell
them.

**Write this in the business description box:**

> A subscription service on a classifieds website. Paying users receive
> additional listing slots and longer listing durations on the site. The
> subscription grants website features only; no physical or in-game goods are
> sold, held or transferred.

**Do not write:** "Roblox trading", "virtual items", "game items", "trading
platform". All of those read as restricted categories to a reviewer skimming
quickly.

**Business category:** pick **SaaS**, **Software**, or **Digital Services**. If
those are not offered, **E-commerce → Digital Goods**. Avoid anything named
Gaming, Gambling, Virtual Currency or Crypto.

**Website URL to give them:** `https://yourdomain.com/upgrade` — your actual
product page, showing the price and what is included. Not the homepage.

### 5.2 Documents to have ready

All in **your own name** — you are 19, you can do this yourself:

- [ ] **PAN card**
- [ ] **Aadhaar**
- [ ] **Bank account** in your name (savings is fine for an individual account)
- [ ] **Cancelled cheque** or a bank statement showing account number + IFSC
- [ ] Your phone number and email

Account type: **Individual / Sole Proprietor**. No company required.

> **Why not your dad's account:** whoever's KYC it is, is the merchant. The
> income goes on their PAN at their tax rate, and a chargeback or tax notice is
> addressed to them. Most gateway agreements also forbid running someone else's
> business through your account, and accounts get frozen for it — usually with
> money still in them. If you want him to have the money, open it in your name
> and transfer it after it settles. That is a family transfer and nobody's
> business. Full reasoning: `docs/legal-review.md` §1.

### 5.3 Sign up

1. [razorpay.com](https://razorpay.com) → **Sign Up**
2. Your own email and phone
3. Account type: **Individual / Proprietorship**
4. Fill in the business details using the wording from 5.1
5. Upload the documents from 5.2
6. Submit

### 5.4 Wait, and answer carefully

Usually **2–5 working days**. They may email or call asking for clarification.

Answer with the same framing every time: *a subscription that unlocks features
on my website.* If they ask specifically about Roblox, the true answer is:

> The site is a noticeboard where players find each other to trade. The trades
> themselves happen inside Roblox using Roblox's own system. MintPlaza never
> holds, transfers or sells any in-game item and takes no commission on trades.
> The only thing sold is a subscription to website features.

**If they reject you:** it is not the end. `docs/go-live.md` lists Cashfree
(same shape, worth trying next) and Instamojo (easiest sign-up, slightly higher
fees). Nothing in the code changes — it is the same two settings either way.

### 5.5 Once approved — build the payment page

Razorpay Dashboard → **Payment Pages** → **Create Payment Page**.

- **Title:** `MintPlaza Level Up`
- **Amount:** `399` INR, fixed
- **Description:** what they get — 10 listings per game instead of 4, 10 new
  listings every 12 hours instead of 4 a day, listings last 3 days instead of 1.
  Say it lasts **60 days**.

**Now the critical bit.** Add a **custom field**:

- Field label: **`Roblox username`**
- Type: text
- **Required: yes**

**Why this matters more than anything else on the page:** the webhook grants
Level Up to a username. Razorpay's payment page has one URL for everybody, so
the payment itself has to carry who it is for. A payment that arrives without a
username is real money with no account to put it on — the site will refuse it,
log it loudly, and you will have to grant it by hand.

Save and **copy the payment page URL**. You need it in Part 6.

### 5.6 Set up the webhook

**Generate a secret first.** On any computer with Node installed:

```bash
node -e "console.log(require('node:crypto').randomBytes(32).toString('hex'))"
```

Copy the long string it prints. You will paste it in **two places and nowhere
else**.

Razorpay Dashboard → **Settings → Webhooks → Add New Webhook**:

| Field | Value |
| --- | --- |
| Webhook URL | `https://yourdomain.com/api/level-up/webhook` |
| Secret | the string you just generated |
| Active events | `payment.captured` — also tick `order.paid` and `payment_link.paid` |

Save.

---

## Part 6 — Turn Level Up on

### 6.1 Add the two settings to Vercel

Settings → Environment Variables → add both, **Production**:

| Key | Value |
| --- | --- |
| `LEVEL_UP_CHECKOUT_URL_INR` | your Razorpay payment page URL |
| `RAZORPAY_WEBHOOK_SECRET` | the secret from 5.6 — **identical**, no spaces |

`LEVEL_UP_CHECKOUT_URL_USD` stays empty until you set up an international
processor. Non-Indian visitors will correctly see "not on sale yet".

**Never put `NEXT_PUBLIC_` in front of `RAZORPAY_WEBHOOK_SECRET`.** The build
will fail on purpose if you do.

### 6.2 Redeploy

Deployments → newest → **⋯** → **Redeploy**. Variables need a new build.

### 6.3 Test the webhook from Razorpay

Razorpay → Settings → Webhooks → your webhook → **Send test webhook**.

- **200** → the signature check passed. Correct.
- **401** → the secret does not match. Re-copy it into both places. A trailing
  space is the usual culprit.
- **503** → `RAZORPAY_WEBHOOK_SECRET` is not set in Vercel, or you did not
  redeploy after setting it.

### 6.4 Buy one yourself

**This is the only test that proves the whole chain.** Pay the real ₹399 with
your own card or UPI.

1. Go to `https://yourdomain.com/upgrade`
2. Pick India → tap through to checkout
3. Enter **your own Roblox username** in the custom field
4. Pay

Within a few seconds: refresh MintPlaza. You should have Level Up — 10 listing
slots instead of 4.

It costs you ₹399 minus the fee, and it is worth every rupee. If it does not
work you have found it before a stranger did.

### 6.5 Vercel Hobby → Pro

**The moment you take real money, you are using Vercel commercially, and the
free Hobby plan does not permit that.** Upgrade to **Pro ($20/month)**.

Vercel → Settings → Billing → Upgrade. Do it the same week the first payment
lands. An account suspended for terms breach takes your site down with no
warning.

---

## Part 7 — Launch it properly

You only get one first impression per person. Spend it well.

### The mistake to avoid

An empty board kills a marketplace. A visitor who lands on a site with no
listings concludes it is dead, leaves, and tells people it is dead. There is no
second launch.

Your site is honest about being empty — "Nothing to match on yet" — which is
the right behaviour, but honest-and-empty still reads as dead to a stranger.

### Phase 1 — Seed it (do this first, quietly)

Get **10–20 real traders** posting **real listings**. Friends who actually play
these six games.

The ask is not "check out my website". It is: **"post your actual trades here
instead of the Discord."**

Target: every game has listings on it before a stranger ever sees the site.

Do not fake listings yourself. Your audience is teenagers, they can smell it,
and the whole site is built on not lying to people.

### Phase 2 — Then promote

Once the board has real activity:

- **Roblox trading Discords** for your six games — this is where actual traders
  are, and it is the highest-value channel by far.
- **Ask a moderator first.** Most trading Discords ban self-promotion. Getting
  your friend banned on day one for one post is a terrible trade.
- Reddit communities for each game, TikTok/YouTube Shorts if you make content.

### Rules

- **Do not fake hype.** No bought engagement, no sock puppets. It poisons the
  one asset you have.
- **Do not promote and monetise in the same week.** If a new visitor's first
  impression is a paywall on a site with four listings, conversion is zero and
  you have taught them it is a cash grab. Usage first, Level Up after.
- **Do not promote to under-13s.** The site bans them and you have to mean it.
- **Grow no faster than you can moderate.** See Part 8.

---

## Part 8 — Running it every day

### The daily job: read the report queue

Open the panel (`/openadminpanel`) and read the reports. **Every day.** It is
the entire safety system and one person cannot read everything else.

**Act fast and over-act.** Suspending someone who turns out to be fine costs an
apology. The other mistake does not have a price you want to pay.

**If anything looks like an adult approaching a child, report it to the police
and to Roblox** — not just internally. Do not sit on it.

There is deliberately no blocking on MintPlaza (a scammer's first move would be
to block their victim), which puts more weight on the queue, not less.

### The weekly job

- Check the support inbox in the panel
- Check Razorpay for failed payments or chargebacks
- Check Supabase → Database → usage, and Vercel → usage, against your plan limits

### Granting Level Up by hand

A real payment can arrive with no username (someone left the field blank).
The site refuses it, logs it loudly with the payment ID, and answers 422.
That is deliberate — guessing would hand a stranger's subscription to whoever
typed a similar name.

Work out who it was from the Razorpay payment details (email, phone), then
grant it from the admin panel. That is what the button is for.

### If a payment succeeds and Level Up does not switch on

1. **Wait 5 minutes.** Razorpay retries failed webhook deliveries.
2. Still nothing → grant it by hand in the panel. The player is out ₹399 and
   waiting; fix them first, debug after.
3. Then check Razorpay → Settings → Webhooks → your webhook → recent deliveries
   for the error.

---

## Part 9 — When something breaks

### Sign-in fails, or dumps you on localhost

**Part 2 was skipped or is wrong.** Supabase → Authentication → URL
Configuration. Site URL must be your domain; Redirect URLs must include
`https://yourdomain.com/**` with the `/**`.

Full troubleshooting table: `docs/roblox-sign-in.md` §"If it does not work".

### `No API key found in request`

`NEXT_PUBLIC_SUPABASE_ANON_KEY` is missing or wrong in Vercel. Re-copy it from
Supabase → Settings → API → anon/public, then redeploy.

### `redirect_uri_mismatch` from Roblox

The redirect URL in the Roblox Creator Dashboard must be exactly:

```
https://bfmjslvpssufcujfhbce.supabase.co/auth/v1/callback
```

Character for character. It points at **Supabase**, not at your domain.

### The site loads but everything is empty / errors

The database schema is probably out of date. Re-paste `supabase/schema.sql`
(Part 3.1). It is safe to re-run.

### A change you made broke the site

Vercel → Deployments → find the last one that worked → **⋯** → **Promote to
Production**. Instant rollback.

### Checking the code still passes

If you ever have the repo open on a computer with Node installed:

```bash
npm install
npm run proof          # 499 app checks
npm run typecheck      # types
npm run build          # production build
```

And against a live deployment:

```bash
WEBHOOK_BASE=https://yourdomain.com \
RAZORPAY_WEBHOOK_SECRET=<your secret> \
npm run redteam:webhook   # 13 attacks, all must be refused
```

`npm run proof:db` needs a local Postgres and is optional.

---

## Part 10 — Money, tax and legal

### Before the first payment

- [ ] **Ask an accountant about GST.** India charges GST on digital services
      and the registration threshold for online supply is lower than people
      assume. Ask **before** the first payment, not in March.
- [ ] **Decide whose name the money is in** — and decide it on purpose. See 5.2
      and `docs/legal-review.md` §1.

### Keep money back for refunds

Your Terms promise: a refund within 14 days if unused, a full refund for a
payment made without the cardholder's permission, and a pro-rata refund if the
site shuts down. **Those are real promises.** Keep enough of the money to
honour them.

### Chargebacks

A parent who sees an unexplained ₹399 will reverse it. Each one costs a fee on
top of the refund, and too many closes a processor account.

Set your Razorpay **statement descriptor** to `MINTPLAZA` so it is recognisable
on a bank statement. Keep the under-18 warning on the upgrade page.

### The lawyer conversation

When you can afford an hour of a lawyer's time, take them `docs/legal-review.md`
along with `/terms` and `/privacy`. That file lists exactly what needs a real
opinion, hardest first. The biggest items:

- **DPDP Act** — under-18s are "children" in India and need verifiable parental
  consent. Most of your users are under 18.
- **Never add analytics or ad networks.** Tracking and targeted advertising to
  children is prohibited outright. The site has none today. Keep it that way —
  this is the reason to say no when someone suggests it.
- **Roblox** — keep all three true: trades are item-for-item, they happen inside
  the game, and Level Up sells website features only. If MintPlaza ever takes a
  fee on a trade, holds items in escrow, or lets people advertise items for
  cash, it becomes the thing Roblox prohibits and the whole site is at risk.
- If Roblox or a game developer ever asks you to change something, **comply
  immediately and argue afterwards.** A fan site that cooperates gets a letter.
  One that does not gets a lawsuit.

---

## The short version

```
[ ] 1. GoDaddy verifies → add domain in Vercel → copy DNS records to GoDaddy
[ ] 2. Set NEXT_PUBLIC_SITE_URL in Vercel → redeploy
[ ] 3. Supabase → Auth → URL Config → add https://yourdomain.com/**
[ ] 4. Re-paste supabase/schema.sql
[ ] 5. Run the admin_allowlist insert with your Roblox username
[ ] 6. Change the panel passcode from 1927
[ ] 7. Walk the 11 checks in Part 4 on your phone
[ ] 8. Apply to Razorpay — describe it as a website feature subscription
[ ] 9. Payment page with a REQUIRED "Roblox username" field
[ ] 10. Webhook + secret in both Razorpay and Vercel → redeploy
[ ] 11. Send test webhook → expect 200
[ ] 12. Buy one yourself for ₹399
[ ] 13. Upgrade Vercel to Pro
[ ] 14. Seed 10–20 real listings with friends
[ ] 15. Then promote
[ ] 16. Read the report queue every single day
```

You built something real and it is finished. The rest is paperwork and
patience. Good luck.
