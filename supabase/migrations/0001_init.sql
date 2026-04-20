-- =======================================================================
-- OFFI · initial schema
-- Запусти весь файл в Supabase SQL Editor (один раз).
-- Или положи в миграцию и применяй через supabase CLI.
-- =======================================================================

create extension if not exists vector;
create extension if not exists pgcrypto;

-- -----------------------------------------------------------------------
-- companies + users
-- -----------------------------------------------------------------------
create table if not exists public.companies (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  assistant_name text not null default 'Оффи',
  brand_accent text default '#1a6eff',
  plan text not null default 'trial',      -- trial | start | business | team
  created_at timestamptz not null default now()
);

-- профиль пользователя привязан к auth.users
create table if not exists public.users (
  id uuid primary key references auth.users(id) on delete cascade,
  company_id uuid references public.companies(id) on delete set null,
  email text not null,
  full_name text,
  role text not null default 'owner',       -- owner | admin | member
  created_at timestamptz not null default now()
);

-- автосоздание профиля при регистрации
create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into public.users (id, email, full_name)
  values (new.id, new.email, coalesce(new.raw_user_meta_data->>'full_name', split_part(new.email,'@',1)));
  return new;
end $$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
after insert on auth.users
for each row execute function public.handle_new_user();

-- -----------------------------------------------------------------------
-- knowledge base
-- -----------------------------------------------------------------------
create table if not exists public.documents (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete cascade,
  name text not null,
  source_type text not null default 'file',  -- file | url | manual | ai
  source_url text,
  file_url text,
  size_bytes bigint,
  chunks_count int default 0,
  status text default 'ready',               -- processing | ready | error
  created_at timestamptz not null default now()
);

create table if not exists public.chunks (
  id uuid primary key default gen_random_uuid(),
  document_id uuid not null references public.documents(id) on delete cascade,
  company_id uuid not null references public.companies(id) on delete cascade,
  content text not null,
  embedding vector(1536),
  token_count int,
  idx int,
  created_at timestamptz not null default now()
);

create index if not exists chunks_embedding_idx on public.chunks
  using ivfflat (embedding vector_cosine_ops) with (lists = 100);
create index if not exists chunks_company_idx on public.chunks (company_id);

-- RPC для поиска релевантных чанков
create or replace function public.match_chunks(
  query_embedding vector(1536),
  p_company_id uuid,
  match_count int default 5
) returns table (id uuid, document_id uuid, content text, similarity float)
language sql stable as $$
  select c.id, c.document_id, c.content,
         1 - (c.embedding <=> query_embedding) as similarity
  from public.chunks c
  where c.company_id = p_company_id
  order by c.embedding <=> query_embedding
  limit match_count
$$;

-- -----------------------------------------------------------------------
-- clients
-- -----------------------------------------------------------------------
create table if not exists public.clients (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete cascade,
  name text not null,
  contact text,
  phone text,
  email text,
  data jsonb default '{}'::jsonb,
  created_at timestamptz not null default now()
);
create index if not exists clients_company_idx on public.clients (company_id);

-- -----------------------------------------------------------------------
-- channels + messages (командный + AI-чат)
-- -----------------------------------------------------------------------
create table if not exists public.channels (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete cascade,
  name text not null,
  type text not null default 'ai',     -- ai | dm | group | shared_ai | project
  created_by uuid references public.users(id) on delete set null,
  created_at timestamptz not null default now()
);

create table if not exists public.channel_members (
  channel_id uuid references public.channels(id) on delete cascade,
  user_id uuid references public.users(id) on delete cascade,
  role text default 'member',
  primary key (channel_id, user_id)
);

create table if not exists public.messages (
  id uuid primary key default gen_random_uuid(),
  channel_id uuid not null references public.channels(id) on delete cascade,
  user_id uuid references public.users(id) on delete set null,
  content text not null,
  is_ai boolean not null default false,
  pinned boolean not null default false,
  sources jsonb,                         -- RAG-источники, если есть
  created_at timestamptz not null default now()
);
create index if not exists messages_channel_idx on public.messages (channel_id, created_at desc);

