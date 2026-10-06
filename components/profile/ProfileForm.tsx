"use client";
import { useRouter } from "next/navigation";
import { useState, type ChangeEvent, type FormEvent } from "react";
import { createClient } from "@/lib/supabase/client";
import Avatar from "@/components/ui/Avatar";
import type { Profile } from "@/types";

export default function ProfileForm({ profile }: { profile: Profile }) {
  const router = useRouter();
  const [username, setUsername] = useState(profile.username);
  const [avatarUrl, setAvatarUrl] = useState(profile.avatar_url);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [busy, setBusy] = useState(false);
  const supabase = createClient();

  async function saveUsername(e: FormEvent) {
    e.preventDefault();
    setMsg(null);
    if (!/^[A-Za-z0-9_]{3,20}$/.test(username)) return setMsg({ ok: false, text: "3-20 letters, numbers or underscores." });
    setBusy(true);
    const { error } = await supabase.from("profiles").update({ username }).eq("id", profile.id);
    setBusy(false);
    if (error) return setMsg({ ok: false, text: error.code === "23505" ? "That username is taken." : "Could not save." });
    setMsg({ ok: true, text: "Saved." });
    router.refresh();
  }

  async function uploadAvatar(e: ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0];
    e.target.value = "";
    if (!f) return;
    if (!["image/jpeg", "image/png", "image/webp"].includes(f.type)) return setMsg({ ok: false, text: "JPG, PNG or WEBP only." });
    if (f.size > 2 * 1024 * 1024) return setMsg({ ok: false, text: "Avatar must be 2MB or smaller." });
    setBusy(true);
    setMsg(null);
    const path = `${profile.id}/${Date.now()}.${f.type.split("/")[1]}`;
    const up = await supabase.storage.from("avatars").upload(path, f, { contentType: f.type });
    if (up.error) { setBusy(false); return setMsg({ ok: false, text: "Upload failed." }); }
    const url = supabase.storage.from("avatars").getPublicUrl(path).data.publicUrl;
    const { error } = await supabase.from("profiles").update({ avatar_url: url }).eq("id", profile.id);
    setBusy(false);
    if (error) return setMsg({ ok: false, text: "Could not save avatar." });
    setAvatarUrl(url);
    setMsg({ ok: true, text: "Avatar updated." });
    router.refresh();
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <Avatar name={username || "?"} url={avatarUrl} size={72} />
        <label className="btn-ghost cursor-pointer">
          Change avatar
          <input type="file" accept="image/jpeg,image/png,image/webp" className="hidden" onChange={uploadAvatar} disabled={busy} />
        </label>
      </div>
      <form onSubmit={saveUsername} className="space-y-3">
        <label className="text-sm text-neutral-400">Username</label>
        <input className="input" value={username} onChange={(e) => setUsername(e.target.value)} />
        <button className="btn" disabled={busy || username === profile.username}>Save username</button>
      </form>
      {msg && <p className={`text-sm ${msg.ok ? "text-emerald-400" : "text-red-400"}`}>{msg.text}</p>}
    </div>
  );
}
