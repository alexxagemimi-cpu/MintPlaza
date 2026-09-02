import { NotBuiltYet } from "@/components/NotBuiltYet";

export const metadata = { title: "Settings" };

export default function SettingsPage() {
  return (
    <NotBuiltYet title="Your account" step="3" backHref="/app" backLabel="Back to dashboard">
      <p>
        Profile, blocked players and privacy controls. Your identity comes from
        Roblox sign-in, so there is no password here to manage.
      </p>
    </NotBuiltYet>
  );
}
