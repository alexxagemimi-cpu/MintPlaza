import { NotBuiltYet } from "@/components/NotBuiltYet";

export const metadata = { title: "Terms" };

export default function TermsPage() {
  return (
    <NotBuiltYet title="Terms of service" step="Launch blocker" backHref="/" backLabel="Back to home">
      <p>
        Required alongside the privacy policy for Roblox&rsquo;s OAuth app
        review, and left empty for the same reason: unreviewed boilerplate is
        not worth publishing.
      </p>
    </NotBuiltYet>
  );
}
