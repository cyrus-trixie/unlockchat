/* eslint-disable @next/next/no-img-element */
"use client";
import Link from "next/link";
import { useCallback, useEffect, useMemo, useRef, useState, type ChangeEvent, type FormEvent } from "react";
import { createClient } from "@/lib/supabase/client";
import ImageMessage from "@/components/images/ImageMessage";
import Avatar from "@/components/ui/Avatar";
import { ALLOWED_TYPES, LOCKED_PRICE_CENTS, MAX_IMAGE_BYTES } from "@/lib/config";
import { formatUsd, shortTime } from "@/lib/format";
import type { MessageWithImage, Profile } from "@/types";

const SELECT = "*, images(id,sender_id,price_cents,is_locked)";

interface Props {
  conversationId: string;
  meId: string;
  other: Pick<Profile, "id" | "username" | "avatar_url">;
  initialMessages: MessageWithImage[];
  checkoutImageId: string | null;
}

export default function ChatView({ conversationId, meId, other, initialMessages, checkoutImageId }: Props) {
  const supabase = useMemo(() => createClient(), []);
  const [messages, setMessages] = useState(initialMessages);
  const [text, setText] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [locked, setLocked] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const bottomRef = useRef<HTMLDivElement>(null);
  const fileInput = useRef<HTMLInputElement>(null);
  const previewUrl = useMemo(() => (file ? URL.createObjectURL(file) : null), [file]);

  useEffect(() => () => { if (previewUrl) URL.revokeObjectURL(previewUrl); }, [previewUrl]);
  useEffect(() => { bottomRef.current?.scrollIntoView({ behavior: "smooth" }); }, [messages.length]);

  const addMessage = useCallback((m: MessageWithImage) => {
    setMessages((prev) => (prev.some((x) => x.id === m.id) ? prev : [...prev, m]));
  }, []);

  // Realtime: new messages in this conversation (RLS applies to the subscription).
  useEffect(() => {
    const channel = supabase
      .channel(`chat:${conversationId}`)
      .on("postgres_changes",
        { event: "INSERT", schema: "public", table: "messages", filter: `conversation_id=eq.${conversationId}` },
        async (payload) => {
          const { data } = await supabase.from("messages").select(SELECT).eq("id", (payload.new as { id: string }).id).single<MessageWithImage>();
          if (!data) return;
          addMessage(data);
          if (data.sender_id !== meId) void supabase.rpc("mark_conversation_read", { cid: conversationId });
        })
      .subscribe();
    return () => { void supabase.removeChannel(channel); };
  }, [supabase, conversationId, meId, addMessage]);

  async function sendText(e: FormEvent) {
    e.preventDefault();
    const t = text.trim();
    if (!t) return;
    setText("");
    setError(null);
    const { data, error } = await supabase.from("messages")
      .insert({ conversation_id: conversationId, sender_id: meId, message_type: "text", text_content: t })
      .select(SELECT).single<MessageWithImage>();
    if (error || !data) { setError("Message failed to send."); setText(t); return; }
    addMessage(data);
  }

  function pickFile(e: ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0];
    e.target.value = "";
    if (!f) return;
    if (!ALLOWED_TYPES.includes(f.type)) return setError("Only JPG, PNG or WEBP images.");
    if (f.size > MAX_IMAGE_BYTES) return setError("Image must be 10MB or smaller.");
    setError(null);
    setFile(f);
  }

  async function sendImage() {
    if (!file) return;
    setBusy(true);
    setError(null);
    const form = new FormData();
    form.append("file", file);
    form.append("conversationId", conversationId);
    form.append("locked", String(locked));
    try {
      const res = await fetch("/api/images/upload", { method: "POST", body: form });
      const data = (await res.json()) as { message?: MessageWithImage; error?: string };
      if (!res.ok || !data.message) throw new Error(data.error ?? "Upload failed.");
      addMessage(data.message);
      setFile(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Upload failed.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="flex h-[calc(100dvh-4rem)] flex-col md:h-dvh">
      <header className="flex items-center gap-3 border-b border-neutral-900 px-4 py-3">
        <Link href="/chats" className="text-neutral-400 hover:text-white">←</Link>
        <Avatar name={other.username} url={other.avatar_url} size={36} />
        <p className="font-semibold">{other.username}</p>
      </header>

      <div className="flex-1 space-y-2 overflow-y-auto px-4 py-4">
        {messages.length === 0 && <p className="mt-10 text-center text-sm text-neutral-500">Say hi to {other.username} 👋</p>}
        {messages.map((m) => {
          const mine = m.sender_id === meId;
          return (
            <div key={m.id} className={`flex ${mine ? "justify-end" : "justify-start"}`}>
              <div className={`max-w-[80%] rounded-2xl p-2 ${mine ? "bg-indigo-600" : "bg-neutral-800"} ${m.message_type === "text" ? "px-3.5 py-2" : ""}`}>
                {m.message_type === "text" ? (
                  <p className="whitespace-pre-wrap break-words text-sm">{m.text_content}</p>
                ) : m.images ? (
                  <ImageMessage image={m.images} isMine={mine} poll={checkoutImageId === m.images.id} />
                ) : null}
                <p className="mt-1 px-1 text-right text-[10px] opacity-60">{shortTime(m.created_at)}</p>
              </div>
            </div>
          );
        })}
        <div ref={bottomRef} />
      </div>

      {file && previewUrl && (
        <div className="border-t border-neutral-900 bg-neutral-950 p-3">
          <div className="flex items-center gap-3">
            <img src={previewUrl} alt="Selected" className="h-16 w-16 rounded-lg object-cover" />
            <div className="flex-1 space-y-2">
              <div className="inline-flex overflow-hidden rounded-lg border border-neutral-800 text-xs">
                <button onClick={() => setLocked(false)} className={`px-3 py-1.5 ${!locked ? "bg-neutral-700" : ""}`}>Free</button>
                <button onClick={() => setLocked(true)} className={`px-3 py-1.5 ${locked ? "bg-indigo-600" : ""}`}>🔒 Locked · {formatUsd(LOCKED_PRICE_CENTS)}</button>
              </div>
            </div>
            <button className="btn-ghost" onClick={() => setFile(null)} disabled={busy}>Cancel</button>
            <button className="btn" onClick={sendImage} disabled={busy}>{busy ? "Sending…" : "Send"}</button>
          </div>
        </div>
      )}

      {error && <p className="px-4 pb-1 text-xs text-red-400">{error}</p>}
      <form onSubmit={sendText} className="flex items-center gap-2 border-t border-neutral-900 p-3">
        <input ref={fileInput} type="file" accept={ALLOWED_TYPES.join(",")} className="hidden" onChange={pickFile} />
        <button type="button" onClick={() => fileInput.current?.click()} className="btn-ghost !px-3" aria-label="Send image">🖼️</button>
        <input className="input !rounded-full" placeholder="Message…" value={text} onChange={(e) => setText(e.target.value)} maxLength={2000} />
        <button className="btn !rounded-full" disabled={!text.trim()}>Send</button>
      </form>
    </div>
  );
}
