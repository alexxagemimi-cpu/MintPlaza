import { NextResponse, type NextRequest } from "next/server";
import { createHmac, timingSafeEqual } from "node:crypto";
import { createClient } from "@supabase/supabase-js";
import { SUPABASE_URL } from "@/lib/supabase/config";
import { LEVEL_UP_DAYS, isCountryCode } from "@/lib/level-up";

/**
 * The Razorpay webhook.
 *
 * When somebody pays, Razorpay tells MintPlaza here and the player has Level
 * Up a second later without anybody typing anything.
 *
 * ---------------------------------------------------------------------------
 * Why this was rewritten
 * ---------------------------------------------------------------------------
 *
 * The first version invented its own scheme: `x-mintplaza-signature` over
 * `${timestamp}.${body}`, with the timestamp in its own header. It was a good
 * scheme. It was not Razorpay's, so it would have rejected every real delivery
 * while passing its own test suite — the most convincing kind of broken.
 *
 * Razorpay signs the RAW BODY ONLY, HMAC-SHA256, hex, in `X-Razorpay-Signature`.
 * There is no signed timestamp, so the replay defence had to move; see below.
 *
 * ---------------------------------------------------------------------------
 * This endpoint is on the open internet and everyone can find it
 * ---------------------------------------------------------------------------
 *
 * A URL that grants a paid feature, reachable by anybody who can send a POST,
 * is the highest-value target on this site. Nothing about the request is
 * trusted, and the checks are ordered cheapest-first so that flooding it costs
 * the attacker more than it costs the server.
 *
 *   1. Is a secret even configured? No secret means no webhook. It refuses
 *      everything rather than accepting everything — the direction this has to
 *      fail in, and the one that is easy to get backwards.
 *   2. Is the body a sane size? Read as raw text with a hard cap, before any
 *      parsing, so a huge body is a cheap 413 rather than an out-of-memory.
 *   3. Is it signed? HMAC-SHA256 over the raw bytes, compared in constant
 *      time. A plain === leaks, byte by byte, how much of a guess was right.
 *   4. Only then is the JSON parsed and the database touched.
 *
 * ---------------------------------------------------------------------------
 * Replay, without a signed timestamp
 * ---------------------------------------------------------------------------
 *
 * Razorpay's signature covers the body and nothing else, so a captured
 * delivery stays valid forever and no header check can change that — a header
 * outside the signature is attacker-controlled.
 *
 * Two things make that harmless. `created_at` sits INSIDE the signed body, so
 * it cannot be edited without breaking the signature, and anything far older
 * than a real retry window is refused. And `payment_ref` is unique in the
 * database, so even a perfectly replayed request inside the window grants
 * nothing twice. The second one is the real defence; every processor retries
 * deliveries by design, so duplicate arrivals are an ordinary Tuesday.
 *
 * ---------------------------------------------------------------------------
 * How the payment knows who paid
 * ---------------------------------------------------------------------------
 *
 * A hosted Razorpay Payment Page has one URL for everybody, so the payment has
 * to carry the player's identity itself. Add a required field to the payment
 * page called "Roblox username" and Razorpay puts it in `notes` on the
 * payment; that is what this reads.
 *
 * If it does not arrive, nothing is granted and the failure is logged loudly
 * with the payment id, because the alternative — guessing — would hand a
 * stranger's subscription to whoever typed a name closest. The owner grants it
 * by hand from the control panel, which is what that button is for.
 */

/**
 * How stale a delivery may be.
 *
 * Razorpay retries a failing webhook over roughly 24 hours, and a retry of a
 * real payment must still work. This is deliberately generous, because it is
 * the weaker of the two replay defences — the unique payment_ref is the one
 * that actually matters.
 */
const MAX_AGE_SECONDS = 48 * 60 * 60;

/** A Razorpay event is a few kilobytes. This is comfortable headroom. */
const MAX_BODY_BYTES = 64 * 1024;

