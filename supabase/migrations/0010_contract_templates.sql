-- =======================================================================
-- OFFI · DOCX-шаблоны договоров (загружаемые компанией) + хранилище.
-- Кастомные шаблоны: компания загружает .docx, ИИ автоматически делает
-- из него заполняемый шаблон (находит поля + правила замены), и потом
-- по шаблону можно генерировать конкретные договоры.
-- =======================================================================

create table if not exists public.contract_templates (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete cascade,
  name text not null,
  description text,
  source_filename text,
  storage_path text not null,                -- путь в bucket "contract-templates"
  fields jsonb not null default '[]'::jsonb,
  replacements jsonb not null default '[]'::jsonb,
  computed_fields jsonb default '[]'::jsonb,
  warnings jsonb default '[]'::jsonb,
  created_by uuid references public.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists contract_templates_company_idx
  on public.contract_templates(company_id, created_at desc);

create table if not exists public.generated_contracts (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete cascade,
  template_id uuid references public.contract_templates(id) on delete set null,
  client_id uuid references public.clients(id) on delete set null,
  data jsonb not null default '{}'::jsonb,
  storage_path text,
  warnings jsonb default '[]'::jsonb,
  created_by uuid references public.users(id) on delete set null,
  created_at timestamptz not null default now()
);
create index if not exists generated_contracts_company_idx
  on public.generated_contracts(company_id, created_at desc);

-- Дефолт company_id = current_company_id() как у других таблиц
alter table public.contract_templates
  alter column company_id set default public.current_company_id();
alter table public.generated_contracts
  alter column company_id set default public.current_company_id();

-- RLS — изоляция по company_id
alter table public.contract_templates enable row level security;
alter table public.generated_contracts enable row level security;

drop policy if exists contract_templates_rw on public.contract_templates;
create policy contract_templates_rw on public.contract_templates for all
  using (company_id = public.current_company_id())
  with check (company_id = public.current_company_id());

drop policy if exists generated_contracts_rw on public.generated_contracts;
create policy generated_contracts_rw on public.generated_contracts for all
  using (company_id = public.current_company_id())
  with check (company_id = public.current_company_id());

-- =======================================================================
-- Storage bucket "contract-templates" (private). Создаётся вручную
-- через Dashboard или supabase CLI. RLS-политики ниже.
-- Структура: <company_id>/<template_id>.docx
-- =======================================================================

drop policy if exists "contract_templates_select" on storage.objects;
drop policy if exists "contract_templates_insert" on storage.objects;
drop policy if exists "contract_templates_update" on storage.objects;
drop policy if exists "contract_templates_delete" on storage.objects;

create policy "contract_templates_select" on storage.objects for select
  to authenticated
  using (
    bucket_id = 'contract-templates'
    and (storage.foldername(name))[1] = public.current_company_id()::text
  );

create policy "contract_templates_insert" on storage.objects for insert
  to authenticated
  with check (
    bucket_id = 'contract-templates'
    and (storage.foldername(name))[1] = public.current_company_id()::text
  );

create policy "contract_templates_update" on storage.objects for update
  to authenticated
  using (
    bucket_id = 'contract-templates'
    and (storage.foldername(name))[1] = public.current_company_id()::text
  )
  with check (
    bucket_id = 'contract-templates'
    and (storage.foldername(name))[1] = public.current_company_id()::text
  );

create policy "contract_templates_delete" on storage.objects for delete
  to authenticated
  using (
    bucket_id = 'contract-templates'
    and (storage.foldername(name))[1] = public.current_company_id()::text
  );
