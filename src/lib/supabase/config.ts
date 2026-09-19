/**
 * Whether a Supabase project is wired up.
 *
 * MintPlaza has to run without one — that is how it has been developed so far,
 * and how the interface is reviewed before a database exists. So every call
 * site checks this and falls back rather than throwing, and the site degrades
 * to its honest empty states instead of a stack trace.
 *
 * ---------------------------------------------------------------------------
 * Why this file validates shape and not merely presence
 * ---------------------------------------------------------------------------
 *
 * This check used to be `url.length > 0 && key.length > 0`, which accepts a
 * truncated key, a dashboard address, a bare project reference, and a value
 * with a newline welded onto the end. All four read as "configured", so the
 * app went on to build a client, and sign-in navigated the browser to
 * `${url}/auth/v1/authorize`. When the URL is not a project origin the request
 * lands somewhere that demands an `apikey` header, which a top-level
 * navigation cannot carry, and the player is shown raw gateway JSON reading
 * "No API key found in request" — a message that names nothing they can act on
 * and does not mention the variable that is actually wrong.
 *
 * So a bad value is now caught here, where its name is still known, instead of
 * three redirects away in somebody else's error page.
 */

const raw = (value: string | undefined) => (value ?? "").trim();

export const SUPABASE_URL = raw(process.env.NEXT_PUBLIC_SUPABASE_URL);
export const SUPABASE_ANON_KEY = raw(process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY);

export type SupabaseConfigProblem = { field: string; detail: string };

/**
 * The claims inside a JWT, or null when the string is not one.
 *
 * Only the payload is read and nothing is trusted from it beyond routing an
 * error message — the signature is not checked here and does not need to be,
 * because this asks "which key did somebody paste", not "is this key valid".
 *
 * Returning the whole payload rather than one claim is deliberate. A validator
 * that rejects every key whose `role` it cannot read would refuse a perfectly
 * good key the day Supabase changes what it puts in there, and refusing a
 * working key is a worse failure than the one this file exists to prevent:
 * it takes down a site that was fine. So only a payload that positively says
 * service_role is refused, and every other readable JWT is allowed through.
 */
function jwtPayload(token: string): Record<string, unknown> | null {
  const parts = token.split(".");
  if (parts.length !== 3) return null;
  try {
    const b64 = parts[1].replace(/-/g, "+").replace(/_/g, "/");
    const padded = b64 + "=".repeat((4 - (b64.length % 4)) % 4);
    const json =
      typeof atob === "function"
        ? atob(padded)
        : Buffer.from(padded, "base64").toString("utf8");
    const claims: unknown = JSON.parse(json);
    return typeof claims === "object" && claims !== null
      ? (claims as Record<string, unknown>)
      : null;
  } catch {
    return null;
  }
}

/** What is wrong with these two values, or null when nothing is. */
export function supabaseConfigProblem(
  url: string,
  key: string,
): SupabaseConfigProblem | null {
  if (url.length === 0) {
    return { field: "NEXT_PUBLIC_SUPABASE_URL", detail: "is empty." };
  }
  if (!/^https?:\/\//i.test(url)) {
    return {
      field: "NEXT_PUBLIC_SUPABASE_URL",
      detail:
        "does not start with https://. It should be the Project URL — the whole address, not the project reference on its own.",
    };
  }

  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    return { field: "NEXT_PUBLIC_SUPABASE_URL", detail: "is not a valid URL." };
  }
  if (parsed.pathname !== "/" && parsed.pathname !== "") {
    return {
      field: "NEXT_PUBLIC_SUPABASE_URL",
      detail: `carries the path "${parsed.pathname}". It must be the project origin and nothing more — a dashboard address is not the Project URL.`,
    };
  }
  if (parsed.search.length > 0 || parsed.hash.length > 0) {
    return {
      field: "NEXT_PUBLIC_SUPABASE_URL",
      detail: "carries a query string or a #fragment. It must be the origin alone.",
    };
  }

  if (key.length === 0) {
    return { field: "NEXT_PUBLIC_SUPABASE_ANON_KEY", detail: "is empty." };
  }
  if (/\s/.test(key)) {
    return {
      field: "NEXT_PUBLIC_SUPABASE_ANON_KEY",
      detail:
        "contains a space or a line break, so it was cut short or joined to something else when it was pasted.",
    };
  }

  // Both key formats have a public half and a secret half, and the secret half
  // in this slot is the worst mistake available here: NEXT_PUBLIC_ values are
  // compiled into the JavaScript every visitor downloads, and the secret key
  // ignores every row-level security policy in the schema. Refusing to start
  // is the only correct response.
  if (key.startsWith("sb_secret_")) {
    return {
      field: "NEXT_PUBLIC_SUPABASE_ANON_KEY",
      detail:
        "is a secret key. Anything named NEXT_PUBLIC_ is compiled into the JavaScript every visitor downloads, so this would hand the database to the public. Use the publishable key.",
    };
  }
  if (key.startsWith("sb_publishable_")) return null;

  const payload = jwtPayload(key);
  if (payload === null) {
    return {
      field: "NEXT_PUBLIC_SUPABASE_ANON_KEY",
      detail:
        "is not a Supabase key. Expected one beginning eyJ (anon) or sb_publishable_.",
    };
  }
  if (payload.role === "service_role") {
    return {
      field: "NEXT_PUBLIC_SUPABASE_ANON_KEY",
      detail:
        "is the service_role key. It bypasses every row-level security policy, and anything named NEXT_PUBLIC_ is compiled into the JavaScript every visitor downloads. Use the anon key.",
    };
  }
  return null;
}

/** Set to something, right or wrong. Distinguishes "not set up" from "set up wrong". */
export const SUPABASE_PRESENT =
  SUPABASE_URL.length > 0 || SUPABASE_ANON_KEY.length > 0;

export const SUPABASE_CONFIG_PROBLEM = SUPABASE_PRESENT
  ? supabaseConfigProblem(SUPABASE_URL, SUPABASE_ANON_KEY)
  : null;

export const SUPABASE_READY = SUPABASE_PRESENT && SUPABASE_CONFIG_PROBLEM === null;

/**
 * The Roblox OIDC provider.
 *
 * Registered in the Supabase dashboard as a custom provider against issuer
 * https://apis.roblox.com/oauth/ — Supabase fetches the discovery document and
 * resolves every endpoint and the JWKS itself, so no Roblox URL is hardcoded
 * anywhere in this repo.
 *
 * The "custom:" prefix is required by Supabase, not decoration: identifiers
 * without it are read as built-in providers, and there is no built-in Roblox.
 * The rest must match the identifier typed into the dashboard exactly.
 *
 * The client secret lives in Supabase and nowhere else. Supabase performs the
 * token exchange, so this application never holds it, never reads it from an
 * environment variable, and cannot leak it.
 */
export const ROBLOX_PROVIDER = "custom:roblox";

/**
 * Development sign-in.
 *
 * Roblox OAuth needs an ID-verified account to register the app, which is a
 * slow, real-world gate. Rather than let that block every feature behind the
 * front door, a couple of ordinary email accounts exist purely for building
 * against.
 *
 * Two independent conditions, both required: an explicit env flag AND a
 * non-production build. Neither alone opens it, so shipping the flag by
 * accident still does not expose a password login to real users.
 */
export const DEV_LOGIN_ENABLED =
  process.env.NEXT_PUBLIC_DEV_LOGIN === "on" &&
  process.env.NODE_ENV !== "production";

export const DEV_ACCOUNTS = [
  { email: "ava@mintplaza.dev", label: "Ava" },
  { email: "bo@mintplaza.dev", label: "Bo" },
] as const;
