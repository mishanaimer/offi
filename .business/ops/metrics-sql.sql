-- Метрики продукта Offi для фазы Pre-launch / 5 пилотов
-- Запускается в Supabase SQL Editor или подключается к admin dashboard
-- Все запросы фильтруются по company_id для одной компании,
-- или агрегируются по всем компаниям с plan='pilot'

-- ─────────────────────────────────────────────────────────────
-- 1. DAU / WAU / MAU
-- ─────────────────────────────────────────────────────────────

-- DAU за последние 30 дней (по дням)
select
  date(created_at) as day,
  count(distinct user_id) as dau
from messages
where created_at >= now() - interval '30 days'
  and is_ai = false
group by date(created_at)
order by day desc;

-- WAU и MAU
with active_users as (
  select user_id, max(created_at) as last_seen
  from messages
  where is_ai = false
  group by user_id
)
select
  count(*) filter (where last_seen >= now() - interval '7 days') as wau,
  count(*) filter (where last_seen >= now() - interval '30 days') as mau
from active_users;


-- ─────────────────────────────────────────────────────────────
-- 2. Запросов AI в день (по компаниям)
-- ─────────────────────────────────────────────────────────────

select
  c.name as company,
  date(m.created_at) as day,
  count(*) as ai_requests
from messages m
join companies c on c.id = m.channel_id::uuid -- adjust to actual schema
where m.is_ai = true
  and m.created_at >= now() - interval '14 days'
group by c.name, date(m.created_at)
order by day desc, company;


-- ─────────────────────────────────────────────────────────────
-- 3. Time to first message (от регистрации до первого вопроса)
-- ─────────────────────────────────────────────────────────────

select
  u.id,
  u.email,
  c.name as company,
  u.created_at as registered_at,
  min(m.created_at) as first_message_at,
  extract(epoch from (min(m.created_at) - u.created_at))/60 as ttfm_minutes
from users u
join companies c on c.id = u.company_id
left join messages m on m.user_id = u.id and m.is_ai = false
where u.created_at >= now() - interval '60 days'
group by u.id, u.email, c.name, u.created_at
order by registered_at desc;


-- ─────────────────────────────────────────────────────────────
-- 4. 7-day retention (что % пользователей возвращается через 7 дней)
-- ─────────────────────────────────────────────────────────────

with first_session as (
  select user_id, min(date(created_at)) as d0
  from messages
  where is_ai = false
  group by user_id
),
returning as (
  select fs.user_id
  from first_session fs
  join messages m on m.user_id = fs.user_id
  where date(m.created_at) between fs.d0 + 1 and fs.d0 + 7
    and m.is_ai = false
  group by fs.user_id
)
select
  count(distinct fs.user_id) as total_users,
  count(distinct r.user_id) as returned_in_7d,
  round(count(distinct r.user_id)::numeric / nullif(count(distinct fs.user_id), 0) * 100, 1) as retention_7d_pct
from first_session fs
left join returning r using (user_id);


-- ─────────────────────────────────────────────────────────────
-- 5. CSAT (по 👍/👎 на ответы AI)
-- предполагает поле message_reactions(message_id, user_id, reaction)
-- ─────────────────────────────────────────────────────────────

select
  c.name as company,
  count(*) filter (where mr.reaction = 'thumbs_up') as positive,
  count(*) filter (where mr.reaction = 'thumbs_down') as negative,
  count(*) as total,
  round(count(*) filter (where mr.reaction = 'thumbs_up')::numeric
        / nullif(count(*), 0) * 100, 1) as csat_pct
from message_reactions mr
join messages m on m.id = mr.message_id
join companies c on c.id = m.channel_id::uuid -- adjust
where m.is_ai = true
  and mr.created_at >= now() - interval '30 days'
group by c.name
order by csat_pct desc;


-- ─────────────────────────────────────────────────────────────
-- 6. База знаний — сколько документов и чанков на компанию
-- ─────────────────────────────────────────────────────────────

