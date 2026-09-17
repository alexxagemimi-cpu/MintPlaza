import { NextResponse, type NextRequest } from "next/server";
import { createHmac, timingSafeEqual } from "node:crypto";
import { createClient } from "@supabase/supabase-js";
import { SUPABASE_URL } from "@/lib/supabase/config";
import { LEVEL_UP_DAYS, isCountryCode } from "@/lib/level-up";

/**
 * The payment webhook.
 *
 * When somebody pays on the checkout page, the thing taking the money tells
 * MintPlaza here, and the player has Level Up a second later without anybody
 * typing anything.
 *
 * ---------------------------------------------------------------------------
 * This endpoint is on the open internet and everyone can find it
 * ---------------------------------------------------------------------------
 *
 * A URL that grants a paid feature, reachable by anybody who can send a POST,
 * is the highest-value target on this site. So nothing about the request is
 * trusted, and the checks below are in a deliberate order: the cheapest
 * rejections first, so that flooding it costs the attacker more than it costs
 * the server.
 *
 *   1. Is a secret even configured? No secret means no webhook. It refuses
 *      everything rather than accepting everything — the direction this has to
 *      fail in, and the one that is easy to get backwards.
 *   2. Is the body a sane size? Read as raw text with a hard cap, before any
 *      parsing, so a hundred-megabyte body is a cheap 413 rather than an
 *      out-of-memory.
 *   3. Is it recent? A signature is valid forever unless something says
 *      otherwise. The timestamp is inside the signed material, so it cannot be
 *      edited without breaking the signature, and anything older than five
 *      minutes is refused. That turns a captured request from a permanent
 *      skeleton key into a five-minute one.
 *   4. Is it signed? HMAC-SHA256 over `timestamp.body`, compared in constant
 *      time. A plain === leaks, byte by byte, how much of a guess was right.
 *   5. Only then is the JSON parsed and the database touched.
 *
 * The final defence is not here at all: `payment_ref` is unique in the
 * database, so even a perfectly replayed valid request grants nothing twice.
 * Every processor retries deliveries by design, so this is an ordinary Tuesday
 * rather than an attack.
 *
 * ---------------------------------------------------------------------------
 * What to set on the paying side
 * ---------------------------------------------------------------------------
 *
 *   POST /api/level-up/webhook
 *   x-mintplaza-timestamp: <unix seconds>
 *   x-mintplaza-signature: sha256=<hex hmac of `${timestamp}.${rawBody}`>
 *   { "username": "alx22n", "payment_ref": "order_123",
 *     "country": "IN", "days": 60 }
 *
 * The secret is LEVEL_UP_WEBHOOK_SECRET, set in this deployment's environment
 * and in the payment page's. It is never prefixed NEXT_PUBLIC_ and never
 * reaches a browser; the proof script fails the build if it ever is.
 */

/** Five minutes. Long enough for a slow retry, short enough to matter. */
const MAX_AGE_SECONDS = 300;

/** A grant request is a few hundred bytes. This is 100x headroom. */
const MAX_BODY_BYTES = 16 * 1024;

export async function POST(request: NextRequest) {
  const secret = process.env.LEVEL_UP_WEBHOOK_SECRET?.trim();
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim();

  // ---- 1. fail closed ------------------------------------------------------
  //
  // Not configured means not open. A webhook that accepted unsigned requests
  // because nobody had set a secret yet would be a free Level Up for anybody
  // who found the URL, and it would look like it was working.
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

  // ---- 3. recent ----------------------------------------------------------
  const timestamp = request.headers.get("x-mintplaza-timestamp") ?? "";
  const sent = Number(timestamp);
  if (!timestamp || !Number.isFinite(sent)) {
    return json(401, { error: "Bad signature." });
  }
  const age = Math.abs(Date.now() / 1000 - sent);
  if (age > MAX_AGE_SECONDS) {
    return json(401, { error: "Bad signature." });
  }

  // ---- 4. signed ----------------------------------------------------------
  //
  // The timestamp is part of the signed material. Signing only the body would
  // let anybody take a captured request, put today's timestamp on it and
  // replay it forever.
  const expected = createHmac("sha256", secret)
    .update(`${timestamp}.${raw}`)
    .digest("hex");

  if (!safeEqual(stripPrefix(request.headers.get("x-mintplaza-signature")), expected)) {
    return json(401, { error: "Bad signature." });
  }

  // ---- 5. only now is any of it read as data ------------------------------
  let payload: Record<string, unknown>;
  try {
    payload = JSON.parse(raw) as Record<string, unknown>;
  } catch {
    return json(400, { error: "Bad body." });
  }

  const username = str(payload.username);
  const paymentRef = str(payload.payment_ref);
  if (!username || !paymentRef) {
    return json(400, { error: "username and payment_ref are required." });
  }

  // A country that is not on our own list is dropped rather than stored. It is
  // only kept for the owner's records, and a junk value there is worse than
  // none.
  const rawCountry = str(payload.country)?.toUpperCase();
  const country = rawCountry && isCountryCode(rawCountry) ? rawCountry : null;

  // Days is clamped here as well as in the database. Two checks, because this
  // one decides what a typo on the paying side does and the other decides what
  // a compromised key does.
  const days = clampDays(payload.days);

  // The service-role client. Created per request rather than at module scope
  // so a deployment without the key cannot construct one at import time, and
  // deliberately given no session persistence: this is a machine, it has no
  // session, and a persisted one would be a credential sitting on disk.
  const admin = createClient(SUPABASE_URL, serviceKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  const { data, error } = await admin.rpc("webhook_grant_level_up", {
    p_username: username,
    p_payment_ref: paymentRef,
    p_days: days,
    p_country: country,
    p_amount: num(payload.amount),
    p_currency: str(payload.currency) ?? null,
  });

  if (error) {
    // "That player has not signed in yet" is the one failure a human has to
    // act on — somebody's money arrived and their account did not — so it is
    // logged loudly and answered with a 422 the processor will retry.
    console.error("level-up webhook failed", {
      username,
      paymentRef,
      code: error.code,
      message: error.message,
    });
    return json(422, { error: error.message ?? "Could not apply." });
  }

  return json(200, data ?? { applied: true });
}

/* ------------------------------------------------------------------ */

function json(status: number, body: unknown) {
  return NextResponse.json(body, {
    status,
    // A webhook response is for one machine, once. Nothing about it should be
    // cached by anything in between.
    headers: { "Cache-Control": "no-store" },
  });
}

/** `sha256=abc…` and a bare `abc…` are both accepted. */
function stripPrefix(header: string | null): string {
  const v = (header ?? "").trim();
  return v.startsWith("sha256=") ? v.slice(7) : v;
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

function num(v: unknown): number | null {
  return typeof v === "number" && Number.isFinite(v) ? v : null;
}

function clampDays(v: unknown): number {
  if (typeof v !== "number" || !Number.isFinite(v)) return LEVEL_UP_DAYS;
  return Math.min(Math.max(Math.round(v), 1), 3650);
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
