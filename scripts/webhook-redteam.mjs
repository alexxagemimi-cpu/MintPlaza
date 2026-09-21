/**
 * Red team for the Razorpay payment webhook.
 *
 * Runs against a real Next server with a real secret set, and attacks it the
 * way somebody who found the URL would: unsigned, wrongly signed, replayed,
 * back-dated, oversized, and with the signature taken from a different body.
 *
 * Every check here is an ATTACK THAT MUST FAIL. The one success case is last,
 * and it exists so the suite cannot pass by the endpoint being broken — a
 * webhook that rejects everything, including valid requests, would satisfy
 * every other check in this file.
 *
 * ---------------------------------------------------------------------------
 * Razorpay's scheme, which is not the one this file used to test
 * ---------------------------------------------------------------------------
 *
 * The first version of both the route and this suite used an invented scheme:
 * `x-mintplaza-signature` over `${timestamp}.${body}`. It was internally
 * consistent and it passed everything — while being guaranteed to reject every
 * real Razorpay delivery, which is the most convincing kind of broken.
 *
 * Razorpay signs the RAW BODY ONLY, HMAC-SHA256, hex, in `X-Razorpay-Signature`,
 * and signs no timestamp at all. So the back-dating attack below works on
 * `created_at` INSIDE the body, which is the only timestamp an attacker cannot
 * edit without breaking the signature.
 */
import { createHmac } from "node:crypto";

const BASE = process.env.WEBHOOK_BASE ?? "http://127.0.0.1:3111";
const URL_PATH = "/api/level-up/webhook";
const SECRET = process.env.RAZORPAY_WEBHOOK_SECRET;

/**
 * With no secret set the endpoint must refuse EVERYTHING, including a request
 * signed perfectly with a secret the attacker chose themselves. That is the
 * direction this has to fail in and the easy one to get backwards: a webhook
 * that accepted unsigned requests "until the secret is configured" would be a
 * free Level Up for anybody who found the URL, and it would look like it was
 * working. Run this file with RAZORPAY_WEBHOOK_SECRET unset to check it.
 */
const FAIL_CLOSED_MODE = !SECRET;

let failures = 0;
function check(label, ok, detail) {
  console.log(`  ${ok ? "PASS" : "FAIL"}  ${label}${detail ? ` — ${detail}` : ""}`);
  if (!ok) failures++;
}

/** Razorpay's signature: the raw body, and nothing else. */
const sign = (body, secret = SECRET) =>
  createHmac("sha256", secret).update(body, "utf8").digest("hex");

async function post(body, headers = {}) {
  const res = await fetch(BASE + URL_PATH, {
    method: "POST",
    headers: { "content-type": "application/json", ...headers },
    body,
  });
  let json = null;
  try { json = await res.json(); } catch { /* not all responses are json */ }
  return { status: res.status, json };
}

const now = () => Math.floor(Date.now() / 1000);

/** A payment.captured event shaped the way Razorpay actually sends one. */
const body = (over = {}) => {
  const { event = "payment.captured", created_at = now(), notes, ...rest } = over;
  return JSON.stringify({
    entity: "event",
    account_id: "acc_test",
    event,
    contains: ["payment"],
    created_at,
    payload: {
      payment: {
        entity: {
          id: `pay_${Math.random().toString(36).slice(2, 12)}`,
          amount: 39900,
          currency: "INR",
          status: "captured",
          email: "player@example.test",
          notes: notes === undefined ? { roblox_username: "alice" } : notes,
          ...rest,
        },
      },
    },
  });
};

if (FAIL_CLOSED_MODE) {
  console.log("\nRAZORPAY WEBHOOK — FAIL CLOSED (no secret configured)\n");

  {
    const r = await post(body());
    check("an unsigned request is refused", r.status === 503, `got ${r.status}`);
  }
  {
    const b = body({ amount: 1 });
    // Signed correctly — with a secret the attacker picked. If the server has
    // no secret of its own, there is nothing for this to be checked against,
    // and the only safe answer is no.
    const sig = createHmac("sha256", "attacker-picks-this").update(b, "utf8").digest("hex");
    const r = await post(b, { "x-razorpay-signature": sig });
    check("so is one signed with a secret the attacker chose",
      r.status === 503, `got ${r.status}`);
  }

  console.log(`\n${failures === 0 ? "webhook red team: refuses everything while unconfigured" : `webhook red team: ${failures} FAILED`}\n`);
  process.exit(failures === 0 ? 0 : 1);
}

console.log("\nRAZORPAY WEBHOOK — RED TEAM\n");

