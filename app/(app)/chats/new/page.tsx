import { redirect } from "next/navigation";
import NewChat from "@/components/chat/NewChat";
import { createClient } from "@/lib/supabase/server";

export default async function NewChatPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");
  return (
    <div className="mx-auto max-w-2xl px-4 py-4">
      <h1 className="mb-4 text-xl font-bold">New chat</h1>
      <NewChat meId={user.id} />
    </div>
  );
}
