-- =======================================================================
-- OFFI · Storage RLS политики
-- avatars — public bucket для логотипов компаний и аватарок пользователей.
-- Читать можно всем (bucket.public=true даёт публичные URL),
-- записывать/обновлять/удалять — только авторизованным.
-- =======================================================================

drop policy if exists "avatars_public_read"             on storage.objects;
drop policy if exists "avatars_authenticated_insert"    on storage.objects;
drop policy if exists "avatars_authenticated_update"    on storage.objects;
drop policy if exists "avatars_authenticated_delete"    on storage.objects;

create policy "avatars_public_read" on storage.objects for select
  using (bucket_id = 'avatars');

create policy "avatars_authenticated_insert" on storage.objects for insert
  to authenticated
  with check (bucket_id = 'avatars');

create policy "avatars_authenticated_update" on storage.objects for update
  to authenticated
  using (bucket_id = 'avatars')
  with check (bucket_id = 'avatars');

create policy "avatars_authenticated_delete" on storage.objects for delete
  to authenticated
  using (bucket_id = 'avatars');
