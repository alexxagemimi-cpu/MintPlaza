/**
 * Whether a Supabase project is wired up.
 *
 * MintPlaza has to run without one — that is how it has been developed so far,
 * and how the interface is reviewed before a database exists. So every call
 * site checks this and falls back rather than throwing, and the site degrades
 * to its honest empty states instead of a stack trace.
 */
export const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
export const SUPABASE_ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? "";

export const SUPABASE_READY =
  SUPABASE_URL.length > 0 && SUPABASE_ANON_KEY.length > 0;

/**
 * The Roblox OIDC provider, registered in the Supabase dashboard as a custom
 * provider against issuer https://apis.roblox.com/oauth/ — Supabase reads the
 * endpoints from its discovery document, so nothing else is hardcoded here.
 *
 * The slug must match what the provider was named in the dashboard.
 */
export const ROBLOX_PROVIDER = "roblox";


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
