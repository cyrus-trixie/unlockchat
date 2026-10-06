import { NextResponse, type NextRequest } from "next/server";
import type Stripe from "stripe";
import { getStripe } from "@/lib/stripe/server";
import { createAdminClient } from "@/lib/supabase/admin";

export const runtime = "nodejs";

// The ONLY place a purchase becomes 'completed'. The success redirect never grants access.
export async function POST(req: NextRequest) {
  const signature = req.headers.get("stripe-signature");
  if (!signature) return NextResponse.json({ error: "Missing signature" }, { status: 400 });

  const raw = await req.text(); // raw body required for signature verification
  let event: Stripe.Event;
  try {
    event = getStripe().webhooks.constructEvent(raw, signature, process.env.STRIPE_WEBHOOK_SECRET!);
  } catch {
    return NextResponse.json({ error: "Invalid signature" }, { status: 400 });
  }

  const admin = createAdminClient();

  if (event.type === "checkout.session.completed" || event.type === "checkout.session.async_payment_succeeded") {
    const session = event.data.object as Stripe.Checkout.Session;
    const purchaseId = session.metadata?.purchase_id;
    if (purchaseId && session.payment_status === "paid") {
      const { data: purchase } = await admin.from("purchases").select("amount_cents,stripe_checkout_session_id")
        .eq("id", purchaseId).maybeSingle<{ amount_cents: number; stripe_checkout_session_id: string | null }>();
      if (purchase && purchase.amount_cents === session.amount_total && purchase.stripe_checkout_session_id === session.id) {
        const pi = typeof session.payment_intent === "string" ? session.payment_intent : session.payment_intent?.id ?? null;
        await admin.from("purchases").update({
          status: "completed", stripe_payment_intent_id: pi, completed_at: new Date().toISOString(),
        }).eq("id", purchaseId);
      }
    }
  } else if (event.type === "checkout.session.expired") {
    const session = event.data.object as Stripe.Checkout.Session;
    await admin.from("purchases").update({ status: "failed" })
      .eq("stripe_checkout_session_id", session.id).eq("status", "pending");
  } else if (event.type === "charge.refunded") {
    const charge = event.data.object as Stripe.Charge;
    const pi = typeof charge.payment_intent === "string" ? charge.payment_intent : charge.payment_intent?.id;
    if (pi && charge.refunded) await admin.from("purchases").update({ status: "refunded" }).eq("stripe_payment_intent_id", pi);
  }

  return NextResponse.json({ received: true });
}
