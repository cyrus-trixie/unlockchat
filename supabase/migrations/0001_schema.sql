-- UnlockChat schema
create extension if not exists pgcrypto;

create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  username text not null check (username ~ '^[A-Za-z0-9_]{3,20}$'),
  avatar_url text,
  created_at timestamptz not null default now()
);
create unique index profiles_username_lower_idx on public.profiles (lower(username));

create table public.conversations (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.conversation_members (
  conversation_id uuid not null references public.conversations(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  last_read_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  primary key (conversation_id, user_id)
);
create index conversation_members_user_idx on public.conversation_members (user_id);

create table public.images (
  id uuid primary key default gen_random_uuid(),
  sender_id uuid not null references public.profiles(id) on delete cascade,
  storage_path text not null unique,
  preview_path text not null,
  price_cents integer not null default 300 check (price_cents >= 0),
  is_locked boolean not null default false,
  created_at timestamptz not null default now(),
  check (not is_locked or price_cents >= 50) -- Stripe minimum charge is $0.50
);
create index images_sender_idx on public.images (sender_id);

create table public.messages (
  id uuid primary key default gen_random_uuid(),
  conversation_id uuid not null references public.conversations(id) on delete cascade,
  sender_id uuid not null references public.profiles(id) on delete cascade,
  message_type text not null check (message_type in ('text', 'image')),
  text_content text check (char_length(text_content) <= 2000),
  image_id uuid references public.images(id),
  created_at timestamptz not null default now(),
  check (
    (message_type = 'text' and text_content is not null and image_id is null) or
    (message_type = 'image' and image_id is not null and text_content is null)
  )
);
create index messages_conversation_created_idx on public.messages (conversation_id, created_at desc);
create index messages_image_idx on public.messages (image_id);

-- Money: written ONLY by the server (service role / Stripe webhook).
-- amount_cents = platform_fee_cents (platform revenue) + seller_earnings_cents (owed to seller).
create table public.purchases (
  id uuid primary key default gen_random_uuid(),
  buyer_id uuid not null references public.profiles(id),
  seller_id uuid not null references public.profiles(id),
  image_id uuid not null references public.images(id),
  amount_cents integer not null check (amount_cents > 0),
  platform_fee_cents integer not null check (platform_fee_cents >= 0),
  seller_earnings_cents integer not null check (seller_earnings_cents >= 0),
  stripe_checkout_session_id text unique,
  stripe_payment_intent_id text unique,
  status text not null default 'pending' check (status in ('pending', 'completed', 'failed', 'refunded')),
  created_at timestamptz not null default now(),
  completed_at timestamptz,
  unique (buyer_id, image_id),
  check (buyer_id <> seller_id),
  check (amount_cents = platform_fee_cents + seller_earnings_cents)
);
create index purchases_seller_idx on public.purchases (seller_id, status);
create index purchases_buyer_idx on public.purchases (buyer_id);

-- Auto-create profile on signup (username comes from signUp options.data.username)
create function public.handle_new_user() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  insert into public.profiles (id, username) values (new.id, new.raw_user_meta_data ->> 'username');
  return new;
end $$;
create trigger on_auth_user_created after insert on auth.users
  for each row execute function public.handle_new_user();

create function public.touch_conversation() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  update public.conversations set updated_at = now() where id = new.conversation_id;
  return new;
end $$;
create trigger on_message_inserted after insert on public.messages
  for each row execute function public.touch_conversation();

-- Helpers (security definer so RLS policies never recurse)
create function public.username_available(p text) returns boolean
language sql stable security definer set search_path = '' as $$
  select not exists (select 1 from public.profiles where lower(username) = lower(p));
$$;

create function public.is_conversation_member(cid uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (select 1 from public.conversation_members where conversation_id = cid and user_id = auth.uid());
$$;

create function public.owns_image(iid uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (select 1 from public.images where id = iid and sender_id = auth.uid());
$$;

create function public.image_visible_to_me(iid uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from public.messages m
    join public.conversation_members cm on cm.conversation_id = m.conversation_id
    where m.image_id = iid and cm.user_id = auth.uid()
  );
$$;

create function public.start_conversation(other uuid) returns uuid
language plpgsql security definer set search_path = '' as $$
declare me uuid := auth.uid(); cid uuid;
begin
  if me is null then raise exception 'not authenticated'; end if;
  if other = me then raise exception 'cannot chat with yourself'; end if;
  if not exists (select 1 from public.profiles where id = other) then raise exception 'user not found'; end if;
  select a.conversation_id into cid
    from public.conversation_members a
    join public.conversation_members b on a.conversation_id = b.conversation_id
    where a.user_id = me and b.user_id = other limit 1;
  if cid is null then
    insert into public.conversations default values returning id into cid;
    insert into public.conversation_members (conversation_id, user_id) values (cid, me), (cid, other);
  end if;
  return cid;
end $$;

create function public.mark_conversation_read(cid uuid) returns void
language sql security definer set search_path = '' as $$
  update public.conversation_members set last_read_at = now()
  where conversation_id = cid and user_id = auth.uid();
$$;

create function public.list_conversations() returns table (
  conversation_id uuid, other_user_id uuid, other_username text, other_avatar_url text,
  last_message_type text, last_message_text text, last_message_at timestamptz, unread boolean
) language sql stable security definer set search_path = '' as $$
  select c.id, o.user_id, p.username, p.avatar_url, lm.message_type, lm.text_content,
         coalesce(lm.created_at, c.created_at),
         coalesce(lm.sender_id <> auth.uid() and lm.created_at > me.last_read_at, false)
  from public.conversation_members me
  join public.conversations c on c.id = me.conversation_id
  join public.conversation_members o on o.conversation_id = c.id and o.user_id <> me.user_id
  join public.profiles p on p.id = o.user_id
  left join lateral (
    select m.message_type, m.text_content, m.created_at, m.sender_id
    from public.messages m where m.conversation_id = c.id order by m.created_at desc limit 1
  ) lm on true
  where me.user_id = auth.uid()
  order by coalesce(lm.created_at, c.created_at) desc;
$$;

revoke execute on function public.start_conversation, public.mark_conversation_read, public.list_conversations from anon;
