import { notFound, redirect } from "next/navigation";
import ChatView from "@/components/chat/ChatView";
import { createClient } from "@/lib/supabase/server";
import type { MessageWithImage, Profile } from "@/types";

interface MemberRow { user_id: string; profiles: Pick<Profile, "id" | "username" | "avatar_url"> | null }

export default async function ConversationPage({
  params, searchParams,
}: { params: Promise<{ conversationId: string }>; searchParams: Promise<{ image?: string; checkout?: string }> }) {
  const { conversationId } = await params;
  const { image, checkout } = await searchParams;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  // RLS returns rows only for conversations the user belongs to.
  const { data: members } = await supabase.from("conversation_members").select("user_id, profiles(id,username,avatar_url)")
    .eq("conversation_id", conversationId).returns<MemberRow[]>();
  const other = members?.find((m) => m.user_id !== user.id)?.profiles;
  if (!members?.some((m) => m.user_id === user.id) || !other) notFound();

  const { data: recent } = await supabase.from("messages").select("*, images(id,sender_id,price_cents,is_locked)")
    .eq("conversation_id", conversationId).order("created_at", { ascending: false }).limit(100)
    .returns<MessageWithImage[]>();
  await supabase.rpc("mark_conversation_read", { cid: conversationId });

  return (
    <ChatView
      conversationId={conversationId}
      meId={user.id}
      other={other}
      initialMessages={(recent ?? []).reverse()}
      checkoutImageId={checkout === "success" ? image ?? null : null}
    />
  );
}
