/* eslint-disable @next/next/no-img-element */
"use client";
import { useEffect, useState } from "react";
import type { ImageMeta } from "@/types";
import { formatUsd } from "@/lib/format";

export default function ImageMessage({ image, isMine, poll }: { image: ImageMeta; isMine: boolean; poll: boolean }) {
  const [state, setState] = useState<{ unlocked: boolean; url: string } | null>(null);
  const [failed, setFailed] = useState(false);
  const [buying, setBuying] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    let tries = 0;
    let timer: ReturnType<typeof setTimeout> | undefined;
    async function load() {
      try {
        const res = await fetch(`/api/images/${image.id}/url`, { cache: "no-store" });
        if (!res.ok) throw new Error();
        const data = (await res.json()) as { unlocked: boolean; url: string };
        if (cancelled) return;
        setState(data);
        // After returning from Stripe, wait for the webhook to confirm payment.
        if (!data.unlocked && poll && tries++ < 10) timer = setTimeout(load, 2000);
      } catch {
        if (!cancelled) setFailed(true);
      }
    }
    void load();
    return () => { cancelled = true; if (timer) clearTimeout(timer); };
  }, [image.id, poll]);

  async function unlock() {
    setBuying(true);
    setError(null);
    try {
      const res = await fetch("/api/stripe/create-checkout", {
        method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ imageId: image.id }),
      });
      const data = (await res.json()) as { url?: string; error?: string };
      if (!res.ok || !data.url) throw new Error(data.error ?? "Could not start checkout.");
      window.location.href = data.url;
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not start checkout.");
      setBuying(false);
    }
  }

  if (failed) return <div className="flex h-40 w-56 items-center justify-center rounded-xl bg-neutral-900 text-xs text-neutral-500">Image unavailable</div>;
  if (!state) return <div className="h-48 w-56 animate-pulse rounded-xl bg-neutral-800" />;

  const stillLocked = !state.unlocked;
  return (
    <div className="w-56 sm:w-64">
      <div className="relative overflow-hidden rounded-xl">
        <img src={state.url} alt="Shared" className="w-full" />
        {stillLocked && (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-1 bg-black/40 p-3 text-center">
            <p className="text-sm font-semibold">🔒 Locked image</p>
            <p className="text-lg font-bold">{formatUsd(image.price_cents)}</p>
            <button onClick={unlock} disabled={buying} className="btn mt-1 !py-1.5">
              {buying ? "Redirecting…" : poll ? "Confirming payment…" : `Unlock ${formatUsd(image.price_cents)}`}
            </button>
          </div>
        )}
      </div>
      {!stillLocked && image.is_locked && (
        <p className="mt-1 text-xs opacity-80">{isMine ? `🔒 Locked · ${formatUsd(image.price_cents)} to unlock` : "🔓 Unlocked"}</p>
      )}
      {error && <p className="mt-1 text-xs text-red-300">{error}</p>}
    </div>
  );
}
