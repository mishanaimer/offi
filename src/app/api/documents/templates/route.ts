import { NextRequest } from "next/server";
import JSZip from "jszip";
import { createClient } from "@/lib/supabase/server";
import {
  createCompanyTemplate,
  listCompanyTemplates,
} from "@/lib/contract-generator/registry";
import { mergeRunsInDocumentXml } from "@/lib/contract-generator/merge-runs";
import { analyzeAndBuildTemplate } from "@/lib/contract-generator/ai-analyze";

export const runtime = "nodejs";
export const maxDuration = 120;

export async function GET() {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return Response.json({ templates: [] });

  const { data: profile } = await supabase
    .from("users")
    .select("company_id")
    .eq("id", user.id)
    .single();
  const companyId = profile?.company_id as string | undefined;
  if (!companyId) return Response.json({ templates: [] });

  const templates = await listCompanyTemplates(companyId);
  return Response.json({ templates });
}

export async function POST(req: NextRequest) {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return new Response("unauthorized", { status: 401 });

  const { data: profile } = await supabase
    .from("users")
    .select("company_id")
    .eq("id", user.id)
    .single();
  const companyId = profile?.company_id as string | undefined;
  if (!companyId) return new Response("no company", { status: 400 });

  const form = await req.formData();
  const file = form.get("file") as File | null;
  const userTitle = (form.get("name") as string | null)?.trim();
  if (!file) return new Response("no file", { status: 400 });
  if (!file.name.toLowerCase().endsWith(".docx")) {
    return new Response("принимаются только .docx", { status: 400 });
  }

  const original = Buffer.from(await file.arrayBuffer());

  // 1. merge-runs предобработка — иначе AI/replacement-движок не найдёт фразы.
  let mergedBuffer: Buffer;
  let mergedXml: string;
  try {
    const zip = await JSZip.loadAsync(original);
    const docXml = zip.file("word/document.xml");
    if (!docXml) return new Response("не валидный .docx (нет word/document.xml)", { status: 400 });
    const xmlOriginal = await docXml.async("string");
    const { xml: merged } = mergeRunsInDocumentXml(xmlOriginal);
    mergedXml = merged;
    zip.file("word/document.xml", merged);
    mergedBuffer = await zip.generateAsync({ type: "nodebuffer", compression: "DEFLATE" });
  } catch (e) {
    return new Response("ошибка распаковки .docx: " + (e as Error).message, { status: 400 });
  }

  // 2. plain-text для ИИ
  let plainText: string;
  try {
    const mammoth = await import("mammoth");
    const { value } = await mammoth.extractRawText({ buffer: mergedBuffer });
    plainText = value;
    if (!plainText || plainText.trim().length < 50) {
      return new Response("не удалось извлечь текст из договора", { status: 400 });
    }
  } catch (e) {
    return new Response("ошибка извлечения текста: " + (e as Error).message, { status: 500 });
  }

  // 3. AI-анализ
  let analyzed;
  try {
    analyzed = await analyzeAndBuildTemplate(plainText, mergedXml);
  } catch (e) {
    return new Response("ошибка ИИ-анализа: " + (e as Error).message, { status: 500 });
  }

  // 4. Сохранить в БД + Storage
  try {
    const { id } = await createCompanyTemplate({
      companyId,
      userId: user.id,
      name: userTitle || analyzed.name,
      description: analyzed.description,
      sourceFilename: file.name,
      fields: analyzed.fields,
      replacements: analyzed.replacements,
      computed_fields: analyzed.computed_fields,
      warnings: analyzed.warnings,
      docxBuffer: mergedBuffer,
    });
    return Response.json({
      id,
      name: userTitle || analyzed.name,
      description: analyzed.description,
      fieldsCount: analyzed.fields.length,
      replacementsCount: analyzed.replacements.length,
      warnings: analyzed.warnings,
    });
  } catch (e) {
    return new Response("ошибка сохранения: " + (e as Error).message, { status: 500 });
  }
}
