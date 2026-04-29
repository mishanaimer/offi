-- =======================================================================
-- OFFI · Template assets
-- Картинки в текстовых шаблонах + автоматический updated_at у templates.
-- =======================================================================

alter table public.templates
  add column if not exists updated_at timestamptz not null default now();

drop trigger if exists templates_touch_updated on public.templates;
create trigger templates_touch_updated before update on public.templates
  for each row execute function public.touch_updated_at();

-- Public bucket — картинки идут в письма наружу клиентам и должны быть
-- доступны без авторизации (Postmark/Outlook/Gmail без сессии).
insert into storage.buckets (id, name, public)
values ('template-images', 'template-images', true)
on conflict (id) do update set public = true;

-- Read — открыто всем (публичный bucket). Write — только своя компания.
drop policy if exists "template_images_insert" on storage.objects;
drop policy if exists "template_images_update" on storage.objects;
drop policy if exists "template_images_delete" on storage.objects;

create policy "template_images_insert" on storage.objects for insert
  to authenticated
  with check (
    bucket_id = 'template-images'
    and (storage.foldername(name))[1] = public.current_company_id()::text
  );

create policy "template_images_update" on storage.objects for update
  to authenticated
  using (
    bucket_id = 'template-images'
    and (storage.foldername(name))[1] = public.current_company_id()::text
  )
  with check (
    bucket_id = 'template-images'
    and (storage.foldername(name))[1] = public.current_company_id()::text
  );

create policy "template_images_delete" on storage.objects for delete
  to authenticated
  using (
    bucket_id = 'template-images'
    and (storage.foldername(name))[1] = public.current_company_id()::text
  );
