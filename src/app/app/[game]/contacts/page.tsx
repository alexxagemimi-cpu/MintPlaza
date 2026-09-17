import { redirect } from "next/navigation";

/**
 * Contacts is now Messages.
 *
 * This screen was built on demo data — invented people with invented threads —
 * and in production, where demo mode is off by construction, it rendered as an
 * empty page with no way to make it non-empty. Real messaging replaced it.
 *
 * The route survives as a redirect rather than a 404 because the rail pointed
 * here for months and somebody's bookmark or shared link still does.
 */
export default async function ContactsPage() {
  redirect("/messages");
}
