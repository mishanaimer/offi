import { NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { resolveTemplate } from "@/lib/contract-generator/registry";
import { generateTemplatePreviewDocx } from "@/lib/contract-generator/generator";

export const runtime = "nodejs";
export const maxDuration = 30;

// Возвращает «шаблонную» версию .docx, где найденные ИИ переменные
// уже заменены на литеральные плейсхолдеры вида {{client_inn}}.
// Клиент рендерит его через docx-preview, получая постраничный
// просмотр с реальной вёрсткой Word.
export async function GET(_req: NextRequest, { params }: { params: { id: string } }) {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return new Response("unauthorized", { status: 401 });

  const { data: profile } = await supabase
    .from("users")
    .select("company_id")
    .eq("id", user.id)
    .single();
  const companyId = (profile?.company_id as string) ?? null;

  try {
    const { templateBuffer, config } = await resolveTemplate(params.id, companyId);
    const preview = await generateTemplatePreviewDocx(templateBuffer, config);

    // Дополнительно достаём plain-text оригинала шаблона (без замен) —
    // чтобы UI мог открыть его в редакторе текста.
    const mammoth = await import("mammoth");
    const { value: plainText } = await mammoth.extractRawText({ buffer: templateBuffer });

    return Response.json({
      docxBase64: preview.toString("base64"),
      plainText,
    });
  } catch (err) {
    return new Response((err as Error).message, { status: 404 });
  }
}
