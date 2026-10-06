import { redirect } from "next/navigation";
import ProfileForm from "@/components/profile/ProfileForm";
import { createClient } from "@/lib/supabase/server";
import type { Profile } from "@/types";

export default async function ProfilePage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");
  const { data: profile } = await supabase.from("profiles").select("*").eq("id", user.id).single<Profile>();
  if (!profile) redirect("/login");
  return (
    <div className="mx-auto max-w-md px-4 py-6">
      <h1 className="mb-6 text-xl font-bold">Profile</h1>
      <ProfileForm profile={profile} />
    </div>
  );
}
