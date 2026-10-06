-- Row Level Security
alter table public.profiles enable row level security;
alter table public.conversations enable row level security;
alter table public.conversation_members enable row level security;
alter table public.messages enable row level security;
alter table public.images enable row level security;
alter table public.purchases enable row level security;

-- Profiles: readable by signed-in users (needed for username search / chat headers); only you can update yours.
create policy profiles_select on public.profiles for select to authenticated using (true);
create policy profiles_update_own on public.profiles for update to authenticated
  using (id = auth.uid()) with check (id = auth.uid());

-- Conversations & members: read-only for members. Creation goes through start_conversation().
create policy conversations_select on public.conversations for select to authenticated
  using (public.is_conversation_member(id));
create policy members_select on public.conversation_members for select to authenticated
  using (public.is_conversation_member(conversation_id));

-- Messages
create policy messages_select on public.messages for select to authenticated
  using (public.is_conversation_member(conversation_id));
create policy messages_insert on public.messages for insert to authenticated
  with check (
    sender_id = auth.uid()
    and public.is_conversation_member(conversation_id)
    and (message_type = 'text' or public.owns_image(image_id))
  );

-- Images: create for yourself; readable by owner or members of a conversation where it was sent. No update/delete.
create policy images_select on public.images for select to authenticated
  using (sender_id = auth.uid() or public.image_visible_to_me(id));
create policy images_insert on public.images for insert to authenticated
  with check (sender_id = auth.uid());

-- Purchases: buyers and sellers can read their own rows. NO client writes (webhook/service role only).
create policy purchases_select on public.purchases for select to authenticated
  using (buyer_id = auth.uid() or seller_id = auth.uid());

-- Realtime
alter publication supabase_realtime add table public.messages;

-- Storage
-- 'images' is PRIVATE and has NO storage policies: clients cannot read/list/write it.
-- Only the server (service role) touches it and hands out 60s signed URLs after permission checks.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('images', 'images', false, 10485760, array['image/jpeg', 'image/png', 'image/webp'])
on conflict (id) do nothing;

-- Avatars are public (profile pictures only)
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('avatars', 'avatars', true, 2097152, array['image/jpeg', 'image/png', 'image/webp'])
on conflict (id) do nothing;

create policy avatars_read on storage.objects for select using (bucket_id = 'avatars');
create policy avatars_insert_own on storage.objects for insert to authenticated
  with check (bucket_id = 'avatars' and (storage.foldername(name))[1] = auth.uid()::text);
create policy avatars_update_own on storage.objects for update to authenticated
  using (bucket_id = 'avatars' and (storage.foldername(name))[1] = auth.uid()::text);
create policy avatars_delete_own on storage.objects for delete to authenticated
  using (bucket_id = 'avatars' and (storage.foldername(name))[1] = auth.uid()::text);
