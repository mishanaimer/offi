import { NextRequest } from "next/server";
import { createClient, createServiceClient } from "@/lib/supabase/server";
import { resolveTemplate } from "@/lib/contract-generator/registry";

export const runtime = "nodejs";
export const maxDuration = 30;

// Сохраняет правки шаблона:
//  - edits: [{ old, new }] — построчные текстовые правки (применяются как
//    replacement-правила к <w:t>...</w:t> в word/document.xml).
//  - removedKeys: string[] — ключи плейсхолдеров, которые пользователь
//    удалил из документа в редакторе. Для них из config.replacements
//    выкидываем все правила, чей `replace` содержит {{key}}, иначе на
//    генерации эти поля снова появятся в старых местах.
//
// Это даёт пользователю «поправить опечатку», «изменить формулировку»
// и «удалить/переместить карточку» без ручного редактирования XML.
//
// Body: { edits?: [{old, new}], removedKeys?: string[] }
export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return new Response("unauthorized", { status: 401 });
  const { data: profile } = await supabase
    .from("users")
    .select("company_id")
    .eq("id", user.id)
    .single();
  const companyId = (profile?.company_id as string) ?? null;
  if (!companyId) return new Response("no company", { status: 400 });

  const body = (await req.json()) as {
    edits?: Array<{ old: string; new: string }>;
    removedKeys?: string[];
  };
  const edits = (body.edits ?? []).filter(
    (e) => e && typeof e.old === "string" && typeof e.new === "string" && e.old !== e.new
  );
  const removedKeys = (body.removedKeys ?? []).filter(
    (k) => typeof k === "string" && /^\w+$/.test(k)
  );
  if (edits.length === 0 && removedKeys.length === 0) {
    return Response.json({ ok: true, applied: 0 });
  }

  // Загружаем текущие данные шаблона, чтобы понять что в нём есть.
  let resolved;
  try {
    resolved = await resolveTemplate(params.id, companyId);
  } catch (err) {
    return new Response((err as Error).message, { status: 404 });
  }

  // Для каждой правки строим replacement-правило вида
  // {find:"<w:t...>old</w:t>", replace:"<w:t...>new</w:t>"} — для всех
  // <w:t>, в которых встречается old. Если old не найдено — пропускаем.
  const xmlBuffer = resolved.templateBuffer;
  const JSZip = (await import("jszip")).default;
  const zip = await JSZip.loadAsync(xmlBuffer);
  const docXml = zip.file("word/document.xml");
  if (!docXml) return new Response("В шаблоне нет word/document.xml", { status: 500 });
  const xml = await docXml.async("string");

  const W_T_RE = /<w:t(\s[^>]*)?>([^<]*)<\/w:t>/g;
  const decode = (s: string) =>
    s.replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&quot;/g, '"').replace(/&apos;/g, "'").replace(/&amp;/g, "&");
  const escape = (s: string) =>
    s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

  type Wt = { full: string; attrs: string; text: string };
  const wts: Wt[] = [];
  let m: RegExpExecArray | null;
  W_T_RE.lastIndex = 0;
  while ((m = W_T_RE.exec(xml)) !== null) {
    wts.push({ full: m[0], attrs: m[1] ?? "", text: m[2] });
  }

  // Из существующих replacements (find→replace, где replace содержит {{key}})
  // достаём sample-текст для каждого ключа. Это нужно потому, что в исходном
  // XML стоит сэмпл («ООО Айсистемс»), а не {{key}} — и если пользователь в
  // редакторе двигает плейсхолдер, диф приходит в форме «...{{key}}...»,
  // которой в исходном XML нет. Через sampleByKey мы переводим обратно.
  const placeholderRe = /\{\{(\w+)\}\}/g;
  const wtSimple = /^<w:t(\s[^>]*)?>([^<]*)<\/w:t>$/;
  const sampleByKey: Record<string, string> = {};
  const existing0 = Array.isArray(resolved.config.replacements)
    ? resolved.config.replacements
    : [];
  for (const rule of existing0) {
    if (typeof rule.find !== "string" || typeof rule.replace !== "string") continue;
    const mf = rule.find.match(wtSimple);
    const mr = rule.replace.match(wtSimple);
    if (!mf || !mr) continue;
    const findText = decode(mf[2]);
    const repText = decode(mr[2]);
    placeholderRe.lastIndex = 0;
    let mm: RegExpExecArray | null;
    while ((mm = placeholderRe.exec(repText)) !== null) {
      const key = mm[1];
      if (sampleByKey[key]) continue; // первая встреча выигрывает
      const before = repText.slice(0, mm.index);
      const after = repText.slice(mm.index + mm[0].length);
      if (findText.startsWith(before) && findText.endsWith(after)) {
        const sample = findText.slice(before.length, findText.length - after.length);
        if (sample) sampleByKey[key] = sample;
      }
    }
  }

  type Rule = { find: string; replace: string; count: number | null };
  const newRules: Rule[] = [];
  const seen = new Set<string>();
  const notFound: Array<{ old: string; reason: string }> = [];
  let applied = 0;

  for (const edit of edits) {
    let found = false;

    // 1. Прямой поиск.
    for (const wt of wts) {
      const decoded = decode(wt.text);
      if (!decoded.includes(edit.old)) continue;
      const replaced = decoded.split(edit.old).join(edit.new);
      const newWt = `<w:t${wt.attrs}>${escape(replaced)}</w:t>`;
      if (seen.has(wt.full)) continue;
      seen.add(wt.full);
      newRules.push({ find: wt.full, replace: newWt, count: null });
      found = true;
    }

    // 2. Фолбэк: заменяем {{key}} → sample и ищем заново. Это обрабатывает
    // перемещение/удаление существующих плейсхолдеров — в исходном XML на
    // их месте sample-текст.
    if (!found && /\{\{\w+\}\}/.test(edit.old)) {
      let translatedOld = edit.old;
      let canTranslate = true;
      placeholderRe.lastIndex = 0;
      let mm: RegExpExecArray | null;
      while ((mm = placeholderRe.exec(edit.old)) !== null) {
        const k = mm[1];
        const s = sampleByKey[k];
        if (!s) {
          canTranslate = false;
          break;
        }
        translatedOld = translatedOld.split(`{{${k}}}`).join(s);
      }
      if (canTranslate) {
        for (const wt of wts) {
          const decoded = decode(wt.text);
          if (!decoded.includes(translatedOld)) continue;
          const replaced = decoded.split(translatedOld).join(edit.new);
          const newWt = `<w:t${wt.attrs}>${escape(replaced)}</w:t>`;
          if (seen.has(wt.full)) continue;
          seen.add(wt.full);
          newRules.push({ find: wt.full, replace: newWt, count: null });
          found = true;
        }
      }
    }

    if (found) applied++;
    else notFound.push({ old: edit.old.slice(0, 80), reason: "не найдено в шаблоне" });
  }

  // Из существующих replacements выбрасываем правила для удалённых ключей —
  // ищем по `replace`, содержащему {{key}}.
  let dropped = 0;
  let filtered = existing0;
  if (removedKeys.length > 0) {
    const removedRe = new RegExp(`\\{\\{(?:${removedKeys.join("|")})\\}\\}`);
    filtered = existing0.filter((r) => {
      const drop = typeof r.replace === "string" && removedRe.test(r.replace);
      if (drop) dropped++;
      return !drop;
    });
  }

  if (newRules.length === 0 && dropped === 0) {
    return Response.json({
      ok: true,
      applied: 0,
      notFound,
      message:
        edits.length > 0
          ? "Изменения не найдены в тексте шаблона"
          : "Нечего сохранять",
    });
  }

  // Дописываем новые правила в начало — текстовые правки применяются ДО
  // полевых замен (так правка не съедает плейсхолдер).
  const merged = [...newRules, ...filtered];

  const service = createServiceClient();
  const { error } = await service
    .from("contract_templates")
    .update({ replacements: merged, updated_at: new Date().toISOString() })
    .eq("id", params.id)
    .eq("company_id", companyId);
  if (error) return new Response(error.message, { status: 500 });

  return Response.json({
    ok: true,
    applied: applied + dropped,
    dropped,
    notFound,
  });
}
