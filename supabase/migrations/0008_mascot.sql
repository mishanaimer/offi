-- =======================================================================
-- OFFI · Mascot customization
-- Хранит параметры анимированного маскота ассистента (форма, антенна, уши, фон).
-- Цвет маскота берётся из companies.assistant_color (уже существует).
-- =======================================================================

alter table public.companies
  add column if not exists mascot_enabled boolean not null default true,
  add column if not exists mascot_head_shape text not null default 'classic',
  add column if not exists mascot_antenna text not null default 'ball',
  add column if not exists mascot_ears text not null default 'round',
  add column if not exists mascot_bg text;

-- Дефолт для фона: тонкая подложка из assistant_color / brand_accent.
-- Если что-то уже задано — не трогаем.
update public.companies
  set mascot_bg = coalesce(mascot_bg, '#EEF4FF');

-- Допустимые значения
alter table public.companies
  add constraint companies_mascot_head_shape_check
  check (mascot_head_shape in ('classic','soft','wide','tall','capsule'));

alter table public.companies
  add constraint companies_mascot_antenna_check
  check (mascot_antenna in ('ball','pill','bent','bolt','dot','ring','none'));

alter table public.companies
  add constraint companies_mascot_ears_check
  check (mascot_ears in ('round','rect','small','none'));
