import { NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { PLANS } from "@/lib/plans";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return new Response("unauthorized", { status: 401 });

  const body = await req.json().catch(() => ({}));
  const plan = String(body.plan ?? "");
  const billing = body.billing_period === "year" ? "year" : "month";

  if (!Object.keys(PLANS).includes(plan) || plan === "trial") {
    return Response.json({ error: "invalid plan" }, { status: 400 });
  }

  // только admin/owner
  const { data: me } = await supabase.from("users").select("role").eq("id", user.id).maybeSingle();
  if (me?.role !== "owner" && me?.role !== "admin") {
    return Response.json({ error: "forbidden" }, { status: 403 });
  }

  const { data, error } = await supabase
    .from("plan_requests")
    .insert({
      user_id: user.id,
      plan,
      billing_period: billing,
      status: "pending",
      note: typeof body.note === "string" ? body.note.slice(0, 500) : null,
    })
    .select("id")
    .single();

  if (error) return Response.json({ error: error.message }, { status: 500 });
  return Response.json({ ok: true, id: data.id });
}
