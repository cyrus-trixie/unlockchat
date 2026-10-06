import { NextResponse, type NextRequest } from "next/server";
import sharp from "sharp";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { ALLOWED_TYPES, LOCKED_PRICE_CENTS, MAX_IMAGE_BYTES } from "@/lib/config";
import type { MessageWithImage } from "@/types";

export const runtime = "nodejs";

const EXT: Record<string, string> = { jpeg: "jpg", png: "png", webp: "webp" };
const err = (error: string, status: number) => NextResponse.json({ error }, { status });

// Locked preview: shrink to a tiny thumbnail, then upscale + blur. The real pixels never leave the server.
async function lockedPreview(buf: Buffer): Promise<Buffer> {
  const tiny = await sharp(buf).rotate().resize({ width: 24, height: 24, fit: "inside" }).jpeg({ quality: 50 }).toBuffer();
  return sharp(tiny).resize({ width: 360 }).blur(6).jpeg({ quality: 50 }).toBuffer();
}

export async function POST(req: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return err("Unauthorized", 401);

  const form = await req.formData();
  const file = form.get("file");
  const conversationId = form.get("conversationId");
  const locked = form.get("locked") === "true";
  if (!(file instanceof File) || typeof conversationId !== "string") return err("Bad request", 400);
  if (file.size > MAX_IMAGE_BYTES) return err("Image must be 10MB or smaller.", 413);
  if (!ALLOWED_TYPES.includes(file.type)) return err("Only JPG, PNG or WEBP images are allowed.", 415);

  const { data: member } = await supabase.from("conversation_members").select("user_id")
    .eq("conversation_id", conversationId).eq("user_id", user.id).maybeSingle();
  if (!member) return err("Forbidden", 403);

  const buf = Buffer.from(await file.arrayBuffer());
  let ext: string | undefined;
  try {
    ext = EXT[(await sharp(buf).metadata()).format ?? ""]; // verifies real image content, not just the MIME header
  } catch {
    return err("That file isn't a valid image.", 415);
  }
  if (!ext) return err("Only JPG, PNG or WEBP images are allowed.", 415);

  const previewBuf = locked
    ? await lockedPreview(buf)
    : await sharp(buf).rotate().resize({ width: 480, withoutEnlargement: true }).jpeg({ quality: 70 }).toBuffer();

  const imageId = crypto.randomUUID();
  const storagePath = `${user.id}/${imageId}/original.${ext}`;
  const previewPath = `${user.id}/${imageId}/preview.jpg`;
  const admin = createAdminClient();
  const bucket = admin.storage.from("images");

  const up1 = await bucket.upload(storagePath, buf, { contentType: file.type });
  const up2 = await bucket.upload(previewPath, previewBuf, { contentType: "image/jpeg" });
  const cleanup = () => bucket.remove([storagePath, previewPath]);
  if (up1.error || up2.error) { await cleanup(); return err("Upload failed.", 500); }

  const { error: imgErr } = await supabase.from("images").insert({
    id: imageId, sender_id: user.id, storage_path: storagePath, preview_path: previewPath,
    is_locked: locked, price_cents: LOCKED_PRICE_CENTS,
  });
  if (imgErr) { await cleanup(); return err("Could not save image.", 500); }

  const { data: message, error: msgErr } = await supabase.from("messages").insert({
    conversation_id: conversationId, sender_id: user.id, message_type: "image", image_id: imageId,
  }).select("*, images(id,sender_id,price_cents,is_locked)").single<MessageWithImage>();
  if (msgErr) { await cleanup(); return err("Could not send message.", 500); }

  return NextResponse.json({ message });
}
