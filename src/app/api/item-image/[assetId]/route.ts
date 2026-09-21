import { NextResponse, type NextRequest } from "next/server";
import { robloxHosted } from "@/lib/roblox-cdn";

/**
 * Resolves a Roblox asset id to the picture Roblox is currently serving for it.
 *
 * ---------------------------------------------------------------------------
 * Why this route exists instead of a direct URL
 * ---------------------------------------------------------------------------
 *
 * `thumbnails.roblox.com/v1/assets` is a JSON API, not an image endpoint. It
 * answers with `{ data: [{ state: "Completed", imageUrl: "https://tr.rbxcdn…" }] }`,
 * so the id has to be exchanged for a CDN url before a browser can render
 * anything. Doing that exchange in the browser would mean 3,108 cross-origin
 * fetches on a catalogue page, and doing it at build time would bake in urls
 * that Roblox rotates.
 *
 * So it happens here, once, behind a long cache. The response is a redirect
 * rather than a proxied body: MintPlaza should not be in the business of
 * serving image bytes it does not own, and a redirect lets Roblox's CDN do the
 * delivery it is already doing for the game itself.
 *
 * ---------------------------------------------------------------------------
 * Why a failure here is not an error
 * ---------------------------------------------------------------------------
 *
 * Roblox generates thumbnails lazily: a valid id can legitimately answer
 * `state: "Pending"` with no url yet. That is not a fault to log or retry, it
 * is a picture that does not exist yet, and the tile already has a real design
 * for that case — the typographic rarity tile. So every failure path returns
 * 404 quickly and lets the client fall back, rather than holding the request
 * open or serving a placeholder image nobody chose.
 */

/** Roblox asset ids are numeric. Anything else is not worth a network call. */
const ASSET_ID = /^\d{1,20}$/;

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ assetId: string }> },
) {
  const { assetId } = await params;
  if (!ASSET_ID.test(assetId)) {
    return new NextResponse(null, { status: 400 });
  }

  let imageUrl: string | undefined;
  try {
    const res = await fetch(
      `https://thumbnails.roblox.com/v1/assets?assetIds=${assetId}&size=420x420&format=Png`,
      {
        // Roblox 403s requests with no User-Agent.
        headers: { "User-Agent": "MintPlaza/1.0 (+https://mintplaza.app)" },
        // A thumbnail url is stable for hours and this is a picture, not a
        // price — a day-old one is correct, and the alternative is an
        // uncacheable call on every tile of a 10,000 row catalogue.
        next: { revalidate: 86_400 },
        signal: AbortSignal.timeout(5_000),
      },
    );
    if (!res.ok) return new NextResponse(null, { status: 404 });

    const body = (await res.json()) as {
      data?: { state?: string; imageUrl?: string }[];
    };
    const entry = body.data?.[0];
    if (entry?.state === "Completed" && entry.imageUrl) imageUrl = entry.imageUrl;
  } catch {
    // Timeout, network failure, or a body that is not the shape documented.
    // All three mean the same thing to the caller: no picture.
    return new NextResponse(null, { status: 404 });
  }

  if (!imageUrl || !robloxHosted(imageUrl)) return new NextResponse(null, { status: 404 });

  const response = NextResponse.redirect(imageUrl, 307);
  response.headers.set(
    "Cache-Control",
    "public, max-age=86400, stale-while-revalidate=604800",
  );
  return response;
}
