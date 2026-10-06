import Link from "next/link";
import ChatList from "@/components/chat/ChatList";
import { createClient } from "@/lib/supabase/server";
import type { ConversationSummary } from "@/types";

export default async function ChatsPage() {
  const supabase = await createClient();
  const { data } = await supabase.rpc("list_conversations").returns<ConversationSummary[]>();
  return (
    <div className="mx-auto max-w-2xl">
      <div className="flex items-center justify-between px-4 py-4">
        <h1 className="text-xl font-bold">Chats</h1>
        <Link href="/chats/new" className="btn">New chat</Link>
      </div>
      <ChatList initial={data ?? []} />
    </div>
  );
}
