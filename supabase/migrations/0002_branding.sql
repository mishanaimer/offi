-- =======================================================================
-- OFFI · Branding fields
-- Расширяет companies: цвет ассистента, иконка, приветствие, логотип.
-- =======================================================================

alter table public.companies
  add column if not exists assistant_color text,
  add column if not exists assistant_icon text default 'sparkles',
  add column if not exists welcome_message text,
  add column if not exists logo_url text;

-- по умолчанию assistant_color = brand_accent (если null)
update public.companies
  set assistant_color = coalesce(assistant_color, brand_accent);

-- политика: брендинг может менять только owner/admin этой компании
drop policy if exists companies_update on public.companies;
create policy companies_update on public.companies for update
  using (
    id = public.current_company_id()
    and exists(
      select 1 from public.users u
      where u.id = auth.uid() and u.company_id = public.companies.id and u.role in ('owner','admin')
    )
  );
