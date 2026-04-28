import { NextRequest } from "next/server";
import { parseRequisites } from "@/lib/contract-generator/parse-requisites";

export const runtime = "nodejs";
export const maxDuration = 30;

// Универсальный парсер карточки контрагента: принимает либо файл
// (PDF/DOCX/TXT/CSV/MD/HTML), либо чистый текст. Извлекает текст,
// прогоняет через regex-парсер реквизитов и возвращает оба:
// сам текст (чтобы юзер видел, что выгрузилось) и распознанные поля.
export async function POST(req: NextRequest) {
  const ct = req.headers.get("content-type") ?? "";

  let text = "";
  let sourceName: string | null = null;

  try {
    if (ct.includes("multipart/form-data")) {
      const form = await req.formData();
      const file = form.get("file") as File | null;
      const inlineText = (form.get("text") as string | null) ?? "";
      if (file) {
        sourceName = file.name;
        const buf = Buffer.from(await file.arrayBuffer());
        text = await extractText(file.name, buf);
      } else if (inlineText) {
        text = inlineText;
      }
    } else {
      const body = (await req.json()) as { text?: string };
      text = body.text ?? "";
    }
  } catch (err) {
    return new Response("Не удалось прочитать запрос: " + (err as Error).message, { status: 400 });
  }

  if (!text || text.trim().length < 5) {
    return new Response("Пустой текст или не удалось извлечь данные из файла", { status: 400 });
  }

  const parsed = parseRequisites(text);
  return Response.json({ text, parsed, source: sourceName });
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
  // Фоллбек: пробуем как utf-8 текст
  return buf.toString("utf8");
}