-- -----------------------------------------------------------------------
-- templates + generated_docs
-- -----------------------------------------------------------------------
create table if not exists public.templates (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete cascade,
  name text not null,
  body text not null,                   -- шаблон в plain-text/markdown c {{переменными}}
  variables jsonb default '[]'::jsonb,
  created_at timestamptz not null default now()
);

create table if not exists public.generated_docs (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete cascade,
  client_id uuid references public.clients(id) on delete set null,
  template_id uuid references public.templates(id) on delete set null,
  content text not null,
  created_at timestamptz not null default now()
);

-- -----------------------------------------------------------------------
-- integrations + action_log
-- -----------------------------------------------------------------------
create table if not exists public.integrations (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete cascade,
  type text not null,                   -- email | telegram | amocrm | bitrix24 | google_calendar
  config jsonb default '{}'::jsonb,
  enabled boolean not null default false,
  created_at timestamptz not null default now()
);

create table if not exists public.action_log (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete cascade,
  user_id uuid references public.users(id) on delete set null,
  action text not null,
  params jsonb,
  status text not null default 'pending',   -- pending | success | error | cancelled
  result jsonb,
  created_at timestamptz not null default now()
);

-- =======================================================================
-- Row Level Security — изоляция по company_id
-- =======================================================================
alter table public.companies enable row level security;
alter table public.users enable row level security;
alter table public.documents enable row level security;
alter table public.chunks enable row level security;
alter table public.clients enable row level security;
alter table public.channels enable row level security;
alter table public.channel_members enable row level security;
alter table public.messages enable row level security;
alter table public.templates enable row level security;
alter table public.generated_docs enable row level security;
alter table public.integrations enable row level security;
alter table public.action_log enable row level security;

-- helper: текущая company_id пользователя
create or replace function public.current_company_id() returns uuid
language sql stable security definer set search_path = public as $$
  select company_id from public.users where id = auth.uid();
$$;

-- USERS: видят только себя и коллег из той же компании
drop policy if exists users_select on public.users;
create policy users_select on public.users for select
  using (id = auth.uid() or company_id = public.current_company_id());

drop policy if exists users_update_self on public.users;
create policy users_update_self on public.users for update using (id = auth.uid());

-- COMPANIES: видят только свою
drop policy if exists companies_select on public.companies;
create policy companies_select on public.companies for select
  using (id = public.current_company_id());
drop policy if exists companies_update on public.companies;
create policy companies_update on public.companies for update
  using (id = public.current_company_id());
drop policy if exists companies_insert on public.companies;
create policy companies_insert on public.companies for insert with check (true);

-- generic company-isolation policy для всех таблиц с прямой колонкой company_id
do $$
declare t text;
begin
  foreach t in array array[
    'documents','chunks','clients','channels',
    'templates','generated_docs','integrations','action_log'
  ] loop
    execute format('drop policy if exists %I_rw on public.%I', t, t);
    execute format(
      'create policy %I_rw on public.%I for all using (company_id = public.current_company_id()) with check (company_id = public.current_company_id())',
      t, t
    );
  end loop;
end $$;

-- messages и channel_members — через связку с channel.company_id
drop policy if exists messages_rw on public.messages;
create policy messages_rw on public.messages for all
  using (exists(select 1 from public.channels c where c.id = channel_id and c.company_id = public.current_company_id()))
  with check (exists(select 1 from public.channels c where c.id = channel_id and c.company_id = public.current_company_id()));

drop policy if exists channel_members_rw on public.channel_members;
create policy channel_members_rw on public.channel_members for all
  using (exists(select 1 from public.channels c where c.id = channel_id and c.company_id = public.current_company_id()))
  with check (exists(select 1 from public.channels c where c.id = channel_id and c.company_id = public.current_company_id()));

-- =======================================================================
-- Storage bucket для документов базы знаний и шаблонов
-- Создай руками в Dashboard → Storage:
--   - bucket "documents" (private)
--   - bucket "templates" (private)
--   - bucket "avatars"   (public)
-- =======================================================================
