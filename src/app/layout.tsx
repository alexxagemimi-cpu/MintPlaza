import type { Metadata, Viewport } from "next";
import { Manrope, JetBrains_Mono } from "next/font/google";
import "./globals.css";
import { AnnouncementGate } from "@/components/AnnouncementGate";

const manrope = Manrope({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700", "800"],
  variable: "--font-manrope",
  display: "swap",
});

const jetbrains = JetBrains_Mono({
  subsets: ["latin"],
  weight: ["400", "500", "700"],
  variable: "--font-jetbrains",
  display: "swap",
});

export const metadata: Metadata = {
  title: {
    default: "MintPlaza — find the trade, the team, or the help you need",
    template: "%s · MintPlaza",
  },
  description:
    "MintPlaza organises what players are looking for across six games into something you can actually search, instead of scrolling a Discord channel that moves faster than you can read.",
  applicationName: "MintPlaza",
};

export const viewport: Viewport = {
  themeColor: "#F7F9F8",
  colorScheme: "light",
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en" className={`${manrope.variable} ${jetbrains.variable}`}>
      <body>
        {children}
        {/* Site-wide, and a client component on purpose: it checks storage
            before it asks the server, so a visitor who has already closed it
            costs no request and no page stops being prerendered. It renders
            nothing on the panel or the legal documents. */}
        <AnnouncementGate />
      </body>
    </html>
  );
}