select
  c.name as company,
  count(distinct d.id) as documents,
  sum(d.chunks_count) as total_chunks,
  pg_size_pretty(sum(octet_length(ch.content::text))::bigint) as content_size
from companies c
left join documents d on d.company_id = c.id
left join chunks ch on ch.company_id = c.id
where c.plan in ('pilot','trial','start','business','team')
group by c.name
order by total_chunks desc nulls last;


-- ─────────────────────────────────────────────────────────────
-- 7. Использование action_log (генерации, отправки, draft)
-- ─────────────────────────────────────────────────────────────

select
  c.name as company,
  al.action,
  al.status,
  count(*) as count
from action_log al
join companies c on c.id = al.company_id
where al.created_at >= now() - interval '14 days'
group by c.name, al.action, al.status
order by company, count desc;


-- ─────────────────────────────────────────────────────────────
-- 8. Top вопросы пилотов (для анализа что ищут)
-- ─────────────────────────────────────────────────────────────

select
  c.name as company,
  m.content as question,
  m.created_at
from messages m
join channels ch on ch.id = m.channel_id
join companies c on c.id = ch.company_id
where m.is_ai = false
  and ch.type = 'ai'
  and c.plan = 'pilot'
  and m.created_at >= now() - interval '7 days'
order by m.created_at desc
limit 100;


-- ─────────────────────────────────────────────────────────────
-- 9. Сводка по пилотам — главная таблица для weekly review
-- ─────────────────────────────────────────────────────────────

with pilot_data as (
  select
    c.id, c.name, c.created_at as joined_at,
    count(distinct u.id) as members,
    count(distinct d.id) as documents,
    count(distinct m.id) filter (where m.is_ai = false) as user_messages,
    count(distinct m.id) filter (where m.is_ai = true) as ai_messages,
    max(m.created_at) as last_activity
  from companies c
  left join users u on u.company_id = c.id
  left join documents d on d.company_id = c.id
  left join channels ch on ch.company_id = c.id
  left join messages m on m.channel_id = ch.id
  where c.plan = 'pilot'
  group by c.id, c.name, c.created_at
)
select
  name as company,
  joined_at::date as joined,
  extract(day from now() - joined_at)::int as days_in,
  members,
  documents,
  user_messages,
  ai_messages,
  last_activity::date as last_active,
  case
    when last_activity is null then 'NEVER_USED'
    when last_activity < now() - interval '7 days' then '🔴 INACTIVE_7D'
    when last_activity < now() - interval '3 days' then '🟡 SLOW'
    else '🟢 ACTIVE'
  end as status
from pilot_data
order by joined_at;


-- ─────────────────────────────────────────────────────────────
-- 10. Net Promoter Score
-- предполагает поле pilot_feedback(user_id, nps_score, created_at, anchor)
-- ─────────────────────────────────────────────────────────────

select
  count(*) filter (where nps_score >= 9) as promoters,
  count(*) filter (where nps_score between 7 and 8) as passives,
  count(*) filter (where nps_score <= 6) as detractors,
  count(*) as total,
  round((count(*) filter (where nps_score >= 9)::numeric
         - count(*) filter (where nps_score <= 6)::numeric)
         / nullif(count(*), 0) * 100) as nps
from pilot_feedback
where anchor = '14d' or anchor = '60d';


-- ─────────────────────────────────────────────────────────────
-- ВНИМАНИЕ
-- 1. Перед использованием — проверить актуальные имена таблиц и колонок.
--    В частности: messages, channels, companies, users, documents, chunks,
--    action_log, pilot_feedback, message_reactions.
-- 2. Если pilot_feedback и message_reactions ещё не созданы — добавить
--    миграцию `0013_pilot_feedback_and_reactions.sql` в неделю 4.
-- 3. Все запросы — read-only. Безопасно запускать в проде.
-- ─────────────────────────────────────────────────────────────
