-- =======================================================================
-- OFFI · Clients 360
-- Расширяем карточку клиента: реквизиты, статус, владелец, теги.
-- Добавляем заметки и файлы клиента + связь договоров и памяти с клиентом.
-- =======================================================================

-- ---- 1. Расширение clients ------------------------------------------------
alter table public.clients
  add column if not exists client_type text not null default 'legal',  -- legal | individual
  add column if not exists short_name text,                            -- «ООО Ромашка»
  add column if not exists legal_name text,                            -- полное юридическое
  add column if not exists inn text,
  add column if not exists kpp text,
  add column if not exists ogrn text,
  add column if not exists bank_name text,
  add column if not exists bank_account text,
  add column if not exists corr_account text,
  add column if not exists bik text,
  add column if not exists legal_address text,
  add column if not exists actual_address text,
  add column if not exists website text,
  add column if not exists telegram text,
  add column if not exists industry text,
  add column if not exists signatory_name text,    -- «Иванов Иван Иванович»
  add column if not exists signatory_title text,   -- «Генеральный директор»
  add column if not exists signatory_basis text,   -- «на основании Устава»
  add column if not exists status text not null default 'lead',        -- lead | active | partner | archived
  add column if not exists tags text[] not null default '{}',
  add column if not exists summary text,           -- краткая выжимка (генерится ИИ)
  add column if not exists owner_id uuid references public.users(id) on delete set null,
  add column if not exists last_contact_at timestamptz,
  add column if not exists created_by uuid references public.users(id) on delete set null,
  add column if not exists updated_at timestamptz not null default now();

create index if not exists clients_status_idx on public.clients(company_id, status);
create index if not exists clients_inn_idx on public.clients(inn) where inn is not null;
create index if not exists clients_owner_idx on public.clients(owner_id) where owner_id is not null;

-- updated_at автообновление
create or replace function public.touch_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end $$;

drop trigger if exists clients_touch_updated on public.clients;
create trigger clients_touch_updated before update on public.clients
  for each row execute function public.touch_updated_at();

-- ---- 2. Заметки по клиенту ------------------------------------------------
create table if not exists public.client_notes (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete cascade,
  client_id uuid not null references public.clients(id) on delete cascade,
  user_id uuid references public.users(id) on delete set null,
  content text not null,
  source text not null default 'manual',          -- manual | chat | call | email | meeting
  created_at timestamptz not null default now()
);
create index if not exists client_notes_client_idx
  on public.client_notes(client_id, created_at desc);

alter table public.client_notes enable row level security;
alter table public.client_notes alter column company_id set default public.current_company_id();
drop policy if exists client_notes_rw on public.client_notes;
create policy client_notes_rw on public.client_notes for all
  using (company_id = public.current_company_id())
  with check (company_id = public.current_company_id());

-- ---- 3. Файлы клиента ----------------------------------------------------
create table if not exists public.client_files (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete cascade,
  client_id uuid not null references public.clients(id) on delete cascade,
  uploaded_by uuid references public.users(id) on delete set null,
  name text not null,
  size_bytes bigint,
  mime text,
  storage_path text not null,                     -- bucket "client-files"
  kind text default 'other',                      -- card | contract | invoice | other
  created_at timestamptz not null default now()
);
create index if not exists client_files_client_idx
  on public.client_files(client_id, created_at desc);

alter table public.client_files enable row level security;
alter table public.client_files alter column company_id set default public.current_company_id();
drop policy if exists client_files_rw on public.client_files;
create policy client_files_rw on public.client_files for all
  using (company_id = public.current_company_id())
  with check (company_id = public.current_company_id());

insert into storage.buckets (id, name, public)
values ('client-files', 'client-files', false)
on conflict (id) do nothing;

drop policy if exists "client_files_select" on storage.objects;
drop policy if exists "client_files_insert" on storage.objects;
drop policy if exists "client_files_update" on storage.objects;
drop policy if exists "client_files_delete" on storage.objects;

create policy "client_files_select" on storage.objects for select
  to authenticated
  using (
    bucket_id = 'client-files'
    and (storage.foldername(name))[1] = public.current_company_id()::text
  );

create policy "client_files_insert" on storage.objects for insert
  to authenticated
  with check (
    bucket_id = 'client-files'
    and (storage.foldername(name))[1] = public.current_company_id()::text
  );

create policy "client_files_update" on storage.objects for update
  to authenticated
  using (
    bucket_id = 'client-files'
    and (storage.foldername(name))[1] = public.current_company_id()::text
  )
  with check (
    bucket_id = 'client-files'
    and (storage.foldername(name))[1] = public.current_company_id()::text
  );

create policy "client_files_delete" on storage.objects for delete
  to authenticated
  using (
    bucket_id = 'client-files'
    and (storage.foldername(name))[1] = public.current_company_id()::text
  );

-- ---- 4. Привязки в существующих таблицах ---------------------------------
-- Память может относиться к клиенту: тогда AI вытаскивает её при разговоре про этого клиента.
alter table public.memories
  add column if not exists client_id uuid references public.clients(id) on delete cascade;
create index if not exists memories_client_idx on public.memories(client_id) where client_id is not null;

-- Сгенерированные договоры — сохраняем понятное имя и путь в Storage.
alter table public.generated_contracts
  add column if not exists name text,
  add column if not exists download_url text;
create index if not exists generated_contracts_client_idx
  on public.generated_contracts(client_id, created_at desc) where client_id is not null;

-- ---- 5. Текстовый поиск по клиентам -------------------------------------
-- Для tool find_client / search_contracts.
create or replace function public.search_clients(
  p_company_id uuid,
  p_query text,
  p_limit int default 8
) returns table (
  id uuid, name text, short_name text, contact text, email text,
  phone text, inn text, status text, summary text
)
language sql stable as $$
  select c.id, c.name, c.short_name, c.contact, c.email, c.phone, c.inn, c.status, c.summary
  from public.clients c
  where c.company_id = p_company_id
    and (
      p_query is null or p_query = '' or
      c.name ilike '%' || p_query || '%' or
      coalesce(c.short_name, '') ilike '%' || p_query || '%' or
      coalesce(c.legal_name, '') ilike '%' || p_query || '%' or
      coalesce(c.contact, '') ilike '%' || p_query || '%' or
      coalesce(c.email, '') ilike '%' || p_query || '%' or
      coalesce(c.phone, '') ilike '%' || p_query || '%' or
      coalesce(c.inn, '') ilike '%' || p_query || '%' or
      coalesce(c.signatory_name, '') ilike '%' || p_query || '%'
    )
  order by c.last_contact_at desc nulls last, c.created_at desc
  limit p_limit
$$;

-- ---- 6. Принудительный апгрейд платформенных аккаунтов ------------------
-- gign230102@gmail.com и ngig45@yandex.ru — на максимальный тариф «team».
update public.companies
   set plan = 'team'
 where id in (
   select u.company_id
     from public.users u
    where lower(u.email) in ('gign230102@gmail.com', 'ngig45@yandex.ru')
      and u.company_id is not null
 );
