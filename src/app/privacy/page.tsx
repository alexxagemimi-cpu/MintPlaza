import { NotBuiltYet } from "@/components/NotBuiltYet";

export const metadata = { title: "Privacy" };

export default function PrivacyPage() {
  return (
    <NotBuiltYet title="Privacy policy" step="Launch blocker" backHref="/" backLabel="Back to home">
      <p>
        This page has to exist, with real reviewed text, before MintPlaza can
        pass Roblox&rsquo;s OAuth app review — which is also the gate on serving
        more than ten players.
      </p>
      <p>
        It is deliberately empty rather than filled with boilerplate: a privacy
        policy that has not been checked against what the product actually
        stores is worse than none at all.
      </p>
    </NotBuiltYet>
  );
}
