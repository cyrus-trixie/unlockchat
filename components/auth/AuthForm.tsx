"use client";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";
import { createClient } from "@/lib/supabase/client";

export default function AuthForm({ mode }: { mode: "login" | "signup" }) {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [username, setUsername] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const isSignup = mode === "signup";

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setBusy(true);
    const supabase = createClient();
    try {
      if (isSignup) {
        if (!/^[A-Za-z0-9_]{3,20}$/.test(username)) throw new Error("Username: 3-20 letters, numbers or underscores.");
        const { data: free } = await supabase.rpc("username_available", { p: username });
        if (!free) throw new Error("That username is taken.");
        const { data, error } = await supabase.auth.signUp({
          email, password,
          options: { data: { username }, emailRedirectTo: `${window.location.origin}/auth/callback` },
        });
        if (error) throw error;
        if (!data.session) { setNotice("Check your email to confirm your account, then log in."); return; }
      } else {
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) throw error;
      }
      router.push("/chats");
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className="mx-auto flex min-h-dvh max-w-sm flex-col justify-center px-6">
      <Link href="/" className="mb-6 text-sm font-medium text-indigo-400">UnlockChat</Link>
      <h1 className="mb-6 text-2xl font-bold">{isSignup ? "Create your account" : "Welcome back"}</h1>
      <form onSubmit={onSubmit} className="space-y-3">
        {isSignup && <input className="input" placeholder="Username" value={username} onChange={(e) => setUsername(e.target.value)} required autoComplete="username" />}
        <input className="input" type="email" placeholder="Email" value={email} onChange={(e) => setEmail(e.target.value)} required autoComplete="email" />
        <input className="input" type="password" placeholder="Password (min 6 chars)" minLength={6} value={password} onChange={(e) => setPassword(e.target.value)} required autoComplete={isSignup ? "new-password" : "current-password"} />
        {error && <p className="text-sm text-red-400">{error}</p>}
        {notice && <p className="text-sm text-emerald-400">{notice}</p>}
        <button className="btn w-full" disabled={busy}>{busy ? "Please wait…" : isSignup ? "Sign up" : "Log in"}</button>
      </form>
      <p className="mt-6 text-sm text-neutral-400">
        {isSignup ? "Already have an account? " : "New here? "}
        <Link className="text-indigo-400" href={isSignup ? "/login" : "/signup"}>{isSignup ? "Log in" : "Sign up"}</Link>
      </p>
    </main>
  );
}
