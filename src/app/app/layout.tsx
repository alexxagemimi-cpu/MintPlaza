import { Rail } from "@/components/Rail";

export default function AppLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <div className="min-h-dvh lg:pl-24">
      <Rail />
      {/* Bottom padding clears the touch bar on small screens. */}
      <div className="pb-32 lg:pb-12">{children}</div>
    </div>
  );
}
