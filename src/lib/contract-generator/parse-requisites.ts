import { isFemalePatronymic, toGenitive, toNominative } from "./russian-cases";

// Извлекает реквизиты из произвольного текста (карточка контрагента,
// выписка ЕГРЮЛ и т.п.). Эвристики «достаточно хороши» для типичных кейсов;
// сложные случаи (несколько компаний в одном тексте, управляющие организации,
// несклоняемые ФИО) лучше отдавать в LLM-парсер поверх этого.
export function parseRequisites(text: string): Record<string, string> {
  const out: Record<string, string> = {};

  // === Наименования ===
  const cleaned = text.replace(/\*+/g, "");
  let m = cleaned.match(
    /Общество\s+с\s+ограниченной\s+ответственностью\s+[«"]([^»"]+)[»"]/i
  );
  if (m) {
    out.client_full_name = `Общество с ограниченной ответственностью «${m[1]}»`;
    out.client_short_name = `ООО «${m[1]}»`;
  }
  if (!out.client_short_name) {
    m = cleaned.match(/ООО\s*[«"]([^»"]+)[»"]/);
    if (m) out.client_short_name = `ООО «${m[1]}»`;
  }

  // === ИНН/КПП/ОГРН ===
  m = text.match(/ИНН[:\s]*(\d{10}|\d{12})/);
  if (m) out.client_inn = m[1];

  m = text.match(/КПП[:\s\-]*(\d{9})/);
  if (m) out.client_kpp = m[1];

  m = text.match(/ОГРН[:\s]*(\d{13,15})/);
  if (m) out.client_ogrn = m[1];

  // === Счета и БИК ===
  m = text.match(/(?:Р\/с[чч]?|р\/с[чч]?|Расч[её]тный\s+сч[её]т)[\s.:№]*(\d{20})/i);
  if (m) out.client_account = m[1];

  m = text.match(/(?:К\/с[чч]?|к\/с[чч]?|корр[.\s]*сч[её]т)[\s.:№]*(\d{20})/i);
  if (m) out.client_corr_account = m[1];

  m = text.match(/БИК[:\s]*(\d{9})/);
  if (m) out.client_bik = m[1];

  // === Email ===
  m = text.match(/[Ee][\-\s]?mail[:\s]*([\w.\-+]+@[\w.\-]+\.[a-zA-Z]{2,})/);
  if (m) out.client_email = m[1].replace(/[.,;:\s]+$/, "");

  // === Банк ===
  let bank: string | null = null;
  m = text.match(/Банк[:\s]+([^\n]+?)(?:\n|$)/);
  if (m) {
    const candidate = m[1].trim().replace(/[,.;]+$/, "");
    if (!/^\d+$/.test(candidate) && candidate.length > 3 && candidate.length < 200) {
      bank = candidate;
    }
  }
  if (!bank) {
    for (const rawLine of text.split("\n")) {
      const lineClean = rawLine.replace(/\*+/g, "").trim().replace(/[,.;:]+$/, "");
      if (!lineClean) continue;
      const up = lineClean.toUpperCase();
      const banky =
        /(БАНК|СБЕРБАНК|ВТБ|АЛЬФА|ТИНЬКОФФ|ОТКРЫТИЕ|ГАЗПРОМ)/.test(up) &&
        !/^(БИК|Р\/С|К\/С|ОГРН|ИНН|КПП)/.test(up) &&
        !up.includes("БАНКОВСК") &&
        lineClean.length > 5 &&
        lineClean.length < 200;
      if (banky) {
        bank = lineClean;
        break;
      }
    }
  }
  if (bank) out.client_bank = bank;

  // === Адреса ===
  m = text.match(
    /Юридический\s+(?:адрес\s+)?и\s+фактический\s+адрес[:\s]+([\s\S]+?)(?=\n\s*(?:Тел|E[\-\s]?mail|ОГРН|ИНН|КПП|$)|$)/i
  );
  if (m) {
    const addr = m[1].split(/\s+/).join(" ").replace(/[,.;\s]+$/, "");
    out.client_legal_address = addr;
    out.client_actual_address = addr;
  } else {
    m = text.match(
      /Юридический\s+адрес[:\s]+([\s\S]+?)(?=\n\s*(?:Фактический|Тел|E[\-\s]?mail|ОГРН|ИНН|$)|$)/i
    );
    if (m) {
      const addr = m[1].split(/\s+/).join(" ").replace(/[,.;\s]+$/, "");
      out.client_legal_address = addr;
    }
    m = text.match(
      /Фактический\s+адрес[:\s]+([\s\S]+?)(?=\n\s*(?:Тел|E[\-\s]?mail|ОГРН|ИНН|$)|$)/i
    );
    if (m) {
      const addr = m[1].split(/\s+/).join(" ").replace(/[,.;\s]+$/, "");
      out.client_actual_address = addr;
    }
    if (out.client_legal_address && !out.client_actual_address) {
      out.client_actual_address = out.client_legal_address;
    }
  }

  // === Подписант ===
  m = text.match(
    /(?:в\s+лице\s+)?Генерального?\s+директора?[\s\-–—,]+([А-ЯЁ][а-яё]+(?:ой|ова|ева)?\s+[А-ЯЁ][а-яё]+(?:ы|и|ой)?\s+[А-ЯЁ][а-яё]+(?:ы|и|ой|вны|чны)?)/
  );
  if (!m) {
    m = text.match(
      /Генеральный\s+директор[\s\-–—:]+([А-ЯЁ][а-яё]+\s+[А-ЯЁ][а-яё]+\s+[А-ЯЁ][а-яё]+)/
    );
  }
  if (m) {
    const fullNameRaw = m[1].trim();
    const fullName = toNominative(fullNameRaw);
    const parts = fullName.split(/\s+/);
    out.client_signatory_title = "Генеральный директор";
    if (parts.length === 3) {
      out.client_signatory_short = `${parts[0]} ${parts[1][0]}.${parts[2][0]}.`;
      const female = isFemalePatronymic(parts[2]);
      const participle = female ? "действующей" : "действующего";
      out.client_signatory_clause =
        `в лице Генерального директора ${toGenitive(fullName)}, ` +
        `${participle} на основании Устава`;
    }
  }

  return out;
}
