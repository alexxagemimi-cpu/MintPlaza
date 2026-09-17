import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { readThread } from "@/lib/actions/messages";
import { MessageThread } from "@/components/MessageThread";

export const metadata: Metadata = { title: "Message" };

/**
 * One conversation, by id.
 *
 * `readThread` returns null both when the conversation does not exist and when
 * the caller is not in it, and both land on the same 404. That is the right
 * answer to a probe: "forbidden" would confirm the id belongs to a real
 * conversation, which is a fact about two other people that this page has no
 * business confirming.
 *
 * The check is not really here at all — conversation_thread() re-checks
 * membership inside the database, where it holds against a forged request as
 * well as against this page. This is the presentation of that answer.
 */
export default async function ThreadPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const thread = await readThread(id);
  if (!thread) notFound();

  return <MessageThread conversationId={id} thread={thread} />;
}
