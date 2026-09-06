import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { getGame } from "@/lib/games";
import { Contacts } from "@/components/Contacts";
import { demoContacts, demoSuggestions, demoThread } from "@/lib/demo";
import { touchPresence } from "@/lib/actions/board";

/**
 * The people you played with, scoped to one game like everything else in the
 * rail. Somebody deep in Blox Fruits does not want a Royale High raid partner
 * in the way, and the deal a contact came from only makes sense beside the
 * game it happened in.
 */

export async function generateMetadata({
  params,
}: { params: Promise<{ game: string }> }): Promise<Metadata> {
  const game = getGame((await params).game);
  return { title: game ? `${game.shortName} contacts` : "Contacts" };
}

export default async function ContactsPage({
  params,
}: { params: Promise<{ game: string }> }) {
  const game = getGame((await params).game);
  if (!game) notFound();

  await touchPresence();

  // Threads are built here rather than passed as a lookup: a function does not
  // survive the server-to-client boundary, and a Record does.
  const contacts = demoContacts(game.slug);
  const threads = Object.fromEntries(
    contacts.map((c) => [c.id, demoThread(c.id)]),
  );

  return (
    <Contacts
      gameName={game.name}
      suggestions={demoSuggestions(game.slug)}
      contacts={contacts}
      threads={threads}
    />
  );
}
