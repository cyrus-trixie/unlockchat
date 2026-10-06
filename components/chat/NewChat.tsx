"use client";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import Avatar from "@/components/ui/Avatar";
import type { Profile } from "@/types";

export default function NewChat({ meId }: { meId: string }) {
  const router = useRouter();
  const [q, setQ] = useState("");
  const [results, setResults] = useState<Profile[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const term = q.trim().replace(/[^A-Za-z0-9_]/g, "");
    if (term.length < 2) { setResults([]); return; }
    setLoading(true);
    const t = setTimeout(async () => {
      const { data } = await createClient().from("profiles").select("*").ilike("username", `${term}%`)
        .neq("id", meId).limit(10).returns<Profile[]>();
      setResults(data ?? []);
      setLoading(false);
    }, 250);
    return () => clearTimeout(t);
  }, [q, meId]);

  async function start(userId: string) {
    setError(null);
    const { data, error } = await createClient().rpc("start_conversation", { other: userId });
    if (error || !data) return setError("Could not start conversation.");
    router.push(`/chats/${data as string}`);
  }

  return (
    <div className="space-y-4">
      <input className="input" placeholder="Search username…" value={q} onChange={(e) => setQ(e.target.value)} autoFocus />
      {error && <p className="text-sm text-red-400">{error}</p>}
      {loading && <p className="text-sm text-neutral-500">Searching…</p>}
      {!loading && q.trim().length >= 2 && results.length === 0 && <p className="text-sm text-neutral-500">No users found.</p>}
      <ul className="space-y-1">
        {results.map((p) => (
          <li key={p.id}>
            <button onClick={() => start(p.id)} className="flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left hover:bg-neutral-900">
              <Avatar name={p.username} url={p.avatar_url} /><span className="font-medium">{p.username}</span>
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
}
