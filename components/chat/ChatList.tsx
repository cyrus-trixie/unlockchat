"use client";
import Link from "next/link";
import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import Avatar from "@/components/ui/Avatar";
import { shortTime } from "@/lib/format";
import type { ConversationSummary } from "@/types";

export default function ChatList({ initial }: { initial: ConversationSummary[] }) {
  const [items, setItems] = useState(initial);

  useEffect(() => {
    const supabase = createClient();
    const refresh = async () => {
      const { data } = await supabase.rpc("list_conversations").returns<ConversationSummary[]>();
      if (data) setItems(data);
    };
    const channel = supabase.channel("chat-list")
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "messages" }, () => void refresh())
      .subscribe();
    return () => { void supabase.removeChannel(channel); };
  }, []);

  if (items.length === 0) {
    return <p className="mt-16 text-center text-sm text-neutral-500">No conversations yet. Start one by searching a username.</p>;
  }
  return (
    <ul className="divide-y divide-neutral-900">
      {items.map((c) => (
        <li key={c.conversation_id}>
          <Link href={`/chats/${c.conversation_id}`} className="flex items-center gap-3 px-4 py-3 hover:bg-neutral-900/60">
            <Avatar name={c.other_username} url={c.other_avatar_url} />
            <div className="min-w-0 flex-1">
              <div className="flex items-baseline justify-between gap-2">
                <p className={`truncate ${c.unread ? "font-bold" : "font-medium"}`}>{c.other_username}</p>
                <span className="shrink-0 text-xs text-neutral-500">{shortTime(c.last_message_at)}</span>
              </div>
              <p className={`truncate text-sm ${c.unread ? "text-neutral-200" : "text-neutral-500"}`}>
                {c.last_message_type === "image" ? "📷 Image" : c.last_message_text ?? "No messages yet"}
              </p>
            </div>
            {c.unread && <span className="h-2.5 w-2.5 shrink-0 rounded-full bg-indigo-500" aria-label="Unread" />}
          </Link>
        </li>
      ))}
    </ul>
  );
}
