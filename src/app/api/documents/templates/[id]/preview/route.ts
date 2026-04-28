import { NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { resolveTemplate } from "@/lib/contract-generator/registry";

export const runtime = "nodejs";
export const maxDuration = 30;

// Возвращает HTML-превью исходного .docx — чтобы пользователь видел
// сам шаблон в карточке (а не только список найденных полей).
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
    const { templateBuffer } = await resolveTemplate(params.id, companyId);
    const mammoth = await import("mammoth");
    const { value } = await mammoth.convertToHtml({ buffer: templateBuffer });
    return Response.json({ html: value });
  } catch (err) {
    return new Response((err as Error).message, { status: 404 });
  }
}
