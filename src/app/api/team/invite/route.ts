import { NextRequest } from "next/server";
import { createClient, createServiceClient } from "@/lib/supabase/server";
import { getPlan } from "@/lib/plans";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return new Response("unauthorized", { status: 401 });

  const body = await req.json().catch(() => ({}));
  const email = String(body.email ?? "").trim().toLowerCase();
  const role = ["admin", "member"].includes(body.role) ? body.role : "member";
  const fullName = typeof body.full_name === "string" ? body.full_name.trim() : null;
  const departmentId = typeof body.department_id === "string" ? body.department_id : null;
  const position = typeof body.position === "string" ? body.position.trim() : null;

  if (!email || !/^\S+@\S+\.\S+$/.test(email)) {
    return Response.json({ error: "invalid_email" }, { status: 400 });
  }

  const { data: me } = await supabase
    .from("users")
    .select("role, company:companies(id, plan)")
    .eq("id", user.id)
    .single();

  if (me?.role !== "owner" && me?.role !== "admin") {
    return Response.json({ error: "forbidden" }, { status: 403 });
  }
  const company = (me as any).company;

  // лимит
  const service = createServiceClient();
  const { count } = await service
    .from("users")
    .select("id", { count: "exact", head: true })
    .eq("company_id", company.id);
  const limit = getPlan(company.plan).limits.employees;
  if ((count ?? 0) >= limit) {
    return Response.json(
      { error: "limit_exceeded", detail: `Достигнут лимит сотрудников (${limit}) по текущему тарифу.` },
      { status: 402 }
    );
  }

  // invite (admin API, требует SUPABASE_SERVICE_ROLE_KEY)
  let authUserId: string | null = null;
  try {
    const { data, error } = await service.auth.admin.inviteUserByEmail(email, {
      data: { full_name: fullName, invited_company_id: company.id, invited_role: role },
    });
    if (error) throw error;
    authUserId = data.user?.id ?? null;
  } catch (e: any) {
    // если пользователь уже существует — найдём и просто привяжем к компании
    const msg = e?.message ?? "";
    if (!/already\s+registered|User already registered|duplicate key/i.test(msg)) {
      return Response.json({ error: "invite_failed", detail: msg }, { status: 500 });
    }
    const { data: list } = await service.auth.admin.listUsers({ page: 1, perPage: 200 });
    authUserId = list?.users?.find((u) => u.email === email)?.id ?? null;
    if (!authUserId) return Response.json({ error: "user_lookup_failed" }, { status: 500 });
  }

  // upsert профиля + company
  const { error: upErr } = await service
    .from("users")
    .upsert(
      {
        id: authUserId,
        email,
        full_name: fullName,
        company_id: company.id,
        role,
        department_id: departmentId,
        position,
      },
      { onConflict: "id" }
    );
  if (upErr) return Response.json({ error: "profile_upsert_failed", detail: upErr.message }, { status: 500 });

  return Response.json({ ok: true, user_id: authUserId });
}
