-- =======================================================================
-- OFFI · bug reports (обращения об ошибках от пользователей)
-- =======================================================================

create table if not exists public.bug_reports (
  id uuid primary key default gen_random_uuid(),
  company_id uuid references public.companies(id) on delete set null,
  user_id uuid references public.users(id) on delete set null,
  email text,
  page_url text,
  subject text,
  message text not null,
  severity text not null default 'normal',  -- low | normal | high | critical
  status text not null default 'new',       -- new | in_progress | resolved | dismissed
  details jsonb default '{}'::jsonb,        -- user_agent, screen, console errors, etc
  admin_notes text,
  created_at timestamptz not null default now(),
  resolved_at timestamptz
);

create index if not exists bug_reports_created_idx on public.bug_reports (created_at desc);
create index if not exists bug_reports_status_idx on public.bug_reports (status);
create index if not exists bug_reports_company_idx on public.bug_reports (company_id);

alter table public.bug_reports enable row level security;

-- Пользователь может читать ТОЛЬКО свои обращения и создавать новые.
-- Админы (service-role) читают всё без RLS.
drop policy if exists bug_reports_insert on public.bug_reports;
create policy bug_reports_insert on public.bug_reports for insert
  with check (user_id = auth.uid() or user_id is null);

drop policy if exists bug_reports_select_own on public.bug_reports;
create policy bug_reports_select_own on public.bug_reports for select
  using (user_id = auth.uid());
