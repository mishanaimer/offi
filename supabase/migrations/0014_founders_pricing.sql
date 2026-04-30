-- =======================================================================
-- OFFI · Founders Pricing
-- - Первые 50 платящих клиентов получают пожизненную скидку 50%
-- - При апгрейде с пилота либо активации промокода FOUNDER их цена фиксируется
-- - При смене тарифа цена остаётся со скидкой (locked_price хранит объект по плану)
-- =======================================================================

-- 1. Поля компании
alter table public.companies
  add column if not exists is_founder      boolean not null default false,
  add column if not exists founder_at      timestamptz,
  add column if not exists locked_price    jsonb;
-- locked_price — объект вида {"start": 1990, "business": 4990, "team": 9990}
-- если null — клиент платит стандартный прайс

create index if not exists companies_founder_idx
  on public.companies(is_founder) where is_founder = true;

-- 2. Сидим промокод FOUNDER (активация даёт locked_price)
insert into public.promo_codes (code, plan, days_valid, max_uses, description)
values ('FOUNDER', 'founder', 36500, 50, 'Founders Pricing — первые 50 клиентов, пожизненная скидка 50%')
on conflict (code) do nothing;

-- 3. Counter / status RPC для лендинговой плашки и админки
create or replace function public.founders_status() returns table (
  used      int,
  total     int,
  remaining int
)
language sql security definer set search_path = public as $$
  select
    coalesce((select count(*) from public.companies where is_founder = true)::int, 0) as used,
    (select max_uses from public.promo_codes where code = 'FOUNDER') as total,
    greatest(
      (select max_uses from public.promo_codes where code = 'FOUNDER')
       - coalesce((select count(*) from public.companies where is_founder = true)::int, 0),
      0
    ) as remaining;
$$;

grant execute on function public.founders_status() to anon, authenticated;

-- 4. Перекрываем activate_promo_code: специальная ветка для plan='founder'
create or replace function public.activate_promo_code(
  p_code       text,
  p_company_id uuid
) returns table (
  ok          boolean,
  plan        text,
  pilot_until timestamptz,
  is_founder  boolean,
  reason      text
)
language plpgsql security definer set search_path = public as $$
declare
  v_code     public.promo_codes%rowtype;
  v_until    timestamptz;
  v_founders int;
  v_already  boolean;
  v_locked   jsonb;
begin
  select * into v_code from public.promo_codes
   where code = upper(trim(p_code)) and active = true
   for update;

  if not found then
    return query select false, null::text, null::timestamptz, false, 'invalid_code'::text;
    return;
  end if;

  if v_code.uses_count >= v_code.max_uses then
    return query select false, null::text, null::timestamptz, false, 'limit_reached'::text;
    return;
  end if;

  -- ----- FOUNDERS ветка: не меняет план, фиксирует locked_price -----
  if v_code.plan = 'founder' then
    select count(*)::int into v_founders from public.companies where is_founder = true;
    if v_founders >= v_code.max_uses then
      return query select false, null::text, null::timestamptz, false, 'limit_reached'::text;
      return;
    end if;

    select is_founder into v_already from public.companies where id = p_company_id;
    if coalesce(v_already, false) then
      return query select false, null::text, null::timestamptz, true, 'already_founder'::text;
      return;
    end if;

    v_locked := jsonb_build_object(
      'start',    1990,
      'business', 4990,
      'team',     9990
    );

    update public.companies
       set is_founder   = true,
           founder_at   = now(),
           locked_price = v_locked,
           promo_code   = v_code.code
     where id = p_company_id;

    update public.promo_codes
       set uses_count = uses_count + 1
     where code = v_code.code;

    return query
      select true,
             null::text,
             null::timestamptz,
             true,
             null::text;
    return;
  end if;

  -- ----- Стандартная ветка: pilot / start / business / team -----
  v_until := now() + (v_code.days_valid::text || ' days')::interval;

  update public.companies
     set plan        = v_code.plan,
         pilot_until = case when v_code.plan = 'pilot' then v_until else pilot_until end,
         promo_code  = v_code.code
   where id = p_company_id;

  update public.promo_codes
     set uses_count = uses_count + 1
   where code = v_code.code;

  return query
    select true,
           v_code.plan,
           case when v_code.plan = 'pilot' then v_until else null::timestamptz end,
           false,
           null::text;
end $$;

-- 5. Расширяем учёт стоимости в usage_counters (для Admin Metrics)
alter table public.usage_counters
  add column if not exists tokens_input  bigint not null default 0,
  add column if not exists tokens_output bigint not null default 0,
  add column if not exists cost_kop      bigint not null default 0;
-- cost_kop — в копейках, чтобы хранить целыми числами

create or replace function public.increment_usage(
  p_company_id     uuid,
  p_period         text,
  p_requests       int default 0,
  p_actions        int default 0,
  p_tokens_input   bigint default 0,
  p_tokens_output  bigint default 0,
  p_cost_kop       bigint default 0
) returns void
language sql security definer set search_path = public as $$
  insert into public.usage_counters (
    company_id, period,
    requests_count, actions_count,
    tokens_input, tokens_output, cost_kop,
    updated_at
  )
  values (
    p_company_id, p_period,
    p_requests, p_actions,
    p_tokens_input, p_tokens_output, p_cost_kop,
    now()
  )
  on conflict (company_id, period) do update
    set requests_count = public.usage_counters.requests_count + excluded.requests_count,
        actions_count  = public.usage_counters.actions_count  + excluded.actions_count,
        tokens_input   = public.usage_counters.tokens_input   + excluded.tokens_input,
        tokens_output  = public.usage_counters.tokens_output  + excluded.tokens_output,
        cost_kop       = public.usage_counters.cost_kop       + excluded.cost_kop,
        updated_at     = now();
$$;

-- =======================================================================
-- Конец миграции 0014_founders_pricing.sql
-- =======================================================================
