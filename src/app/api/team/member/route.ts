import { NextRequest } from "next/server";
import { createClient, createServiceClient } from "@/lib/supabase/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** PATCH /api/team/member?id=<user_id>  — обновить role/department/position */
export async function PATCH(req: NextRequest) {
  const id = new URL(req.url).searchParams.get("id");
  if (!id) return Response.json({ error: "id required" }, { status: 400 });

  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return new Response("unauthorized", { status: 401 });

  const { data: me } = await supabase
    .from("users")
    .select("role, company_id")
    .eq("id", user.id)
    .single();
  if (me?.role !== "owner" && me?.role !== "admin") {
    return Response.json({ error: "forbidden" }, { status: 403 });
  }

  const body = await req.json().catch(() => ({}));
  const update: Record<string, any> = {};
  if (["admin", "member"].includes(body.role)) update.role = body.role;
  if (body.department_id === null || typeof body.department_id === "string")
    update.department_id = body.department_id;
  if (typeof body.position === "string") update.position = body.position.trim().slice(0, 120);
  if (typeof body.bio === "string") update.bio = body.bio.trim().slice(0, 600);
  if (typeof body.full_name === "string") update.full_name = body.full_name.trim().slice(0, 120);

  if (!Object.keys(update).length) return Response.json({ ok: true });

  const service = createServiceClient();
  const { error } = await service
    .from("users")
    .update(update)
    .eq("id", id)
    .eq("company_id", me.company_id);
  if (error) return Response.json({ error: error.message }, { status: 500 });
  return Response.json({ ok: true });
}

/** DELETE /api/team/member?id=<user_id> — убрать из компании (не удаляет auth-аккаунт) */
export async function DELETE(req: NextRequest) {
  const id = new URL(req.url).searchParams.get("id");
  if (!id) return Response.json({ error: "id required" }, { status: 400 });

  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return new Response("unauthorized", { status: 401 });
  if (id === user.id) return Response.json({ error: "cannot remove self" }, { status: 400 });

  const { data: me } = await supabase
    .from("users")
    .select("role, company_id")
    .eq("id", user.id)
    .single();
  if (me?.role !== "owner" && me?.role !== "admin") {
    return Response.json({ error: "forbidden" }, { status: 403 });
  }

  const service = createServiceClient();
  const { error } = await service
    .from("users")
    .update({ company_id: null })
    .eq("id", id)
    .eq("company_id", me.company_id);
  if (error) return Response.json({ error: error.message }, { status: 500 });
  return Response.json({ ok: true });
}
