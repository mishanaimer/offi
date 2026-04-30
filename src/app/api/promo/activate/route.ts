import { NextRequest } from "next/server";
import { createClient, createServiceClient } from "@/lib/supabase/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const REASON_RU: Record<string, string> = {
  invalid_code: "Промокод не найден или отключён",
  limit_reached: "Лимит активаций промокода исчерпан",
  already_founder: "Компания уже участвует в Founders-программе",
};

export async function POST(req: NextRequest) {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return new Response("unauthorized", { status: 401 });

  const body = await req.json().catch(() => ({}));
  const code = String(body.code ?? "").trim();
  if (!code) return Response.json({ error: "Введите промокод" }, { status: 400 });

  const { data: me } = await supabase
    .from("users")
    .select("role, company_id")
    .eq("id", user.id)
    .maybeSingle();

  if (!me?.company_id) return Response.json({ error: "Компания не найдена" }, { status: 404 });
  if (me.role !== "owner" && me.role !== "admin") {
    return Response.json({ error: "Промокод может активировать только владелец или администратор" }, { status: 403 });
  }

  const admin = createServiceClient();
  const { data, error } = await admin
    .rpc("activate_promo_code", { p_code: code.toUpperCase(), p_company_id: me.company_id });

  if (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }

  const row = Array.isArray(data) ? data[0] : data;
  if (!row?.ok) {
    const reason = String(row?.reason ?? "invalid_code");
    return Response.json({ error: REASON_RU[reason] ?? reason }, { status: 400 });
  }

  return Response.json({
    ok: true,
    plan: row.plan,
    pilot_until: row.pilot_until,
    is_founder: row.is_founder ?? false,
  });
}
