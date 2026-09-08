import { Rail } from "@/components/Rail";
import { TemplateProvider } from "@/components/TemplateProvider";
import { allTemplates } from "@/lib/data/templates";

/**
 * The app shell.
 *
 * The template list is loaded once here rather than on each page, because every
 * screen under /app turns template ids into names — the boards, My lists,
 * Contacts — and loading it per page would mean the same merge four times for
 * one navigation.
 *
 * Retired templates are included on purpose. A live listing can name one that
 * was switched off five minutes ago, and the card still has to be able to say
 * what it was about rather than rendering an empty row.
 */
export default async function AppLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  const templates = await allTemplates();

  return (
    <TemplateProvider templates={templates}>
      <div className="min-h-dvh lg:pl-24">
        <Rail />
        {/* Bottom padding clears the touch bar on small screens. */}
        <div className="pb-32 lg:pb-12">{children}</div>
      </div>
    </TemplateProvider>
  );
}
