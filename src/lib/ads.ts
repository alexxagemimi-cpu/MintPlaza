/**
 * The rewarded ad in front of finalising a deal.
 *
 * ---------------------------------------------------------------------------
 * Why this is a seam and not an ad network
 * ---------------------------------------------------------------------------
 *
 * No network is connected yet, and writing an integration against one that has
 * not been chosen produces code nobody can test and everybody trusts. So this
 * file is the decision — is there an ad, and what happens when there is not —
 * and the network is one environment variable away from being plugged into it.
 *
 * ---------------------------------------------------------------------------
 * Why it fails OPEN, always
 * ---------------------------------------------------------------------------
 *
 * By the time the finalise button is pressed, several people have voted, been
 * picked, and said yes. They are waiting on one tap. An ad script that is
 * blocked, slow, regionally unavailable, or simply broken must not be the
 * thing that strands them — "your deal cannot be completed because an advert
 * did not load" is not a sentence this site is going to show a fourteen-year-
 * old who has organised five people.
 *
 * So the ad is attempted and the deal completes either way. Whether it was
 * actually shown is recorded on the listing (`finalize_ad_shown`), which is
 * the honest number to count later — not the number of finalised deals.
 *
 * ---------------------------------------------------------------------------
 * Before turning this on, read this
 * ---------------------------------------------------------------------------
 *
 * Requiring somebody to watch an ad to unlock a feature is "incentivised"
 * traffic. With ordinary AdSense display units that breaks Google's programme
 * policies and is one of the faster ways to lose an AdSense account — which
 * would cost far more than this placement earns.
 *
 * Rewarded ads are a different, permitted format, and AdSense does not offer
 * them for a general website: they come from AdMob (apps), Google Ad Manager,
 * or a gaming ad network. Point REWARDED_AD_PROVIDER at one of those, never at
 * a plain AdSense display slot.
 */

/**
 * Which network to ask. Unset — the default, and the state today — means the
 * finalise button simply finalises, with no ad step and no placeholder
 * pretending to be one.
 */
export const REWARDED_AD_PROVIDER =
  process.env.NEXT_PUBLIC_REWARDED_AD_PROVIDER?.trim() || "";

/** The network's script. Loaded only when a provider is named. */
export const REWARDED_AD_SRC =
  process.env.NEXT_PUBLIC_REWARDED_AD_SRC?.trim() || "";

/** The unit, slot or placement id, whatever the chosen network calls it. */
export const REWARDED_AD_UNIT =
  process.env.NEXT_PUBLIC_REWARDED_AD_UNIT?.trim() || "";

export const REWARDED_ADS_ON = REWARDED_AD_PROVIDER !== "" && REWARDED_AD_SRC !== "";

/** How long to wait before giving up and letting the deal through anyway. */
export const REWARDED_AD_TIMEOUT_MS = 12_000;

/**
 * What the page did about the ad, which is what gets recorded.
 *
 * `shown` is the only one that counts as an impression. The other two are the
 * deal completing without one, and they are deliberately separate so the
 * difference between "nobody has configured a network" and "the network was
 * there and failed" is visible rather than averaged together.
 */
export type AdOutcome = "shown" | "unavailable" | "failed";

/**
 * The contract a provider adapter fulfils.
 *
 * It resolves, never rejects. A rejected promise here would have to be caught
 * by the caller and turned into "carry on anyway", which is this function's
 * job and not the caller's.
 */
export type ShowRewardedAd = () => Promise<AdOutcome>;

/**
 * What a provider script is expected to hang on `window` once it has loaded.
 *
 * One function, taking the unit id, resolving true when the viewer earned the
 * reward. Every rewarded SDK can be wrapped into this in a few lines, and
 * wrapping it in the page rather than here keeps this file free of any one
 * network's vocabulary.
 */
declare global {
  interface Window {
    mintplazaRewardedAd?: (unit: string) => Promise<boolean>;
  }
}

/**
 * Show the ad, or decide there is not one to show.
 *
 * Every path resolves within REWARDED_AD_TIMEOUT_MS. A provider that never
 * calls back is treated as a provider that failed.
 */
export async function showRewardedAd(): Promise<AdOutcome> {
  if (!REWARDED_ADS_ON) return "unavailable";
  if (typeof window === "undefined") return "unavailable";

  try {
    await loadScriptOnce(REWARDED_AD_SRC);
  } catch {
    return "failed";
  }

  const show = window.mintplazaRewardedAd;
  if (typeof show !== "function") return "failed";

  const timeout = new Promise<AdOutcome>((resolve) =>
    setTimeout(() => resolve("failed"), REWARDED_AD_TIMEOUT_MS),
  );

  try {
    return await Promise.race([
      show(REWARDED_AD_UNIT).then((earned) => (earned ? "shown" : "failed")),
      timeout,
    ]);
  } catch {
    return "failed";
  }
}

/** Idempotent, because the finalise button can be pressed more than once. */
const loading = new Map<string, Promise<void>>();

function loadScriptOnce(src: string): Promise<void> {
  const existing = loading.get(src);
  if (existing) return existing;

  const p = new Promise<void>((resolve, reject) => {
    const tag = document.createElement("script");
    tag.src = src;
    tag.async = true;
    tag.onload = () => resolve();
    tag.onerror = () => reject(new Error("ad script did not load"));
    document.head.appendChild(tag);
    setTimeout(() => reject(new Error("ad script timed out")), REWARDED_AD_TIMEOUT_MS);
  });

  loading.set(src, p);
  // A failed load is not cached: an ad blocker switched off mid-session, or a
  // flaky network, should get another attempt rather than being refused for
  // the life of the tab.
  p.catch(() => loading.delete(src));
  return p;
}
