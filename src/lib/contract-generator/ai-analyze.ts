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

const SYSTEM_PROMPT = `Ты помогаешь сделать из загруженного договора заполняемый шаблон.

КРИТИЧЕСКИ ВАЖНО:
1. Используй ТОЛЬКО текст, который есть в данном тебе документе. Не дополняй, не угадывай, не подставляй типичные значения «по памяти».
2. Если в документе на месте контрагента стоит «___________» или пусто — НЕ ВКЛЮЧАЙ это поле в шаблон (этот документ ещё пустой шаблон, нечего из него взять).
3. Каждое значение в "sample" должно дословно встречаться в тексте документа, как substring. Если ты пишешь sample, которого нет в тексте — это ошибка.

Найди в тексте «переменные» части — конкретные значения для одной из сторон (обычно второй стороны / клиента / абонента), которые меняются от договора к договору:
- наименование контрагента
- ИНН, КПП, ОГРН
- банк, расчётный/корр. счёт, БИК
- адреса
- ФИО и должность подписанта
- email, телефон контрагента
- даты, номер договора, цены, суммы — ЕСЛИ они есть в тексте конкретными значениями

НЕ создавай поле, если:
- значение слишком общее и встречается во всём документе (например одиночные «28», «2026»)
- значение относится к ИСПОЛНИТЕЛЮ (тебе как стороне договора) — реквизиты исполнителя должны остаться зашитыми в шаблон
- ты не уверен, что нашёл точное вхождение в текст

Верни СТРОГО JSON без markdown:
{
  "name": "Краткое название шаблона (выведи из содержания, например «Договор оказания услуг»)",
  "description": "1-2 предложения, о чём договор",
  "fields": [
    {
      "key": "snake_case_key",
      "label": "Подпись для UI на русском",
      "sample": "Точная подстрока из текста — как написано, с точностью до пробелов",
      "type": "text" | "textarea",
      "hint": "Подсказка пользователю (опц.)"
    }
  ]
}

Правила формата:
- key — snake_case, осмысленный (client_inn, signatory_full_name, contract_date)
- type:"textarea" — для длинных значений (адреса, длинные наименования)
- Для одной переменной встречающейся несколько раз — одно поле (значение во всех местах одно и то же)`;

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
  /** Короткие неоднозначные значения, встречающиеся часто, не используем
   *  для автозамены (но поле всё равно создаём). */
  minSampleLen?: number;
  maxOccurrencesIfShort?: number;
}

interface BuildOutput {
  replacements: ReplacementRule[];
  /** Поля, у которых получилось построить хотя бы одно правило — их и
   *  показываем пользователю. Остальные молча выкидываем. */
  acceptedFields: AIField[];
}

/**
 * Строит правила замены для каждого поля. Если sample не находится в XML
 * как substring какого-нибудь <w:t>, поле выкидывается — без шумных
 * warnings, потому что это обычно «галлюцинация» ИИ (он подставил значение
 * по памяти, а в документе его нет).
 */
export function buildReplacementsFromFields(
  xml: string,
  fields: AIField[],
  opts: BuildRulesOptions = {}
): BuildOutput {
  const minSampleLen = opts.minSampleLen ?? 4;
  const maxOccIfShort = opts.maxOccurrencesIfShort ?? 5;

  const matches = findWtMatches(xml);
  const replacements: ReplacementRule[] = [];
  const acceptedFields: AIField[] = [];
  const seenFinds = new Set<string>();

  for (const f of fields) {
    const sample = (f.sample ?? "").trim();
    if (!sample) continue;

    // Защита от коротких неоднозначных значений (например одиночное «28»)
    let occurrencesInDoc = 0;
    for (const wt of matches) {
      if (decodeXml(wt.text).includes(sample)) occurrencesInDoc++;
    }
    if (sample.length < minSampleLen && occurrencesInDoc > maxOccIfShort) {
      // короткий sample — поле всё равно полезно, просто без автозамены
      acceptedFields.push(f);
      continue;
    }

    let appliedThis = 0;
    for (const wt of matches) {
      const decoded = decodeXml(wt.text);
      if (!decoded.includes(sample)) continue;
      const newDecoded = decoded.split(sample).join(`{{${f.key}}}`);
      const newEscaped = escapeXml(newDecoded);
      const newWt = `<w:t${wt.attrs}>${newEscaped}</w:t>`;
      if (seenFinds.has(wt.fullMatch)) continue;
      seenFinds.add(wt.fullMatch);
      replacements.push({ find: wt.fullMatch, replace: newWt, count: null });
      appliedThis++;
    }
    // Если sample не найден ни в одном <w:t> — поле выкидываем (галлюцинация ИИ).
    if (appliedThis > 0) acceptedFields.push(f);
  }

  return { replacements, acceptedFields };
}

/** Проверяет, действительно ли каждое sample встречается в plain-text.
 *  Это первый барьер от галлюцинаций ИИ. */
function filterFieldsByPlainText(plainText: string, fields: AIField[]): AIField[] {
  const normalized = plainText.replace(/\s+/g, " ");
  const out: AIField[] = [];
  for (const f of fields) {
    const sample = (f.sample ?? "").trim();
    if (!sample) continue;
    const normSample = sample.replace(/\s+/g, " ");
    if (normalized.includes(normSample)) out.push(f);
  }
  return out;
}

export async function analyzeAndBuildTemplate(
  plainText: string,
  xml: string
): Promise<AnalyzedTemplate> {
  const ai = await analyzeContractText(plainText);

  // Фильтр 1: sample должен быть в plain-text
  const realFields = filterFieldsByPlainText(plainText, ai.fields);

  // Фильтр 2: для sample строим правило замены, или поле выкидываем
  const { replacements, acceptedFields } = buildReplacementsFromFields(xml, realFields);

  const fields: FieldDef[] = acceptedFields.map((f) => ({
    key: f.key,
    label: f.label,
    placeholder: f.sample,
    type: f.type ?? "text",
    hint: f.hint,
  }));

  return {
    name: ai.name || "Шаблон договора",
    description: ai.description || "",
    fields,
    replacements,
    computed_fields: [],
    warnings: [],
  };
}
