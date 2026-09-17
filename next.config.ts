import type { NextConfig } from "next";

/**
 * Security headers.
 *
 * There were none, and for this site in particular that is not a formality.
 *
 * MintPlaza is used by teenagers to decide whether a stranger is worth handing
 * a Huge Cat to, and the whole trust model rests on the player believing what
 * is on screen belongs to MintPlaza. Two of these headers defend exactly that:
 *
 *   frame-ancestors stops the site being loaded inside somebody else's page.
 *   Without it, anyone can iframe a profile, lay their own "SAFE TRADER ✓" over
 *   it, and screenshot it — or overlay a real button with a fake one and let a
 *   player click through. A scam site dressing itself in a real MintPlaza
 *   profile is the cheapest attack available against a site like this one.
 *
 *   Referrer-Policy stops the URL leaking outward. Paths here carry Roblox
 *   usernames — /app/pet-simulator-99/profile/alx22n — and the default policy
 *   sends the full path to every third-party host the page touches. Every
 *   outbound link a player follows would carry whose profile they were reading.
 *
 * The rest are the ordinary ones: no MIME sniffing, HSTS so a downgrade cannot
 * be forced, and no automatic access to camera, microphone or location, none of
 * which this site ever asks for.
 *
 * Deliberately NOT a full Content-Security-Policy yet. A CSP that has not been
 * tested against every page ships as either a broken site or a policy so loose
 * it certifies nothing, and `unsafe-inline` for styles is unavoidable while
 * Tailwind and Next inject style tags. The two directives below carry their
 * weight without that risk; a full policy is worth doing once there are real
 * users to measure breakage against.
 */
const SECURITY_HEADERS = [
  // Clickjacking, twice: the modern directive and the legacy header, because
  // older browsers ignore the first and younger ones ignore the second.
  { key: "Content-Security-Policy", value: "frame-ancestors 'self'" },
  { key: "X-Frame-Options", value: "SAMEORIGIN" },

  // A stylesheet served as text/html is a script waiting for a browser that
  // guesses. This stops the guessing.
  { key: "X-Content-Type-Options", value: "nosniff" },

  // Same-origin gets the full path; anyone else gets the bare origin. Enough
  // for analytics on our own side, nothing for a third party.
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },

  // Once a browser has seen this, it refuses to talk to the site over plain
  // http at all — which is what closes the window where a session cookie can
  // be read off a shared network.
  { key: "Strict-Transport-Security", value: "max-age=63072000; includeSubDomains" },

  // The site asks for none of these. Saying so means a compromised script
  // cannot ask on its behalf either.
  { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=(), interest-cohort=()" },
];

const config: NextConfig = {
  reactStrictMode: true,
  // This is a standalone website, not an agent workspace.
  agentRules: false,

  async headers() {
    return [{ source: "/:path*", headers: SECURITY_HEADERS }];
  },
};

export default config;
