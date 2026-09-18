# Read this before you launch

The Terms of Service and Privacy Policy on this site are careful, specific and
honest. They were written against what the code actually does, and the proof
script checks that they keep matching it.

**They were not written by a lawyer and have not been reviewed by one.** That
is not false modesty — it is the single most important sentence in this file.
A terms page is only worth what a court thinks of it, and nothing here has been
in front of anybody qualified to judge that.

What follows is everything that genuinely needs a real opinion, hardest first.

---

## 1. The operator is 13. This is the one to sort out first.

**The problem.** In India, a contract made by a minor is `void ab initio`
(Indian Contract Act 1872, §11) — not voidable, not shaky, *void from the
start*. The same broad principle applies in most countries. That cuts two ways
and both are bad:

- The Terms of Service are an agreement between the user and **the operator**.
  If the operator cannot legally contract, it is genuinely unclear what has
  been formed. The one document that exists to protect you may not.
- Every payment processor — Stripe, Razorpay, Paddle, Lemon Squeezy, all of
  them — requires the account holder to be 18+. Opening one by saying otherwise
  is a term-of-service breach that gets funds frozen, usually after money has
  come in and been spent.

**What the terms currently say.** §2 names a parent or guardian as legally
responsible for the service, payments, and personal data. That is the right
structure and it is the honest one. But writing it down does not make it true.

**What has to actually happen before a single payment is taken:**

1. A parent or guardian genuinely agrees to be the operator. Not as a
   formality — they are the one a complaint, a refund demand or a data request
   lands on.
2. The payment account is **in their name**, with their identity documents.
3. Ideally, put their name in §2 rather than the generic phrase. A named person
   is far more credible than "a parent or guardian".

**Do not skip this by leaving Level Up switched off and taking payments some
other way.** UPI to a personal account for a service a website advertises is
the same transaction with worse records, and it is harder to refund.

---

## 2. Children's data, and India's DPDP Act in particular

Most of your users are minors. That is not incidental to this site, it is the
whole audience, and it triggers the strictest parts of three different regimes.

**India — DPDP Act 2023.** This is the one that matters most, because it is
your jurisdiction and it is stricter than people expect:

- Anybody **under 18** is a "child". Not under 13 — under 18. That is almost
  your entire user base.
- Processing a child's data requires **verifiable parental consent**.
- **Tracking, behavioural monitoring and targeted advertising to children are
  prohibited outright.**

The site is built to make the third one easy: there is no advertising, no
cross-site tracking, no analytics, and no profile built on anybody. Keep it
that way. The moment somebody suggests adding Google Analytics or an ad
network, this is the reason to say no.

The first two are not solved. The terms state that parental consent exists and
ask the user to confirm it, which is what most services do and is weaker than
"verifiable". **Ask a lawyer what verifiable means in practice for a service
this size** — the answer may be proportionate and cheap, or it may not.

**United States — COPPA.** Applies to under-13s. The site bans them and deletes
accounts when found, which is the standard approach. The risk is "actual
knowledge": if a user says in a message that they are 11 and nothing happens,
that is knowledge. Act on it when you see it.

**EU/UK — GDPR.** Children's data gets extra protection and the age of consent
varies by country (13–16). If EU traffic ever becomes significant, get advice.

---

## 3. Taking money creates obligations that outlive the sale

- **Refunds.** The terms promise a refund within 14 days if unused, a full
  refund for a payment made without the cardholder's permission, and a pro-rata
  refund if the site shuts down. Those are real promises. Keep enough of the
  money to honour them.
- **Chargebacks.** A parent who sees an unexplained ₹399 will reverse it. Each
  one costs a fee on top of the refund, and too many gets a processor account
  closed. The under-18 warning on the upgrade page exists to reduce this.
- **GST.** India charges GST on digital services. There are registration
  thresholds and they are lower than people assume for online supply. **Ask an
  accountant before the first payment, not at the end of the year.**
- **Selling to other countries.** Selling into the EU or UK can create local VAT
  obligations regardless of where you are. Worth knowing before it is a
  surprise.

---

## 4. Roblox

Roblox's Terms of Use prohibit exchanging in-game items for real money
off-platform, and state that third-party services enabling it are a violation.

**MintPlaza is not one of those services**, and the distinction is the legal
basis for the site existing:

- Trades are **item for item**, and they happen **inside the game**, using the
  game's own trading system.
- MintPlaza never holds an item, never transfers one, and takes no cut of one.
- Level Up sells **website features** — listing slots on MintPlaza. It sells
  nothing that exists in any game.

Keep all three true. If MintPlaza ever takes a fee on a trade, holds items in
escrow, or lets people advertise items for cash, it becomes the thing Roblox
prohibits and the whole site is at risk.

**Trade marks.** Naming these games to talk about them is nominative use and is
ordinary for a fan site. The disclaimer in §9 and the credits are what keep it
that way. If a developer or Roblox ever asks for something to be changed,
**comply immediately and argue afterwards** — a fan site that cooperates gets a
letter, one that does not gets a lawsuit.

---

## 5. Children messaging children

This is the risk that would end the project, and it has nothing to do with
contracts.

Private messaging between minors, with no identity verification and no age
verification, is the setting for grooming. The site has reporting, per-message
reporting, suspension, rate limits, and a safety line on every chat screen.
It does **not** have proactive scanning, and one person cannot read everything.

What that means in practice:

- **Read the report queue.** Every day. It is the entire safety system.
- **Act fast and over-act.** Suspending somebody who turns out to be fine costs
  an apology. The other mistake does not have a price you want to pay.
- If anything looks like an adult approaching a child, **report it to the
  police and to Roblox**, not just internally.
- Get advice on what you are legally obliged to report where you are. Many
  countries have mandatory reporting rules.

There is no blocking on MintPlaza, by deliberate design (a scammer's first move
would be to block their victim). That decision puts **more** weight on the
report queue, not less. If the queue ever grows beyond what you can read, the
answer is a mute — hiding a conversation from the user while keeping it visible
to you — not blocking.

---

## 6. Smaller things worth an hour of somebody's time

- **Governing law.** The terms name India. A consumer elsewhere keeps their own
  country's protections regardless, and the terms say so. Fine as written, but
  confirm.
- **Liability cap.** Capped at what the user has paid in twelve months — for
  most people, nothing. Standard, and standard clauses are sometimes struck out
  as unfair against consumers. Worth a check.
- **Grievance officer.** India's IT Rules require published contact details for
  an intermediary hosting user content. An email address is given. Whether a
  named officer is required at this size is worth asking.
- **The clickwrap.** Acceptance is recorded per version, cannot be forged by a
  client, cannot be backdated or deleted, and the version is set server-side.
  That is a genuinely strong record. Confirm it is the right *form* of consent
  for a minor's parent to be giving.
- **Data location.** Supabase and Vercel store data outside India. The privacy
  policy says so. DPDP has rules about cross-border transfer; check the current
  list of restricted countries.

---

## 7. What to do with this file

Take it to a lawyer along with `/terms` and `/privacy`. An hour of their time
against this list is worth more than a week of redrafting, because most of what
is here is already fine and the items that are not are specific.

**Item 1 is not optional.** Everything else can be improved after launch. That
one has to be settled before money moves.
