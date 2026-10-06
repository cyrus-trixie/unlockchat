import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { SIGNED_URL_SECONDS } from "@/lib/config";

interface ImageRow { id: string; sender_id: string; storage_path: string; preview_path: string; is_locked: boolean }

// Returns a short-lived signed URL: the ORIGINAL only if the caller may see it, otherwise the blurred preview.
export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  // RLS: only the owner or a member of a conversation containing this image can read the row.
  const { data: image } = await supabase.from("images").select("id,sender_id,storage_path,preview_path,is_locked")
    .eq("id", id).maybeSingle<ImageRow>();
  if (!image) return NextResponse.json({ error: "Not found" }, { status: 404 });

  let canView = image.sender_id === user.id || !image.is_locked;
  if (!canView) {
    const { data: purchase } = await supabase.from("purchases").select("id")
      .eq("image_id", id).eq("buyer_id", user.id).eq("status", "completed").maybeSingle();
    canView = !!purchase;
  }

  const { data, error } = await createAdminClient().storage.from("images")
    .createSignedUrl(canView ? image.storage_path : image.preview_path, SIGNED_URL_SECONDS);
  if (error || !data) return NextResponse.json({ error: "Could not sign URL" }, { status: 500 });
  return NextResponse.json({ unlocked: canView, url: data.signedUrl }, { headers: { "Cache-Control": "no-store" } });
}
