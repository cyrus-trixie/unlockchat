import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { formatUsd, shortTime } from "@/lib/format";
import type { PurchaseRow } from "@/types";

export default async function EarningsPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");
  // RLS + explicit filter: only completed sales where I'm the seller.
  const { data } = await supabase.from("purchases")
    .select("id, amount_cents, platform_fee_cents, seller_earnings_cents, created_at")
    .eq("seller_id", user.id).eq("status", "completed").order("created_at", { ascending: false })
    .returns<PurchaseRow[]>();
  const sales = data ?? [];
  const gross = sales.reduce((s, p) => s + p.amount_cents, 0);
  const net = sales.reduce((s, p) => s + p.seller_earnings_cents, 0);
  const stats = [
    ["Images sold", String(sales.length)],
    ["Gross earnings", formatUsd(gross)],
    ["Your share (after fee)", formatUsd(net)],
  ];
  return (
    <div className="mx-auto max-w-2xl px-4 py-6">
      <h1 className="mb-4 text-xl font-bold">Earnings</h1>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        {stats.map(([label, value]) => (
          <div key={label} className="rounded-2xl border border-neutral-800 bg-neutral-900/50 p-4">
            <p className="text-xs text-neutral-400">{label}</p><p className="mt-1 text-2xl font-bold">{value}</p>
          </div>
        ))}
      </div>
      <p className="mt-3 text-xs text-neutral-500">Payouts aren&apos;t enabled yet. Earnings are recorded for when they are.</p>
      <h2 className="mb-2 mt-8 text-sm font-semibold text-neutral-300">Recent sales</h2>
      {sales.length === 0 ? (
        <p className="text-sm text-neutral-500">No sales yet. Send a locked image to get started.</p>
      ) : (
        <ul className="divide-y divide-neutral-900 rounded-2xl border border-neutral-800">
          {sales.slice(0, 20).map((p) => (
            <li key={p.id} className="flex items-center justify-between px-4 py-3 text-sm">
              <span className="text-neutral-400">{shortTime(p.created_at)}</span>
              <span>{formatUsd(p.amount_cents)} <span className="text-neutral-500">→ you {formatUsd(p.seller_earnings_cents)}</span></span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