/** The events worth acting on. Everything else is acknowledged and ignored. */
const PAYING_EVENTS = new Set([
  "payment.captured",
  "order.paid",
  "payment_link.paid",
]);

export async function POST(request: NextRequest) {
  const secret = process.env.RAZORPAY_WEBHOOK_SECRET?.trim();
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim();

  // ---- 1. fail closed ------------------------------------------------------
  if (!secret || !serviceKey || !SUPABASE_URL) {
    return json(503, { error: "Not configured." });
  }

  // ---- 2. a body worth reading --------------------------------------------
  const declared = Number(request.headers.get("content-length") ?? "0");
  if (Number.isFinite(declared) && declared > MAX_BODY_BYTES) {
    return json(413, { error: "Too large." });
  }
  const raw = await request.text();
  // Checked again after reading: content-length is a claim, not a fact.
  if (Buffer.byteLength(raw, "utf8") > MAX_BODY_BYTES) {
    return json(413, { error: "Too large." });
  }

  // ---- 3. signed ----------------------------------------------------------
  //
  // The RAW text, never a re-serialised object. JSON.stringify of a parsed
  // body reorders keys and drops whitespace, so a signature computed over it
  // would disagree with the sender's for reasons nobody could ever debug.
  const expected = createHmac("sha256", secret).update(raw, "utf8").digest("hex");

  if (!safeEqual(headerSignature(request), expected)) {
    return json(401, { error: "Bad signature." });
  }

  // ---- 4. only now is any of it read as data ------------------------------
  let event: RazorpayEvent;
  try {
    event = JSON.parse(raw) as RazorpayEvent;
  } catch {
    return json(400, { error: "Bad body." });
  }

  // Razorpay sends many event types to one endpoint. Acknowledging the rest
  // with a 200 stops it retrying things this site was never going to act on.
  if (!event.event || !PAYING_EVENTS.has(event.event)) {
    return json(200, { ignored: event.event ?? null });
  }

  // Inside the signed body, so it cannot be edited without breaking the
  // signature above.
  const createdAt = typeof event.created_at === "number" ? event.created_at : null;
  if (createdAt !== null) {
    const age = Math.abs(Date.now() / 1000 - createdAt);
    if (age > MAX_AGE_SECONDS) {
      return json(401, { error: "Too old." });
    }
  }

  const payment = event.payload?.payment?.entity;
  if (!payment?.id) {
    console.error("[razorpay] a paying event with no payment entity", {
      event: event.event,
    });
    return json(200, { applied: false, reason: "no payment entity" });
  }

  const username = robloxUsername(payment.notes);
  if (!username) {
    // Money has arrived and nobody knows whose it is. Retrying will not fix
    // that, so this is a 200 — but it is the one failure a human must act on,
    // so it is logged with everything needed to grant it by hand.
    console.error("[razorpay] PAID BUT NO USERNAME — grant this by hand", {
      payment_id: payment.id,
      email: payment.email ?? null,
      contact: payment.contact ?? null,
      amount: payment.amount ?? null,
      currency: payment.currency ?? null,
      notes: payment.notes ?? null,
    });
    return json(200, { applied: false, reason: "no username in notes" });
  }

  // A country that is not on our own list is dropped rather than stored. It is
  // only kept for the owner's records, and a junk value there is worse than
  // none.
  const rawCountry = str(payment.notes?.country)?.toUpperCase();
  const country = rawCountry && isCountryCode(rawCountry) ? rawCountry : null;

  // The service-role client. Created per request rather than at module scope
  // so a deployment without the key cannot construct one at import time, and
  // deliberately given no session persistence: this is a machine, it has no
  // session, and a persisted one would be a credential sitting on disk.
  const admin = createClient(SUPABASE_URL, serviceKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  const { data, error } = await admin.rpc("webhook_grant_level_up", {
    p_username: username,
    // The payment id, which is unique at Razorpay and unique in our table, so
    // a redelivered event grants nothing twice.
    p_payment_ref: payment.id,
    p_days: LEVEL_UP_DAYS,
    p_country: country,
    p_amount: majorUnits(payment.amount),
    p_currency: str(payment.currency)?.toUpperCase() ?? null,
  });

  if (error) {
    // "That player has not signed in yet" is the other failure a human has to
    // act on — somebody's money arrived and their account did not — so it is
    // logged loudly and answered with a 422, which Razorpay will retry.
    console.error("[razorpay] grant failed", {
      username,
      payment_id: payment.id,
      code: error.code,
      message: error.message,
    });
    return json(422, { error: error.message ?? "Could not apply." });
  }

  return json(200, data ?? { applied: true });
}

/* ------------------------------------------------------------------ */

interface RazorpayEvent {
  event?: string;
  created_at?: number;
  payload?: {
    payment?: {
      entity?: {
        id?: string;
        amount?: number;
        currency?: string;
        email?: string;
        contact?: string;
        notes?: Record<string, unknown>;
      };
    };
  };
}

/**
 * Which note holds the player's Roblox username.
 *
 * The exact key depends on what the payment page's field is called, and that
 * is set in Razorpay's dashboard rather than here — so the documented name is
 * tried first and a small, deliberate set of near-misses after it. Anything
 * looser would start matching `notes` somebody else's integration wrote.
 */
const USERNAME_KEYS = [
  "roblox_username",
  "roblox username",
  "robloxusername",
  "username",
  "roblox",
];

function robloxUsername(notes: Record<string, unknown> | undefined): string | null {
  if (!notes) return null;

  const lowered = new Map<string, unknown>();
  for (const [k, v] of Object.entries(notes)) lowered.set(k.trim().toLowerCase(), v);

  for (const key of USERNAME_KEYS) {
    const found = str(lowered.get(key));
    if (found) return found;
  }
  return null;
}

/**
 * Razorpay sends the smallest unit — paise for INR, cents for USD.
 *
 * Storing 39900 where the owner expects 399 would not break anything today,
 * which is exactly why it would survive to become the number in a refund
 * argument.
 */
function majorUnits(amount: unknown): number | null {
  if (typeof amount !== "number" || !Number.isFinite(amount)) return null;
  return amount / 100;
}

/** Razorpay's header, accepted with or without a `sha256=` prefix. */
function headerSignature(request: NextRequest): string {
  const v = (request.headers.get("x-razorpay-signature") ?? "").trim();
  return v.startsWith("sha256=") ? v.slice(7) : v;
}

function json(status: number, body: unknown) {
  return NextResponse.json(body, {
    status,
    // A webhook response is for one machine, once. Nothing about it should be
    // cached by anything in between.
    headers: { "Cache-Control": "no-store" },
  });
}

/**
 * Constant-time comparison.
 *
 * `a === b` on a hex digest returns as soon as two characters differ, and the
 * time it takes says how many leading characters were right. That is enough to
 * recover a valid signature one character at a time without ever knowing the
 * secret. timingSafeEqual does not short-circuit.
 *
 * It also throws on a length mismatch, which would itself be a signal, so the
 * lengths are compared first and the result is the same either way.
 */
function safeEqual(given: string, expected: string): boolean {
  if (given.length !== expected.length) return false;
  try {
    return timingSafeEqual(Buffer.from(given, "utf8"), Buffer.from(expected, "utf8"));
  } catch {
    return false;
  }
}

function str(v: unknown): string | undefined {
  return typeof v === "string" && v.trim() ? v.trim() : undefined;
}

/**
 * Anything other than POST is refused by name.
 *
 * Without these, Next answers a GET with its own 405 — which is correct, but
 * saying it here means the endpoint's whole surface is visible in one file.
 */
export async function GET() {
  return json(405, { error: "POST only." });
}
