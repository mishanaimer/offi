-- =======================================================================
-- OFFI · Departments + employee profile fields
-- =======================================================================

create table if not exists public.departments (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete cascade,
  name text not null,
  color text default '#1a6eff',
  created_at timestamptz not null default now()
);

create index if not exists departments_company_idx on public.departments (company_id);

alter table public.departments enable row level security;

drop policy if exists departments_rw on public.departments;
create policy departments_rw on public.departments for all
  using (company_id = public.current_company_id())
  with check (company_id = public.current_company_id());

alter table public.departments alter column company_id set default public.current_company_id();

-- Дополняем users: отдел, позиция, био
alter table public.users
  add column if not exists department_id uuid references public.departments(id) on delete set null,
  add column if not exists position text,
  add column if not exists bio text;

-- Обновление своего профиля — разрешено каждому; смена роли/отдела другого — только admin/owner
drop policy if exists users_update_self on public.users;
create policy users_update_self on public.users for update
  using (
    id = auth.uid()
    or exists(
      select 1 from public.users u2
      where u2.id = auth.uid()
        and u2.company_id = public.users.company_id
        and u2.role in ('owner','admin')
    )
  );
