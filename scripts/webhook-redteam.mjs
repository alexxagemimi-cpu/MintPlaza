/**
 * Red team for the Level Up payment webhook.
 *
 * Runs against a real Next server with a real secret set, and attacks it the
 * way somebody who found the URL would: unsigned, wrongly signed, replayed,
 * back-dated, oversized, and with the signature taken from a different body.
 *
 * Every check here is an ATTACK THAT MUST FAIL. The one success case is last,
 * and it exists so the suite cannot pass by the endpoint being broken — a
 * webhook that rejects everything, including valid requests, would satisfy
 * every other check in this file.
 */
import { createHmac } from "node:crypto";

const BASE = process.env.WEBHOOK_BASE ?? "http://127.0.0.1:3111";
const URL_PATH = "/api/level-up/webhook";
const SECRET = process.env.LEVEL_UP_WEBHOOK_SECRET;

/**
 * With no secret set the endpoint must refuse EVERYTHING, including a request
 * signed perfectly with a secret the attacker chose themselves. That is the
 * direction this has to fail in and the easy one to get backwards: a webhook
 * that accepted unsigned requests "until the secret is configured" would be a
 * free Level Up for anybody who found the URL, and it would look like it was
 * working. Run this file with LEVEL_UP_WEBHOOK_SECRET unset to check it.
 */
const FAIL_CLOSED_MODE = !SECRET;

let failures = 0;
function check(label, ok, detail) {
  console.log(`  ${ok ? "PASS" : "FAIL"}  ${label}${detail ? ` — ${detail}` : ""}`);
  if (!ok) failures++;
}

const sign = (ts, body, secret = SECRET) =>
  createHmac("sha256", secret).update(`${ts}.${body}`).digest("hex");

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
const body = (over = {}) =>
  JSON.stringify({ username: "alice", payment_ref: `ref_${Math.random()}`, country: "IN", ...over });

if (FAIL_CLOSED_MODE) {
  console.log("\nLEVEL UP WEBHOOK — FAIL CLOSED (no secret configured)\n");

  {
    const r = await post(body());
    check("an unsigned request is refused", r.status === 503, `got ${r.status}`);
  }
  {
    const ts = now();
    const b = body({ days: 3650 });
    // Signed correctly — with a secret the attacker picked. If the server has
    // no secret of its own, there is nothing for this to be checked against,
    // and the only safe answer is no.
    const sig = createHmac("sha256", "attacker-picks-this").update(`${ts}.${b}`).digest("hex");
    const r = await post(b, {
      "x-mintplaza-timestamp": String(ts),
      "x-mintplaza-signature": "sha256=" + sig,
    });
    check("and so is one signed with a secret the attacker chose",
      r.status === 503, `got ${r.status}`);
  }

  console.log(`\n${failures === 0 ? "webhook fails closed" : `${failures} FAILED`}\n`);
  process.exit(failures === 0 ? 0 : 1);
}

console.log("\nLEVEL UP WEBHOOK — RED TEAM\n");

// ---- the shape of the endpoint -------------------------------------------
{
  const res = await fetch(BASE + URL_PATH);
  check("a GET is refused", res.status === 405, `got ${res.status}`);
}

// ---- no signature at all --------------------------------------------------
{
  const r = await post(body());
  check("an unsigned request is refused", r.status === 401, `got ${r.status}`);
}

// ---- a signature that is simply wrong ------------------------------------
{
  const ts = now();
  const r = await post(body(), {
    "x-mintplaza-timestamp": String(ts),
    "x-mintplaza-signature": "sha256=" + "0".repeat(64),
  });
  check("a wrong signature is refused", r.status === 401, `got ${r.status}`);
}

// ---- signed with the wrong secret ----------------------------------------
{
  const ts = now();
  const b = body();
  const r = await post(b, {
    "x-mintplaza-timestamp": String(ts),
    "x-mintplaza-signature": "sha256=" + sign(ts, b, "not-the-secret"),
  });
  check("a signature from the wrong secret is refused", r.status === 401, `got ${r.status}`);
}

