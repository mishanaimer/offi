/**
 * Рендер «текстовых» шаблонов (раздел Документы → Текстовые шаблоны).
 * Используется и в UI-превью, и в /api/actions::generate_document.
 * Один и тот же набор переменных, чтобы пользователь видел в превью то же,
 * что получит реальный получатель (например, клиент в письме).
 */

export type TemplateClient = {
  id?: string;
  name?: string | null;
  short_name?: string | null;
  legal_name?: string | null;
  contact?: string | null;
  email?: string | null;
  phone?: string | null;
  inn?: string | null;
  kpp?: string | null;
  ogrn?: string | null;
  bank_name?: string | null;
  bank_account?: string | null;
  corr_account?: string | null;
  bik?: string | null;
  legal_address?: string | null;
  actual_address?: string | null;
  website?: string | null;
  industry?: string | null;
  signatory_name?: string | null;
  signatory_title?: string | null;
  signatory_basis?: string | null;
  summary?: string | null;
};

export type TemplateUser = {
  full_name?: string | null;
  email?: string | null;
};

export type TemplateCompany = {
  name?: string | null;
  assistant_name?: string | null;
};

/** Извлекает «обращательное» имя из ФИО или контакта.
 *  - «Иванов Иван Иванович» → «Иван»
 *  - «Иван Иванов» → «Иван»
 *  - «Иван» → «Иван»
 *  - «отдел продаж» → null (это явно не имя)
 */
export function pickFirstName(raw?: string | null): string | null {
  if (!raw) return null;
  const s = String(raw).trim();
  if (!s) return null;
  // если начинается с маленькой буквы или содержит русское «отдел/менеджер/и т.д.» — это не имя
  if (!/^[A-ZА-ЯЁ]/u.test(s)) return null;
  const tokens = s.split(/\s+/).filter(Boolean);
  if (tokens.length === 0) return null;
  // эвристика: «Фамилия Имя» (Иванов Иван) — берём 2-е слово; иначе 1-е
  if (tokens.length >= 2) {
    const looksLikeSurnameFirst =
      /(ов|ев|ин|ын|ова|ева|ина|ына|ский|ская|ин|енко|юк|ук)$/iu.test(tokens[0]);
    return looksLikeSurnameFirst ? tokens[1] : tokens[0];
  }
  return tokens[0];
}

/** Имя для приветствия. Если есть контактное лицо — берём его first name,
 *  иначе короткое название компании, иначе fallback. */
export function pickGreetingName(client?: TemplateClient | null): string {
  if (!client) return "коллеги";
  const fromContact = pickFirstName(client.contact);
  if (fromContact) return fromContact;
  return (client.short_name || client.name || "коллеги") as string;
}

export function buildTemplateVariables(opts: {
  client?: TemplateClient | null;
  user?: TemplateUser | null;
  company?: TemplateCompany | null;
  extra?: Record<string, unknown>;
}): Record<string, string> {
  const c = opts.client ?? {};
  const u = opts.user ?? {};
  const co = opts.company ?? {};
  const today = new Date();
  const dateStr = today.toLocaleDateString("ru-RU");
  const greeting = pickGreetingName(c);
  const firstName = pickFirstName(c.contact);

  const map: Record<string, string> = {
    "client.name": str(c.short_name) || str(c.name),
    "client.short_name": str(c.short_name) || str(c.name),
    "client.legal_name": str(c.legal_name) || str(c.name),
    "client.contact": str(c.contact),
    "client.contact_name": str(c.contact),
    "client.first_name": firstName ?? "",
    "client.greeting": greeting,
    "client.email": str(c.email),
    "client.phone": str(c.phone),
    "client.website": str(c.website),
    "client.industry": str(c.industry),
    "client.inn": str(c.inn),
    "client.kpp": str(c.kpp),
    "client.ogrn": str(c.ogrn),
    "client.bank": str(c.bank_name),
    "client.bank_account": str(c.bank_account),
    "client.corr_account": str(c.corr_account),
    "client.bik": str(c.bik),
    "client.legal_address": str(c.legal_address),
    "client.actual_address": str(c.actual_address) || str(c.legal_address),
    "client.signatory_name": str(c.signatory_name),
    "client.signatory_title": str(c.signatory_title),
    "client.signatory_basis": str(c.signatory_basis),
    "client.summary": str(c.summary),
    "user.name": str(u.full_name),
    "user.email": str(u.email),
    "company.name": str(co.name),
    "assistant.name": str(co.assistant_name),
    date: dateStr,
    today: dateStr,
    greeting,
  };

  for (const [k, v] of Object.entries(opts.extra ?? {})) {
    if (v === undefined || v === null) continue;
    map[k] = String(v);
  }
  return map;
}

function str(v: unknown): string {
  if (v === null || v === undefined) return "";
  return String(v);
}

const PLACEHOLDER_RE = /\{\{\s*([\w.]+)\s*\}\}/g;

/** Подставляет переменные в текстовый шаблон. Неизвестные плейсхолдеры
 *  оставляет как есть — UI их подсветит, а пользователь решит что делать. */
export function applyTemplateVariables(
  body: string,
  variables: Record<string, string>
): string {
  return body.replace(PLACEHOLDER_RE, (full, key) => {
    const val = variables[key];
    if (val === undefined) return full;
    if (val === "") return ""; // пусто — лучше пустота, чем «—», иначе письмо выглядит ломано
    return val;
  });
}

export function renderTextTemplate(
  body: string,
  opts: Parameters<typeof buildTemplateVariables>[0]
): string {
  const vars = buildTemplateVariables(opts);
  return applyTemplateVariables(body, vars);
}

/** Список доступных переменных для подсказки в UI. */
export const TEMPLATE_VARIABLE_HINT: Array<{ key: string; label: string }> = [
  { key: "client.greeting", label: "Имя для приветствия (контакт или короткое название)" },
  { key: "client.first_name", label: "Имя контактного лица" },
  { key: "client.contact", label: "Контактное лицо (полностью)" },
  { key: "client.name", label: "Краткое название компании" },
  { key: "client.legal_name", label: "Полное юр. наименование" },
  { key: "client.email", label: "Email клиента" },
  { key: "client.phone", label: "Телефон клиента" },
  { key: "client.inn", label: "ИНН" },
  { key: "client.kpp", label: "КПП" },
  { key: "client.signatory_name", label: "ФИО подписанта" },
  { key: "client.signatory_title", label: "Должность подписанта" },
  { key: "client.legal_address", label: "Юридический адрес" },
  { key: "user.name", label: "Имя сотрудника, отправляющего" },
  { key: "company.name", label: "Название вашей компании" },
  { key: "date", label: "Сегодняшняя дата" },
];
