/**
 * Where this site lives, as an absolute origin.
 *
 * Needed for exactly one thing and it is not a small one: `metadataBase`.
 * Without it Next resolves the Open Graph and Twitter images against
 * `http://localhost:3000`, so every link anybody pastes into Discord, X or a
 * YouTube description carries a preview image pointing at their own machine.
 * The site looks broken in the one place it is being recommended, which is the
 * worst possible place to look broken.
 *
 * Three sources, in the order they should win:
 *
 *   1. NEXT_PUBLIC_SITE_URL — set this the day a real domain is bought. It is
 *      the only one that survives a domain change, and it overrides the rest.
 *   2. VERCEL_PROJECT_PRODUCTION_URL — the project's stable production host,
 *      which is what a shared link actually points at. Vercel sets it itself.
 *   3. VERCEL_URL — the per-deployment host. A last resort: it is different for
 *      every deployment, so a preview build at least previews itself rather
 *      than pointing at localhost.
 *
 * Falls back to localhost for `npm run dev`, which is correct there.
 */

function clean(value: string | undefined): string | null {
  const raw = value?.trim();
  if (!raw) return null;
  // Vercel supplies a bare host with no scheme; an operator setting
  // NEXT_PUBLIC_SITE_URL by hand usually includes one. Accept both, and refuse
  // anything that is not a URL once a scheme is on it rather than letting
  // `new URL()` throw during metadata generation and take the build with it.
  const withScheme = /^https?:\/\//.test(raw) ? raw : `https://${raw}`;
  try {
    return new URL(withScheme).origin;
  } catch {
    return null;
  }
}

export const SITE_ORIGIN: string =
  clean(process.env.NEXT_PUBLIC_SITE_URL) ??
  clean(process.env.VERCEL_PROJECT_PRODUCTION_URL) ??
  clean(process.env.VERCEL_URL) ??
  "http://localhost:3000";

export const SITE_URL = new URL(SITE_ORIGIN);
