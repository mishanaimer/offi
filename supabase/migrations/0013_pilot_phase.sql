-- =======================================================================
-- OFFI · Pre-launch phase: тариф «Пилот», промокоды, CSAT-реакции, фидбэк
-- =======================================================================

-- -----------------------------------------------------------------------
-- 1. Поля компании для пилота
-- -----------------------------------------------------------------------
alter table public.companies
  add column if not exists pilot_until timestamptz,
  add column if not exists promo_code  text;

-- -----------------------------------------------------------------------
-- 2. Промокоды (глобальная таблица, без company_id)
-- -----------------------------------------------------------------------
create table if not exists public.promo_codes (
  code         text primary key,
  plan         text not null,                    -- какой план активирует (pilot | start | business | team)
  days_valid   int  not null default 60,         -- на сколько дней
  max_uses     int  not null default 100,
  uses_count   int  not null default 0,
  active       boolean not null default true,
  description  text,
  created_at   timestamptz not null default now()
);

alter table public.promo_codes enable row level security;

-- любой авторизованный пользователь может читать активные коды (для валидации в UI)
drop policy if exists promo_codes_read on public.promo_codes;
create policy promo_codes_read on public.promo_codes for select
  to authenticated
  using (active = true);

-- INSERT/UPDATE/DELETE — только service role (сервер)

-- сидим стартовый промокод
insert into public.promo_codes (code, plan, days_valid, max_uses, description)
values ('PILOT2026', 'pilot', 60, 50, 'Пилот 2 месяца на тарифе Бизнес — фаза Pre-launch')
on conflict (code) do nothing;

-- -----------------------------------------------------------------------
-- 3. Реакции на сообщения (CSAT 👍/👎)
-- -----------------------------------------------------------------------
create table if not exists public.message_reactions (
  message_id uuid not null references public.messages(id) on delete cascade,
  user_id    uuid not null references public.users(id) on delete cascade,
  company_id uuid not null references public.companies(id) on delete cascade,
  reaction   text not null check (reaction in ('thumbs_up','thumbs_down')),
  created_at timestamptz not null default now(),
  primary key (message_id, user_id)
);

create index if not exists message_reactions_company_idx on public.message_reactions(company_id, created_at desc);
create index if not exists message_reactions_msg_idx     on public.message_reactions(message_id);

alter table public.message_reactions enable row level security;

drop policy if exists message_reactions_rw on public.message_reactions;
create policy message_reactions_rw on public.message_reactions for all
  to authenticated
  using (company_id = public.current_company_id())
  with check (company_id = public.current_company_id() and user_id = auth.uid());

-- -----------------------------------------------------------------------
-- 4. Pilot feedback (in-product еженедельный опрос + NPS-якоря)
-- -----------------------------------------------------------------------
create table if not exists public.pilot_feedback (
  id            uuid primary key default gen_random_uuid(),
  company_id    uuid not null references public.companies(id) on delete cascade,
  user_id       uuid not null references public.users(id) on delete cascade,
  anchor        text not null,                   -- 'weekly' | '14d' | '60d' | 'ad_hoc'
  week_starting date,
  q_usage       text,                            -- 'none'|'1-2'|'3-5'|'6-10'|'10+'
  q_worked      text,
  q_pain        text,
  nps_score     int  check (nps_score between 0 and 10),
  created_at    timestamptz not null default now()
);

create index if not exists pilot_feedback_company_idx on public.pilot_feedback(company_id, created_at desc);
create index if not exists pilot_feedback_anchor_idx  on public.pilot_feedback(anchor, created_at desc);

alter table public.pilot_feedback enable row level security;

drop policy if exists pilot_feedback_rw on public.pilot_feedback;
create policy pilot_feedback_rw on public.pilot_feedback for all
  to authenticated
  using (company_id = public.current_company_id())
  with check (company_id = public.current_company_id() and user_id = auth.uid());

alter table public.pilot_feedback alter column company_id set default public.current_company_id();

-- -----------------------------------------------------------------------
-- 5. Согласие на ПДн (отметка времени принятия)
-- -----------------------------------------------------------------------
alter table public.users
  add column if not exists consent_pd_at timestamptz,
  add column if not exists dpa_accepted_at timestamptz;

-- Обновляем триггер так, чтобы он подхватывал consent_pd_at из raw_user_meta_data
create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  v_consent timestamptz;
begin
  begin
    v_consent := nullif(new.raw_user_meta_data->>'consent_pd_at','')::timestamptz;
  exception when others then
    v_consent := null;
  end;

  insert into public.users (id, email, full_name, consent_pd_at)
  values (
    new.id,
    new.email,
    coalesce(new.raw_user_meta_data->>'full_name', split_part(new.email,'@',1)),
    v_consent
  )
  on conflict (id) do update set
    consent_pd_at = coalesce(public.users.consent_pd_at, excluded.consent_pd_at);
  return new;
end $$;

-- -----------------------------------------------------------------------
-- 6. RPC: активация промокода (атомарно: проверка + apply + increment)
-- -----------------------------------------------------------------------
create or replace function public.activate_promo_code(
  p_code text,
  p_company_id uuid
) returns table (
  ok          boolean,
  plan        text,
  pilot_until timestamptz,
  reason      text
)
language plpgsql security definer set search_path = public as $$
declare
  v_code   public.promo_codes%rowtype;
  v_until  timestamptz;
begin
  select * into v_code from public.promo_codes
   where code = upper(trim(p_code)) and active = true
   for update;

  if not found then
    return query select false, null::text, null::timestamptz, 'invalid_code'::text;
    return;
  end if;

  if v_code.uses_count >= v_code.max_uses then
    return query select false, null::text, null::timestamptz, 'limit_reached'::text;
    return;
  end if;

  v_until := now() + (v_code.days_valid::text || ' days')::interval;

  update public.companies
     set plan = v_code.plan,
         pilot_until = v_until,
         promo_code = v_code.code
   where id = p_company_id;

  update public.promo_codes
     set uses_count = uses_count + 1
   where code = v_code.code;

  return query select true, v_code.plan, v_until, null::text;
end $$;

-- =======================================================================
-- Конец миграции 0013_pilot_phase.sql
-- =======================================================================
