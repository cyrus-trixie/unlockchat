import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getStripe } from "@/lib/stripe/server";
import { PLATFORM_FEE_PERCENT } from "@/lib/config";

const fail = (error: string, status: number) => NextResponse.json({ error }, { status });

export async function POST(req: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return fail("Unauthorized", 401);

  const body = (await req.json().catch(() => null)) as { imageId?: string } | null;
  if (!body?.imageId) return fail("imageId required", 400);

  // RLS ensures the buyer can only see images from conversations they're in.
  const { data: image } = await supabase.from("images").select("id,sender_id,price_cents,is_locked")
    .eq("id", body.imageId).maybeSingle<{ id: string; sender_id: string; price_cents: number; is_locked: boolean }>();
  if (!image) return fail("Image not found", 404);
  if (!image.is_locked) return fail("This image is free.", 400);
  if (image.sender_id === user.id) return fail("You own this image.", 400);

  const { data: msg } = await supabase.from("messages").select("conversation_id").eq("image_id", image.id).limit(1)
    .maybeSingle<{ conversation_id: string }>();
  if (!msg) return fail("Image not found", 404);

  const admin = createAdminClient();
  const { data: existing } = await admin.from("purchases").select("id,status")
    .eq("buyer_id", user.id).eq("image_id", image.id).maybeSingle<{ id: string; status: string }>();
  if (existing?.status === "completed") return fail("Already unlocked.", 409);

  // Amount comes from the DB, never from the client.
  const amount = image.price_cents;
  const fee = Math.round((amount * PLATFORM_FEE_PERCENT) / 100);
  const row = { amount_cents: amount, platform_fee_cents: fee, seller_earnings_cents: amount - fee, status: "pending" };

  let purchaseId = existing?.id;
  if (purchaseId) {
    await admin.from("purchases").update(row).eq("id", purchaseId); // retry after failed/refunded/abandoned
  } else {
    const { data: created, error } = await admin.from("purchases")
      .insert({ ...row, buyer_id: user.id, seller_id: image.sender_id, image_id: image.id })
      .select("id").single<{ id: string }>();
    if (error || !created) return fail("Could not start checkout.", 500);
    purchaseId = created.id;
  }

  const appUrl = process.env.NEXT_PUBLIC_APP_URL!;
  const chatUrl = `${appUrl}/chats/${msg.conversation_id}`;
  const metadata = { purchase_id: purchaseId, image_id: image.id, buyer_id: user.id };
  const session = await getStripe().checkout.sessions.create({
    mode: "payment",
    line_items: [{ quantity: 1, price_data: { currency: "usd", unit_amount: amount, product_data: { name: "Unlock image" } } }],
    client_reference_id: purchaseId,
    customer_email: user.email,
    metadata,
    payment_intent_data: { metadata },
    success_url: `${chatUrl}?checkout=success&image=${image.id}`,
    cancel_url: `${chatUrl}?checkout=cancelled`,
  });
  await admin.from("purchases").update({ stripe_checkout_session_id: session.id }).eq("id", purchaseId);
  return NextResponse.json({ url: session.url });
}