// ---- THE CLASSIC: valid signature, different body -------------------------
//
// Sign a harmless body, then send a different one with that signature. This is
// what a naive implementation that signs a parsed-and-reserialised object gets
// wrong.
{
  const ts = now();
  const signed = body({ days: 1 });
  const swapped = body({ days: 3650, username: "mallory" });
  const r = await post(swapped, {
    "x-mintplaza-timestamp": String(ts),
    "x-mintplaza-signature": "sha256=" + sign(ts, signed),
  });
  check("a signature lifted onto a different body is refused", r.status === 401, `got ${r.status}`);
}

// ---- REPLAY: a perfectly valid request, sent again later ------------------
{
  const ts = now() - 600;             // ten minutes ago
  const b = body();
  const r = await post(b, {
    "x-mintplaza-timestamp": String(ts),
    "x-mintplaza-signature": "sha256=" + sign(ts, b),
  });
  check("a correctly signed request from ten minutes ago is refused",
    r.status === 401, `got ${r.status}`);
}

// ---- and from the future, which is the same attack with the clock moved ---
{
  const ts = now() + 600;
  const b = body();
  const r = await post(b, {
    "x-mintplaza-timestamp": String(ts),
    "x-mintplaza-signature": "sha256=" + sign(ts, b),
  });
  check("and one dated ten minutes into the future", r.status === 401, `got ${r.status}`);
}

// ---- timestamp swapped for a valid one, signature kept -------------------
{
  const ts = now() - 600;
  const b = body();
  const sig = sign(ts, b);
  const r = await post(b, {
    "x-mintplaza-timestamp": String(now()),   // fresh timestamp
    "x-mintplaza-signature": "sha256=" + sig, // stale signature
  });
  check("an old signature cannot be refreshed with a new timestamp",
    r.status === 401, `got ${r.status}`);
}

// ---- a body far larger than any real one ---------------------------------
{
  const huge = JSON.stringify({ username: "alice", payment_ref: "x", pad: "A".repeat(64 * 1024) });
  const ts = now();
  const r = await post(huge, {
    "x-mintplaza-timestamp": String(ts),
    "x-mintplaza-signature": "sha256=" + sign(ts, huge),
  });
  check("an oversized body is refused even when correctly signed",
    r.status === 413, `got ${r.status}`);
}

// ---- signature of the right shape but wrong length ------------------------
{
  const ts = now();
  const b = body();
  const r = await post(b, {
    "x-mintplaza-timestamp": String(ts),
    "x-mintplaza-signature": "sha256=" + sign(ts, b).slice(0, 32),
  });
  check("a truncated signature is refused", r.status === 401, `got ${r.status}`);
}

// ---- valid signature, missing the fields that matter ---------------------
{
  const ts = now();
  const b = JSON.stringify({ country: "IN" });
  const r = await post(b, {
    "x-mintplaza-timestamp": String(ts),
    "x-mintplaza-signature": "sha256=" + sign(ts, b),
  });
  check("a signed request with no username or payment_ref is a 400",
    r.status === 400, `got ${r.status}`);
}

// ---- and finally: a real one has to work --------------------------------
//
// Without this, an endpoint that refused everything would pass every check
// above. It gets as far as the database, which is not configured in this run,
// so the pass condition is "it got past every guard" rather than "it granted".
{
  const ts = now();
  const b = body();
  const r = await post(b, {
    "x-mintplaza-timestamp": String(ts),
    "x-mintplaza-signature": "sha256=" + sign(ts, b),
  });
  check("a correctly signed, fresh, well-formed request gets past every guard",
    r.status !== 401 && r.status !== 400 && r.status !== 413,
    `got ${r.status}${r.json?.error ? ` (${r.json.error})` : ""}`);
}

console.log(`\n${failures === 0 ? "webhook red team: all attacks refused" : `webhook red team: ${failures} FAILED`}\n`);
process.exit(failures === 0 ? 0 : 1);