// ---- is this server even in a state worth grading? -----------------------
{
  const b = body();
  const probe = await post(b, { "x-razorpay-signature": sign(b) });
  if (probe.status === 503) {
    console.log("\nRAZORPAY WEBHOOK — CANNOT RED TEAM\n");
    console.log("  The server answers 503 to a correctly signed request, so it is");
    console.log("  missing something other than the signing secret. The route needs");
    console.log("  all three, and refuses everything without them:\n");
    console.log("    RAZORPAY_WEBHOOK_SECRET      set here, so this one is fine");
    console.log("    SUPABASE_SERVICE_ROLE_KEY    <- almost always this one");
    console.log("    NEXT_PUBLIC_SUPABASE_URL\n");
    console.log("  Set them on the SERVER process, not just in this shell, and rerun.");
    console.log("  Nothing is proven either way about the signature checks.\n");
    process.exit(2);
  }
}

// ---- no signature at all -------------------------------------------------
{
  const r = await post(body());
  check("an unsigned request is refused", r.status === 401, `got ${r.status}`);
}

// ---- a signature of the right shape, and wrong ---------------------------
{
  const b = body();
  const r = await post(b, { "x-razorpay-signature": "0".repeat(64) });
  check("a made-up signature of the right length is refused",
    r.status === 401, `got ${r.status}`);
}

// ---- signed with the wrong secret ----------------------------------------
{
  const b = body();
  const r = await post(b, { "x-razorpay-signature": sign(b, "not-the-secret") });
  check("a signature made with the wrong secret is refused",
    r.status === 401, `got ${r.status}`);
}

// ---- a real signature, over a different body -----------------------------
//
// The attack this stops: capture one delivery, keep its header, and send the
// body you wanted instead.
{
  const signed = body({ amount: 100 });
  const sent = body({ amount: 9999999 });
  const r = await post(sent, { "x-razorpay-signature": sign(signed) });
  check("a valid signature cannot be moved onto another body",
    r.status === 401, `got ${r.status}`);
}

// ---- a truncated signature -----------------------------------------------
//
// A comparison that checked only a prefix would accept this, and so would one
// that threw on a length mismatch and caught it as "fine".
{
  const b = body();
  const r = await post(b, { "x-razorpay-signature": sign(b).slice(0, 32) });
  check("a truncated signature is refused", r.status === 401, `got ${r.status}`);
}

// ---- oversized ------------------------------------------------------------
{
  const huge = JSON.stringify({ event: "payment.captured", pad: "x".repeat(200_000) });
  const r = await post(huge, { "x-razorpay-signature": sign(huge) });
  check("an oversized body is refused before it is parsed",
    r.status === 413, `got ${r.status}`);
}

// ---- back-dated, inside the signed body ----------------------------------
//
// Razorpay signs no timestamp, so the only one that cannot be edited freely is
// created_at inside the body — edit it and the signature below stops matching.
// Signing it honestly, as here, is the strongest version of this attack.
{
  const b = body({ created_at: now() - 60 * 60 * 24 * 30 });
  const r = await post(b, { "x-razorpay-signature": sign(b) });
  check("a delivery from a month ago is refused",
    r.status === 401, `got ${r.status}`);
}

// ---- an event this site does not act on -----------------------------------
//
// Razorpay sends many event types to one endpoint. Acknowledging the rest
// stops it retrying things that were never going to grant anything.
{
  const b = body({ event: "payment.failed" });
  const r = await post(b, { "x-razorpay-signature": sign(b) });
  check("an event that is not a payment is acknowledged, not acted on",
    r.status === 200 && r.json?.ignored === "payment.failed",
    `got ${r.status} ${JSON.stringify(r.json)}`);
}

// ---- paid, but nobody knows whose it is -----------------------------------
//
// Money has arrived with no username on it. Granting to a guess would hand a
// stranger's subscription to whoever typed a name closest, so it grants
// nothing — and it must not 401, because the payment was genuine.
{
  const b = body({ notes: { something_else: "x" } });
  const r = await post(b, { "x-razorpay-signature": sign(b) });
  check("a genuine payment with no username grants nothing, and says so",
    r.status === 200 && r.json?.applied === false,
    `got ${r.status} ${JSON.stringify(r.json)}`);
}

// ---- and finally: a real one has to work ---------------------------------
//
// Without this, an endpoint that refused everything would pass every check
// above. It gets as far as the database, which may not be configured in this
// run, so the pass condition is "it got past every guard" rather than "it
// granted".
{
  const b = body();
  const r = await post(b, { "x-razorpay-signature": sign(b) });
  // 503 is excluded deliberately. It means the route fell at the first guard
  // and reached none of the others, so counting it as "got past every guard"
  // would let a wholly unconfigured endpoint satisfy the one check here whose
  // job is to prove the suite is not passing vacuously.
  check("a correctly signed, fresh, well-formed payment gets past every guard",
    r.status !== 401 && r.status !== 400 && r.status !== 413 && r.status !== 503,
    `got ${r.status}${r.json?.error ? ` (${r.json.error})` : ""}`);
}

console.log(`\n${failures === 0 ? "webhook red team: all attacks refused" : `webhook red team: ${failures} FAILED`}\n`);
process.exit(failures === 0 ? 0 : 1);
