/**
 * Where a redirect is allowed to send somebody.
 *
 * ---------------------------------------------------------------------------
 * Why this is not `asked.startsWith("/") && !asked.startsWith("//")`
 * ---------------------------------------------------------------------------
 *
 * That was the check, in two routes, written out twice. It reads as "only a
 * path on our own site" and it is not:
 *
 *   new URL("/\\evil.com", "https://mintplaza.app")  ->  https://evil.com/
 *
 * The WHATWG URL parser treats a backslash as a slash for http and https, so
 * `/\evil.com` becomes `//evil.com` after the check has already looked at the
 * raw string and seen a single leading slash. `/\/evil.com` does the same.
 * Both were verified against Node's URL before this file existed.
 *
 * On a site whose terms promise it will never ask for a password, a link that
 * starts on the real domain and lands on somebody else's is worth more to a
 * phisher than almost anything else here — the domain in the address bar is
 * the one thing a player is told to check.
 *
 * So nothing is decided by reading the string. The URL is resolved the same
 * way the browser will resolve it, and the ORIGIN of the result is compared.
 * Any trick that survives parsing is visible in the origin by definition,
 * which is what makes this immune to the next encoding nobody has thought of.
 *
 * One helper rather than a check in each route, because the two copies of the
 * old one were identical and both wrong, and a fix applied to one of them
 * would have left the other open.
 */
export function internalPath(
  asked: string | null | undefined,
  origin: string,
  fallback: string,
): string {
  if (!asked) return fallback;

  let target: URL;
  try {
    target = new URL(asked, origin);
  } catch {
    return fallback;
  }

  if (target.origin !== origin) return fallback;
  return `${target.pathname}${target.search}${target.hash}`;
}
