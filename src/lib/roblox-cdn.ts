/**
 * Where a Roblox thumbnail is allowed to live.
 *
 * /api/item-image/<id> reads `imageUrl` out of a JSON body from Roblox's
 * thumbnail API and hands it straight to the browser as a 307, cached for a
 * day. Without a check on where that points, the route is an open redirect on
 * MintPlaza's own domain whose destination is chosen by whatever that API
 * returns — and one bad answer would be served to everybody who loads that
 * tile until the cache expired.
 *
 * Roblox is not the threat being modelled. A public, cacheable endpoint on our
 * domain that forwards anywhere is worth closing on its own terms.
 *
 * In its own module rather than beside the route because a Next.js route file
 * may only export its handlers — and a host allowlist that cannot be tested is
 * a host allowlist nobody will notice breaking. Roblox serves thumbnails from
 * t0…t7.rbxcdn.com and tr.rbxcdn.com, which rotate; the suffix is the stable
 * part.
 */
export function robloxHosted(raw: string): boolean {
  let u: URL;
  try {
    u = new URL(raw);
  } catch {
    return false;
  }
  if (u.protocol !== "https:") return false;
  return u.hostname === "rbxcdn.com" || u.hostname.endsWith(".rbxcdn.com");
}
