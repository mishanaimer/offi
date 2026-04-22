-- =======================================================================
-- OFFI · Plans, upgrade requests, monthly usage counters
-- =======================================================================

-- Заявки на смену тарифа (биллинг вручную на пилоте)
create table if not exists public.plan_requests (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete cascade,
  user_id uuid references public.users(id) on delete set null,
  plan text not null,                                   -- start | business | team
  billing_period text not null default 'month',         -- month | year
  status text not null default 'pending',               -- pending | contacted | activated | cancelled
  note text,
  created_at timestamptz not null default now()
);

alter table public.plan_requests enable row level security;

drop policy if exists plan_requests_rw on public.plan_requests;
create policy plan_requests_rw on public.plan_requests for all
  using (company_id = public.current_company_id())
  with check (company_id = public.current_company_id());

alter table public.plan_requests alter column company_id set default public.current_company_id();

-- Месячные счётчики — инкрементируются на каждом запросе / экшене
create table if not exists public.usage_counters (
  company_id uuid not null references public.companies(id) on delete cascade,
  period text not null,                     -- формат 'YYYY-MM'
  requests_count int not null default 0,
  actions_count int not null default 0,
  updated_at timestamptz not null default now(),
  primary key (company_id, period)
);

alter table public.usage_counters enable row level security;

drop policy if exists usage_counters_rw on public.usage_counters;
create policy usage_counters_rw on public.usage_counters for all
  using (company_id = public.current_company_id())
  with check (company_id = public.current_company_id());

-- Atomic инкремент
create or replace function public.increment_usage(
  p_company_id uuid,
  p_period text,
  p_requests int default 0,
  p_actions int default 0
) returns void
language sql security definer set search_path = public as $$
  insert into public.usage_counters (company_id, period, requests_count, actions_count, updated_at)
  values (p_company_id, p_period, p_requests, p_actions, now())
  on conflict (company_id, period) do update
    set requests_count = public.usage_counters.requests_count + excluded.requests_count,
        actions_count  = public.usage_counters.actions_count  + excluded.actions_count,
        updated_at     = now();
$$;
