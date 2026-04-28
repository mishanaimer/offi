// ИИ-анализатор договора. Берёт текст + XML и возвращает структуру
// шаблона: какие поля нужно заполнять и какие правила замены применять.
//
// Подход (двухфазный):
//   1. Спрашиваем Claude Sonnet с plain-text: «найди переменные части,
//      верни JSON со списком полей (key, label, sample, type)».
//   2. В коде обходим все <w:t>...</w:t> в XML и для каждого поля строим
//      правила замены: если sample целиком встречается в <w:t> — формируем
//      замену <w:t>...{{key}}...</w:t>.
//
// Это безопаснее, чем просить ИИ генерировать XML — он часто не точен
// в кавычках/пробелах. А поиск по тексту детерминирован.
import { chatCompletion, MODELS } from "@/lib/ai";
import type { ComputedField, FieldDef, ReplacementRule } from "./types";

export interface AnalyzedTemplate {
  name: string;
  description: string;
  fields: FieldDef[];
  replacements: ReplacementRule[];
  computed_fields: ComputedField[];
  warnings: string[];
}

interface AIField {
  key: string;
  label: string;
  sample: string;
  type?: "text" | "textarea";
  hint?: string;
  group?: string;
}

interface AIResponse {
  name: string;
  description: string;
  fields: AIField[];
}

const SYSTEM_PROMPT = `Ты — эксперт по российским договорам. Тебе дают текст договора в формате .docx.
Найди в нём все «переменные» части — то, что меняется от договора к договору
(между разными контрагентами / датами / суммами), и которые надо будет
заполнять при создании нового договора.

Типичные переменные:
- наименование контрагента (полное и краткое: «ООО «...» / Общество с ограниченной ответственностью «...»»)
- ИНН, КПП, ОГРН
- банк, расчётный счёт, корреспондентский счёт, БИК
- юридический и фактический адреса
- ФИО подписанта (как написано в договоре, без склонений), должность подписанта
- даты (договора, акта, начала услуги) — день, месяц, год отдельными полями если они отдельно стоят
- номер договора
- цены, суммы, тарифы
- предмет / услуга / адрес обслуживания, если применимо
- любые другие конкретные значения, относящиеся к этой сделке

Верни СТРОГО JSON в формате:
{
  "name": "Краткое название шаблона на русском (например «Договор оказания услуг»)",
  "description": "1-2 предложения о шаблоне",
  "fields": [
    {
      "key": "snake_case_key",
      "label": "Русская подпись для UI",
      "sample": "Точное значение из текста (как написано — для поиска и замены)",
      "type": "text" | "textarea",
      "hint": "Подсказка для пользователя (опц.)",
      "group": "Группа: contract|client|bank|signatory|address|service (опц.)"
    }
  ]
}

Правила:
- "sample" — это ТОЧНОЕ значение из текста договора, без кавычек-обёрток, как ты его видишь в исходнике. Это критично — по нему мы будем искать и заменять.
- Используй type:"textarea" для длинных значений (адреса, преамбулы, описания).
- key пиши как snake_case (client_inn, contract_number, signatory_full_name).
- Для контрагентов префиксы: client_ (для абонента/покупателя/заказчика).
- Для подписанта: signatory_title, signatory_full_name, signatory_short, signatory_clause.
- Не добавляй поля для постоянных частей договора (текст условий, заголовки разделов).
- Если одна переменная встречается в нескольких местах с одинаковым значением — это ОДНО поле.
- Не создавай поля «исполнитель» — речь только об ОДНОМ контрагенте, реквизиты исполнителя зашиты в шаблон.
- Возвращай только JSON, без markdown-обёртки.`;

const MAX_TEXT_LEN = 60_000; // ~30K токенов — комфортно влезает в контекст Sonnet

export async function analyzeContractText(text: string): Promise<AIResponse> {
  const trimmed = text.length > MAX_TEXT_LEN ? text.slice(0, MAX_TEXT_LEN) : text;
  const result = await chatCompletion(
    [
      { role: "system", content: SYSTEM_PROMPT },
      { role: "user", content: `Текст договора:\n\n${trimmed}` },
    ],
    { model: MODELS.main, temperature: 0.2, max_tokens: 6000 }
  );
  const raw = result.choices[0]?.message?.content ?? "{}";
  const cleaned = raw.replace(/```json\s*/g, "").replace(/```/g, "").trim();
  return JSON.parse(cleaned) as AIResponse;
}

