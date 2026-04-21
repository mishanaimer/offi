import { NextRequest } from "next/server";
import { createClient, createServiceClient } from "@/lib/supabase/server";

export const runtime = "nodejs";

type Body = {
  companyName: string;
  assistantName: string;
  brandAccent?: string;
};

/**
 * Атомарный онбординг: создать компанию, привязать пользователя, создать дефолтный AI-канал.
 * Клиент не может сделать это напрямую из-за RLS (SELECT companies требует company_id,
 * которого ещё нет до момента INSERT). Используем service role.
 */
export async function POST(req: NextRequest) {
  const body = (await req.json()) as Body;
  if (!body.companyName?.trim() || !body.assistantName?.trim()) {
    return new Response("invalid payload", { status: 400 });
  }

  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return new Response("unauthorized", { status: 401 });

  const service = createServiceClient();

  // если у пользователя уже есть компания — не создаём новую
  const { data: existing } = await service
    .from("users")
    .select("company_id")
    .eq("id", user.id)
    .single();
  if (existing?.company_id) {
    return Response.json({ ok: true, companyId: existing.company_id, existed: true });
  }

  const { data: company, error: cErr } = await service
    .from("companies")
    .insert({
      name: body.companyName.trim(),
      assistant_name: body.assistantName.trim(),
      brand_accent: body.brandAccent ?? "#0259DD",
    })
    .select()
    .single();
  if (cErr) return new Response(cErr.message, { status: 500 });

  const { error: uErr } = await service
    .from("users")
    .update({ company_id: company.id })
    .eq("id", user.id);
  if (uErr) return new Response(uErr.message, { status: 500 });

  await service.from("channels").insert({
    company_id: company.id,
    name: "Основной чат",
    type: "ai",
    created_by: user.id,
  });

  return Response.json({ ok: true, companyId: company.id });
}
