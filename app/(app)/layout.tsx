import { redirect } from "next/navigation";
import Sidebar from "@/components/ui/Sidebar";
import { createClient } from "@/lib/supabase/server";
import type { Profile } from "@/types";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");
  const { data: profile } = await supabase.from("profiles").select("*").eq("id", user.id).single<Profile>();
  return (
    <div className="flex min-h-dvh flex-col md:flex-row">
      <Sidebar username={profile?.username ?? "me"} avatarUrl={profile?.avatar_url ?? null} />
      <main className="min-w-0 flex-1 pb-16 md:pb-0">{children}</main>
    </div>
  );
}