// Извлекает все <w:t...>...</w:t> вместе с точным открывающим тегом,
// чтобы при замене сохранять xml:space="preserve" и т.д.
const W_T_RE = /<w:t(\s[^>]*)?>([^<]*)<\/w:t>/g;

interface WtMatch {
  fullMatch: string; // полная подстрока <w:t...>...</w:t>
  attrs: string;
  text: string;
}

function findWtMatches(xml: string): WtMatch[] {
  const out: WtMatch[] = [];
  W_T_RE.lastIndex = 0;
  let m: RegExpExecArray | null;
  while ((m = W_T_RE.exec(xml)) !== null) {
    out.push({ fullMatch: m[0], attrs: m[1] ?? "", text: m[2] });
  }
  return out;
}

// XML-экранирование текста (соответствует сериализации Word)
function escapeXml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

// Декодирование XML (для сопоставления sample с текстом из <w:t>)
function decodeXml(s: string): string {
  return s
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&amp;/g, "&");
}

export interface BuildRulesOptions {
  /** Если sample встречается чаще, чем maxOccurrencesIfShort, и его длина < minSampleLen,
   *  пропускаем его (избегаем «2026» в адресе). */
  minSampleLen?: number;
  maxOccurrencesIfShort?: number;
}

/**
 * Строит правила замены для всех полей, найденных ИИ.
 * Сопоставляет sample с текстом из <w:t> и для каждого попадания
 * формирует rule {find: "<w:t...>X</w:t>", replace: "<w:t...>Y</w:t>"}.
 */
export function buildReplacementsFromFields(
  xml: string,
  fields: AIField[],
  opts: BuildRulesOptions = {}
): { replacements: ReplacementRule[]; warnings: string[] } {
  const minSampleLen = opts.minSampleLen ?? 4;
  const maxOccIfShort = opts.maxOccurrencesIfShort ?? 5;

  const matches = findWtMatches(xml);
  const replacements: ReplacementRule[] = [];
  const warnings: string[] = [];
  const seenFinds = new Set<string>();

  for (const f of fields) {
    const sample = (f.sample ?? "").trim();
    if (!sample) {
      warnings.push(`Поле «${f.key}» — пустой sample, замена не построена`);
      continue;
    }

    // Защита от ложных срабатываний на коротких неоднозначных значениях
    let occurrencesInDoc = 0;
    for (const wt of matches) {
      if (decodeXml(wt.text).includes(sample)) occurrencesInDoc++;
    }
    if (sample.length < minSampleLen && occurrencesInDoc > maxOccIfShort) {
      warnings.push(
        `Поле «${f.key}»: значение «${sample}» слишком короткое и встречается ${occurrencesInDoc} раз — пропущено, заполните вручную`
      );
      continue;
    }

    let appliedThis = 0;
    for (const wt of matches) {
      const decoded = decodeXml(wt.text);
      if (!decoded.includes(sample)) continue;
      // Заменяем sample на {{key}}
      const newDecoded = decoded.split(sample).join(`{{${f.key}}}`);
      // Re-кодируем для XML
      const newEscaped = escapeXml(newDecoded);
      const newWt = `<w:t${wt.attrs}>${newEscaped}</w:t>`;
      // Дедуп: одна и та же find-строка → одно правило (replace на все вхождения)
      if (seenFinds.has(wt.fullMatch)) continue;
      seenFinds.add(wt.fullMatch);
      replacements.push({
        find: wt.fullMatch,
        replace: newWt,
        count: null,
      });
      appliedThis++;
    }
    if (appliedThis === 0) {
      warnings.push(
        `Поле «${f.key}» (${f.label}): значение «${sample}» не найдено в документе — поле создано, но автоподстановка не работает`
      );
    }
  }

  return { replacements, warnings };
}

export async function analyzeAndBuildTemplate(
  plainText: string,
  xml: string
): Promise<AnalyzedTemplate> {
  const ai = await analyzeContractText(plainText);
  const fields: FieldDef[] = ai.fields.map((f) => ({
    key: f.key,
    label: f.label,
    placeholder: f.sample,
    type: f.type ?? "text",
    hint: f.hint,
  }));
  const { replacements, warnings } = buildReplacementsFromFields(xml, ai.fields);
  return {
    name: ai.name || "Шаблон договора",
    description: ai.description || "",
    fields,
    replacements,
    computed_fields: [],
    warnings,
  };
}
