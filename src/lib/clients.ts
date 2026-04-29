/**
 * Доменные хелперы для модуля клиентов.
 * Используются и в API-роутах (для UI), и в Action Engine (для AI-tools).
 */
import type { SupabaseClient } from "@supabase/supabase-js";

/** Поля карточки клиента, которые могут быть отредактированы через UI/AI. */
export const CLIENT_EDITABLE_COLUMNS = [
  "name",
  "short_name",
  "legal_name",
  "client_type",
  "contact",
  "phone",
  "email",
  "telegram",
  "website",
  "industry",
  "inn",
  "kpp",
  "ogrn",
  "bank_name",
  "bank_account",
  "corr_account",
  "bik",
  "legal_address",
  "actual_address",
  "signatory_name",
  "signatory_title",
  "signatory_basis",
  "status",
  "tags",
  "summary",
  "owner_id",
  "data",
] as const;

export type ClientEditableColumn = (typeof CLIENT_EDITABLE_COLUMNS)[number];

const ALLOWED = new Set<string>(CLIENT_EDITABLE_COLUMNS);

/** Снимает с произвольного объекта только разрешённые поля клиента (whitelist). */
export function pickClientFields(input: Record<string, unknown>): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(input ?? {})) {
    if (!ALLOWED.has(k)) continue;
    if (v === undefined) continue;
    if (k === "tags" && !Array.isArray(v)) continue;
    out[k] = v;
  }
  return out;
}

export const CLIENT_LIST_COLUMNS =
  "id, name, short_name, legal_name, client_type, contact, phone, email, telegram, website, industry, inn, status, tags, summary, last_contact_at, owner_id, created_at, updated_at";

export const CLIENT_FULL_COLUMNS =
  "id, name, short_name, legal_name, client_type, contact, phone, email, telegram, website, industry, inn, kpp, ogrn, bank_name, bank_account, corr_account, bik, legal_address, actual_address, signatory_name, signatory_title, signatory_basis, status, tags, summary, last_contact_at, owner_id, created_by, data, created_at, updated_at";

export type ClientFull = {
  id: string;
  name: string;
  short_name: string | null;
  legal_name: string | null;
  client_type: string | null;
  contact: string | null;
  phone: string | null;
  email: string | null;
  telegram: string | null;
  website: string | null;
  industry: string | null;
  inn: string | null;
  kpp: string | null;
  ogrn: string | null;
  bank_name: string | null;
  bank_account: string | null;
  corr_account: string | null;
  bik: string | null;
  legal_address: string | null;
  actual_address: string | null;
  signatory_name: string | null;
  signatory_title: string | null;
  signatory_basis: string | null;
  status: string;
  tags: string[];
  summary: string | null;
  last_contact_at: string | null;
  owner_id: string | null;
  created_by: string | null;
  data: any;
  created_at: string;
  updated_at: string;
};

export type ContractRecord = {
  id: string;
  template_id: string | null;
  template_name: string | null;
  client_id: string | null;
  name: string | null;
  storage_path: string | null;
  download_url: string | null;
  warnings: string[] | null;
  created_at: string;
};

/** Загружает все договоры по клиенту (или последние N если client_id не задан). */
export async function loadContracts(
  service: SupabaseClient,
  companyId: string,
  opts: { clientId?: string | null; limit?: number } = {}
): Promise<ContractRecord[]> {
  const { clientId = null, limit = 50 } = opts;
  let q = service
    .from("generated_contracts")
    .select(
      "id, template_id, client_id, name, storage_path, download_url, warnings, created_at, contract_templates(name)"
    )
    .eq("company_id", companyId)
    .order("created_at", { ascending: false })
    .limit(limit);
  if (clientId) q = q.eq("client_id", clientId);
  const { data } = await q;
  return (data ?? []).map((r: any) => ({
    id: r.id,
    template_id: r.template_id,
    template_name: r.contract_templates?.name ?? null,
    client_id: r.client_id,
    name: r.name,
    storage_path: r.storage_path,
    download_url: r.download_url,
    warnings: Array.isArray(r.warnings) ? r.warnings : null,
    created_at: r.created_at,
  }));
}

/** Маппинг полей клиента → ключи переменных в шаблонах договоров.
 *  Используется для авто-подстановки реквизитов в /api/actions::ai_create_contract. */
export function clientToContractData(c: ClientFull): Record<string, string> {
  const map: Record<string, string> = {
    client_full_name: c.legal_name ?? c.name ?? "",
    client_short_name: c.short_name ?? c.name ?? "",
    client_legal_address: c.legal_address ?? "",
    client_actual_address: c.actual_address ?? c.legal_address ?? "",
    client_inn: c.inn ?? "",
    client_kpp: c.kpp ?? "",
    client_ogrn: c.ogrn ?? "",
    client_bank: c.bank_name ?? "",
    client_account: c.bank_account ?? "",
    client_corr_account: c.corr_account ?? "",
    client_bik: c.bik ?? "",
    client_email: c.email ?? "",
    client_phone: c.phone ?? "",
    client_signatory_name: c.signatory_name ?? "",
    signatory_full_name: c.signatory_name ?? "",
    signatory_title: c.signatory_title ?? "",
    signatory_basis: c.signatory_basis ?? "Устава",
  };
  // фильтруем пустые — генератор подставит ""; пусть лучше будут только реальные значения
  return Object.fromEntries(Object.entries(map).filter(([, v]) => v && String(v).trim()));
}
