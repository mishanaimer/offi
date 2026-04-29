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

  type Rule = { find: string; replace: string; count: number | null };
  const newRules: Rule[] = [];
  const seen = new Set<string>();
  let applied = 0;

  for (const edit of edits) {
    let found = false;
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
    if (found) applied++;
  }

  // Из существующих replacements выбрасываем правила для удалённых ключей —
  // ищем по `replace`, содержащему {{key}}.
  const existing = Array.isArray(resolved.config.replacements) ? resolved.config.replacements : [];
  let dropped = 0;
  let filtered = existing;
  if (removedKeys.length > 0) {
    const removedRe = new RegExp(`\\{\\{(?:${removedKeys.join("|")})\\}\\}`);
    filtered = existing.filter((r) => {
      const drop = typeof r.replace === "string" && removedRe.test(r.replace);
      if (drop) dropped++;
      return !drop;
    });
  }

  if (newRules.length === 0 && dropped === 0) {
    return Response.json({
      ok: true,
      applied: 0,
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

  return Response.json({ ok: true, applied: applied + dropped, dropped });
}
