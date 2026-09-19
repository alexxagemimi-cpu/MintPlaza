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

## 1. Whose name the money is in

**This file previously said the operator was 13 and that item 1 was the one to
sort out before launch. That was wrong — it came from a bad assumption, not
from anything you said.** The operator is 19 and an adult, so the hard version
of this problem does not exist:

- The Terms of Service are a real agreement. An adult can contract, so §2 now
  names him in his own name and on his own responsibility, which is stronger
  than the parent-or-guardian wording it replaced.
- Every payment processor requires the account holder to be 18+. You are. You
  can open a Razorpay, Cashfree or PhonePe business account in **your own
  name** with your own PAN and Aadhaar.

What is left is a smaller question with a real answer, and it is worth getting
right because it decides who a refund demand lands on.

**If the payment account is in your father's name, he is the merchant.** Not in
a paperwork sense — in the sense that the gateway's KYC is his, the settlement
bank account is his, the income is reported against his PAN, and a chargeback
or a tax notice is addressed to him. That is a fine arrangement if it is a
deliberate one. It is a bad one if it happened only because it was easier, for
three reasons:

1. **It contradicts the terms.** §2 says the service is run by and the
   responsibility of one person. If the money is collected by another, a
   disgruntled customer can reasonably ask which of you they are dealing with.
   §2 now carries a sentence saying payments may be collected through a family
   member's account, which closes that gap honestly — but it is a patch over a
   mismatch, not a reason to create one.
2. **Most gateway agreements prohibit it.** Processing another person's
   business through your account is generally a term-of-service breach.
   Accounts get frozen for it, usually with money in them.
3. **The income is his.** It goes on his return, not yours, at his slab.

**The recommendation is the boring one: open the account in your own name.**
You are old enough, and the paperwork is the same. If you want the money to
reach your father, transfer it to him after it settles — that is a family
transfer and nobody's problem. If instead he genuinely wants to be the person
running the business side, that is also fine, but then change §2 to name him
and mean it.

Either way, **do not take UPI payments into a personal savings account for a
service the website advertises.** It is the same transaction with no invoice,
no refund trail and no way to prove what was sold, and banks do close personal
accounts used as business accounts.

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

**Item 1 is now a choice rather than a blocker** — but make the choice on
purpose, and before the first payment, because it decides whose name is on the
money. Everything else can be improved after launch.
