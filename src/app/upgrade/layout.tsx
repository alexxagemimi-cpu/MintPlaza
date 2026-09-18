import { TermsGuard } from "@/components/TermsGuard";

/**
 * Paying without having agreed to the refund terms is the worst
 * version of this gap: the one transaction where the agreement matters most
 * would be the one nobody accepted.
 *
 * See TermsGuard for why this is a per-route component rather than middleware.
 */
export default function Layout({ children }: { children: React.ReactNode }) {
  return (
    <>
      {children}
      <TermsGuard />
    </>
  );
}
