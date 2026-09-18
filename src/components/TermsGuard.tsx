import { hasAcceptedTerms } from "@/lib/actions/terms";
import { currentProfile } from "@/lib/supabase/server";
import { TermsGate } from "./TermsGate";

/**
 * Drops the consent screen over whatever route it is placed on.
 *
 * ---------------------------------------------------------------------------
 * Why this exists as a component rather than living in one layout
 * ---------------------------------------------------------------------------
 *
 * The gate started inside the /app layout, which covers the dashboard and
 * everything under it — and nothing else. /messages, /upgrade and /support are
 * their own top-level routes, so a signed-in account could reach any of them
 * without ever passing the screen. Two of those matter a great deal: somebody
 * could message strangers without having agreed not to scam them, and somebody
 * could PAY without having agreed to the refund terms they would later rely on.
 *
 * Middleware would catch every route at once, but at the cost of a database
 * round trip on every request including static assets, to enforce something
 * the database already enforces by itself.
 *
 * So: the database refuses the actions that create an obligation (see
 * mintplaza.has_agreed), and this puts the screen in front of the surfaces
 * where somebody would otherwise hit that refusal with no explanation.
 *
 * Deliberately NOT placed on /terms, /privacy or the sign-out route. Being
 * unable to read what you are agreeing to, or to leave, would make the consent
 * worthless and the site a trap.
 */
export async function TermsGuard() {
  const [profile, accepted] = await Promise.all([
    currentProfile(),
    hasAcceptedTerms(),
  ]);
  if (!profile || accepted) return null;
  return <TermsGate username={profile.username} />;
}
