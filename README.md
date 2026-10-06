# UnlockChat MVP

Chat privately. Share images. Unlock the ones worth seeing.

## 1. Database schema

- **profiles** (1:1 with `auth.users`, created by trigger on signup): id, username (unique, case-insensitive), avatar_url, created_at.
- **conversations** + **conversation_members**: a 1:1 chat is a conversation with exactly two member rows. Created only through the `start_conversation()` function (returns the existing chat if one already exists).
- **messages**: conversation_id, sender_id, `message_type` (`text` | `image`), text_content, image_id. A CHECK constraint ties type to content.
- **images**: sender_id, `storage_path` (original), `preview_path` (blurred), price_cents (300), is_locked. Immutable after insert (no update policy), so nobody can flip a lock later.
- **purchases**: buyer_id, seller_id, image_id, `amount_cents = platform_fee_cents + seller_earnings_cents`, Stripe session/payment-intent ids, status (`pending|completed|failed|refunded`). One row per (buyer, image). Clients can only SELECT their own rows. All writes come from the server/webhook. Platform revenue and seller earnings are separate columns, so Stripe Connect payouts can be added later without a migration.

Relations: profile → many members → conversation → many messages → (optional) image → many purchases.

## 2. File structure

```
app/
  page.tsx, login/, signup/, auth/callback/
  (app)/layout.tsx           sidebar + auth gate
  (app)/chats/               list, new/, [conversationId]/
  (app)/profile/, (app)/earnings/
  api/images/upload/         validate, make blurred preview, store privately
  api/images/[id]/url/       permission check -> 60s signed URL
  api/stripe/create-checkout/, api/stripe/webhook/
components/ auth/ chat/ images/ profile/ ui/
lib/ supabase/{client,server,admin,middleware}.ts  stripe/server.ts  config.ts  format.ts
types/index.ts
supabase/migrations/0001_schema.sql, 0002_rls_storage.sql
middleware.ts
```

## 3. Environment variables

Copy `.env.example` to `.env.local` and fill in:
`NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`, `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`, `NEXT_PUBLIC_APP_URL`.

## 4. Supabase setup

1. Create a project at supabase.com.
2. SQL Editor: run `supabase/migrations/0001_schema.sql`, then `0002_rls_storage.sql` (or use `supabase db push` with the CLI).
3. Project Settings -> API: copy the URL, anon key and service_role key into `.env.local`.
4. Authentication -> Providers -> Email. For quick local testing, turn off "Confirm email". If you keep it on, add `http://localhost:3000/auth/callback` under Auth -> URL Configuration -> Redirect URLs.
5. Check Storage: private `images` bucket and public `avatars` bucket exist. Check Database -> Replication: `messages` is in `supabase_realtime`.

## 5. Stripe setup

1. Use test mode. Copy the secret key (`sk_test_...`) into `STRIPE_SECRET_KEY`.
2. Local webhook forwarding: `stripe listen --forward-to localhost:3000/api/stripe/webhook`. Copy the printed `whsec_...` into `STRIPE_WEBHOOK_SECRET`.
3. Production: Developers -> Webhooks -> add `https://YOUR_DOMAIN/api/stripe/webhook` with events `checkout.session.completed`, `checkout.session.expired`, `charge.refunded` (optionally `checkout.session.async_payment_succeeded`).
4. Test card: `4242 4242 4242 4242`, any future date, any CVC.

## 6. Run locally

```
npm install
cp .env.example .env.local   # fill it in
npm run dev                  # http://localhost:3000
```
Test the full journey with two browsers (one normal, one incognito): sign up as A and B, A starts a chat with B, sends a locked image, B pays, then A checks `/earnings`.

## 7. Security notes

- **Originals are never public.** The `images` bucket is private and has *no* storage policies, so clients can't read, list or guess paths. The server hands out 60-second signed URLs only after checking: owner, or free image, or completed purchase (and RLS membership).
- **Locked previews are really blurred server-side** (shrunk to 24px, upscaled, blurred). The real pixels are never sent, so CSS/devtools tricks reveal nothing.
- **Purchases are completed only by the signature-verified webhook**, which also checks the session id and amount against the DB row. The success redirect never grants access. Price is read from the DB, never from the client.
- Clients have no write access to `purchases`; `images` rows can't be edited after creation.
- `SUPABASE_SERVICE_ROLE_KEY` / Stripe secrets are used only in server code (`lib/supabase/admin.ts` imports `server-only`).
- Middleware redirects unauthenticated users, but every API route and page also re-checks `auth.getUser()` (validated JWT) and RLS enforces it at the DB.
- Deviation from the brief: profiles are readable by all signed-in users (needed for username search and chat headers). Only you can update yours.
- Buyers can technically read `storage_path` from the `images` row. It's useless without storage access, but hide it behind a view later if you want.
- Known MVP gaps: no rate limiting, no image moderation/reporting, no payouts (Stripe Connect), 20% platform fee is a placeholder in `lib/config.ts`. Upload goes through a route handler, so hosts with small body limits (e.g. Vercel ~4.5MB) need a lower max size or direct-to-storage uploads.
