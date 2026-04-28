import { NextRequest } from "next/server";
import { parseRequisites } from "@/lib/contract-generator/parse-requisites";
import { aiParseContractorCard } from "@/lib/contract-generator/ai-analyze";

export const runtime = "nodejs";
export const maxDuration = 60;

// Универсальный парсер карточки контрагента: принимает либо файл
// (PDF/DOCX/TXT/CSV/MD/HTML), либо чистый текст. Извлекает текст,
// прогоняет через regex-парсер реквизитов И ИИ-парсер карточки
// (если передан список полей шаблона), мерджит результаты и возвращает:
// { text, parsed }.
export async function POST(req: NextRequest) {
  const ct = req.headers.get("content-type") ?? "";

  let text = "";
  let sourceName: string | null = null;
  let fields: Array<{ key: string; label: string; hint?: string; type?: "text" | "textarea" }> = [];

  try {
    if (ct.includes("multipart/form-data")) {
      const form = await req.formData();
      const file = form.get("file") as File | null;
      const inlineText = (form.get("text") as string | null) ?? "";
      const fieldsJson = (form.get("fields") as string | null) ?? "";
      if (file) {
        sourceName = file.name;
        const buf = Buffer.from(await file.arrayBuffer());
        text = await extractText(file.name, buf);
      } else if (inlineText) {
        text = inlineText;
      }
      if (fieldsJson) {
        try { fields = JSON.parse(fieldsJson); } catch {}
      }
    } else {
      const body = (await req.json()) as { text?: string; fields?: any[] };
      text = body.text ?? "";
      if (Array.isArray(body.fields)) fields = body.fields;
    }
  } catch (err) {
    return new Response("Не удалось прочитать запрос: " + (err as Error).message, { status: 400 });
  }

  if (!text || text.trim().length < 5) {
    return new Response("Пустой текст или не удалось извлечь данные из файла", { status: 400 });
  }

  // Шаг 1: быстрый regex-парсер по фиксированному списку базовых реквизитов
  const regexParsed = parseRequisites(text);

  // Шаг 2: ИИ-парсер с учётом конкретных полей шаблона. Покрывает то,
  // чего не знает regex (нестандартные названия банков, длинные
  // наименования, телефоны, должности, и любые поля специфичные для
  // конкретного шаблона — service_speed, contract_end_date и т.п.)
  let aiParsed: Record<string, string> = {};
  if (fields.length > 0) {
    aiParsed = await aiParseContractorCard(text, fields);
  }

  // Объединяем: regex имеет приоритет для базовых полей (он точнее),
  // ИИ дополняет недостающие. Для полей которых нет в regex — берём ИИ.
  const parsed: Record<string, string> = { ...aiParsed, ...regexParsed };

  return Response.json({
    text,
    parsed,
    source: sourceName,
    counts: {
      regex: Object.keys(regexParsed).length,
      ai: Object.keys(aiParsed).length,
      total: Object.keys(parsed).length,
    },
  });
}

async function extractText(filename: string, buf: Buffer): Promise<string> {
  const ext = filename.split(".").pop()?.toLowerCase() ?? "";
  if (ext === "pdf") {
    const pdf = (await import("pdf-parse")).default;
    return (await pdf(buf)).text;
  }
  if (ext === "docx") {
    const mammoth = await import("mammoth");
    const { value } = await mammoth.extractRawText({ buffer: buf });
    return value;
  }
  if (["txt", "csv", "md", "html", "htm", "tsv"].includes(ext)) {
    return buf.toString("utf8");
  }
  return buf.toString("utf8");
}
