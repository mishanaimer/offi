import { NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function startOfWeek(d = new Date()): string {
  const day = d.getUTCDay() || 7; // 1..7, Mon=1
  const monday = new Date(d);
  monday.setUTCDate(d.getUTCDate() - day + 1);
  return monday.toISOString().slice(0, 10);
}

// GET: проверить, нужно ли показать опрос текущему пользователю
export async function GET() {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return Response.json({ show: false });

  const { data: me } = await supabase
    .from("users")
    .select("company_id, companies:companies(plan, pilot_until)")
    .eq("id", user.id)
    .maybeSingle();

  const company = (me as any)?.companies;
  if (!company || company.plan !== "pilot") return Response.json({ show: false });

  const week = startOfWeek();
  const { data: existing } = await supabase
    .from("pilot_feedback")
    .select("id")
    .eq("user_id", user.id)
    .eq("anchor", "weekly")
    .eq("week_starting", week)
    .maybeSingle();

  return Response.json({ show: !existing, week });
}

// POST: сохранить ответы
export async function POST(req: NextRequest) {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return new Response("unauthorized", { status: 401 });

  const body = await req.json().catch(() => ({}));
  const { q_usage, q_worked, q_pain } = body;

  const { data: me } = await supabase
    .from("users")
    .select("company_id")
    .eq("id", user.id)
    .maybeSingle();
  if (!me?.company_id) return Response.json({ error: "no company" }, { status: 404 });

  const week = startOfWeek();
  const { error } = await supabase.from("pilot_feedback").insert({
    company_id: me.company_id,
    user_id: user.id,
    anchor: "weekly",
    week_starting: week,
    q_usage: typeof q_usage === "string" ? q_usage.slice(0, 32) : null,
    q_worked: typeof q_worked === "string" ? q_worked.slice(0, 2000) : null,
    q_pain: typeof q_pain === "string" ? q_pain.slice(0, 2000) : null,
  });
  if (error) return Response.json({ error: error.message }, { status: 500 });

  return Response.json({ ok: true });
}
