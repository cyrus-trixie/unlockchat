export interface Profile { id: string; username: string; avatar_url: string | null; created_at: string }
export interface ImageMeta { id: string; sender_id: string; price_cents: number; is_locked: boolean }
export interface MessageWithImage {
  id: string; conversation_id: string; sender_id: string; message_type: "text" | "image";
  text_content: string | null; image_id: string | null; created_at: string; images: ImageMeta | null;
}
export interface ConversationSummary {
  conversation_id: string; other_user_id: string; other_username: string; other_avatar_url: string | null;
  last_message_type: "text" | "image" | null; last_message_text: string | null; last_message_at: string; unread: boolean;
}
export interface PurchaseRow {
  id: string; amount_cents: number; platform_fee_cents: number; seller_earnings_cents: number; created_at: string;
}
