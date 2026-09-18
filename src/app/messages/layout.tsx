import { TermsGuard } from "@/components/TermsGuard";

/**
 * Messaging is the surface somebody would use to reach people
 * without having agreed not to scam them, so the screen belongs here too.
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
