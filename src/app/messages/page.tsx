import { NotBuiltYet } from "@/components/NotBuiltYet";

export const metadata = { title: "Messages" };

export default function MessagesPage() {
  return (
    <NotBuiltYet title="Messages" step="9" backHref="/app" backLabel="Back to dashboard">
      <p>
        One-to-one conversations, and threads attached to the listing or group
        they came from, so you always know what a message is about.
      </p>
      <p>Free for everyone, with blocking and reporting from the first version.</p>
    </NotBuiltYet>
  );
}
