-- =======================================================================
-- OFFI · AI Memory
-- Отдельные факты, извлечённые из чатов/документов/вручную.
-- Ищется параллельно с chunks и мёржится в контекст.
-- =======================================================================

create table if not exists public.memories (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete cascade,
  content text not null,
  kind text not null default 'fact',          -- fact | preference | agreement | rule
  source text not null default 'manual',      -- chat | document | manual
  source_id uuid,                             -- ссылка на messages.id / documents.id (soft)
  created_by uuid references public.users(id) on delete set null,
  embedding vector(1536),
  created_at timestamptz not null default now()
);

create index if not exists memories_embedding_idx on public.memories
  using ivfflat (embedding vector_cosine_ops) with (lists = 100);
create index if not exists memories_company_idx on public.memories (company_id, created_at desc);

-- RLS + дефолт company_id
alter table public.memories enable row level security;

drop policy if exists memories_rw on public.memories;
create policy memories_rw on public.memories for all
  using (company_id = public.current_company_id())
  with check (company_id = public.current_company_id());

alter table public.memories alter column company_id set default public.current_company_id();

-- RPC для vector-поиска
create or replace function public.match_memories(
  query_embedding vector(1536),
  p_company_id uuid,
  match_count int default 5
) returns table (id uuid, content text, kind text, source text, source_id uuid, similarity float)
language sql stable as $$
  select m.id, m.content, m.kind, m.source, m.source_id,
         1 - (m.embedding <=> query_embedding) as similarity
  from public.memories m
  where m.company_id = p_company_id
  order by m.embedding <=> query_embedding
  limit match_count
$$;
