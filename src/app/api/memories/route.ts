import { NextRequest } from "next/server";
import { createClient, createServiceClient } from "@/lib/supabase/server";
import { embed } from "@/lib/embeddings";
import { getPlan } from "@/lib/plans";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** POST { content, kind? }  — добавить ручной факт (с embedding) */
export async function POST(req: NextRequest) {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return new Response("unauthorized", { status: 401 });

  const body = await req.json().catch(() => ({}));
  const content = typeof body.content === "string" ? body.content.trim() : "";
  if (!content) return Response.json({ error: "empty" }, { status: 400 });
  const kind = ["fact", "preference", "agreement", "rule"].includes(body.kind) ? body.kind : "fact";

  const { data: profile } = await supabase
    .from("users")
    .select("company:companies(id, plan)")
    .eq("id", user.id)
    .single();
  const company = profile?.company as any;
  if (!company) return new Response("no company", { status: 400 });

  // лимит по тарифу
  const service = createServiceClient();
  const { count } = await service
    .from("memories")
    .select("id", { count: "exact", head: true })
    .eq("company_id", company.id);
  const limit = getPlan(company.plan).limits.memories;
  if ((count ?? 0) >= limit) {
    return Response.json(
      { error: "limit_exceeded", detail: `Достигнут лимит памяти (${limit}) по текущему тарифу.` },
      { status: 402 }
    );
  }

  let embedding: number[] | null = null;
  try {
    embedding = await embed(content);
  } catch (e) {
    console.error("memory embed failed", e);
  }

  const { data, error } = await service
    .from("memories")
    .insert({
      company_id: company.id,
      content: content.slice(0, 1000),
      kind,
      source: "manual",
      created_by: user.id,
      embedding: (embedding ?? null) as any,
    })
    .select("id, content, kind, source, created_at")
    .single();

  if (error) return Response.json({ error: error.message }, { status: 500 });
  return Response.json({ memory: data });
}

/** PATCH /api/memories?id=... { content, kind? } — обновить */
export async function PATCH(req: NextRequest) {
  const url = new URL(req.url);
  const id = url.searchParams.get("id");
  if (!id) return Response.json({ error: "id required" }, { status: 400 });

  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return new Response("unauthorized", { status: 401 });

  const body = await req.json().catch(() => ({}));
  const content = typeof body.content === "string" ? body.content.trim() : null;
  if (!content) return Response.json({ error: "empty" }, { status: 400 });
  const kind = ["fact", "preference", "agreement", "rule"].includes(body.kind) ? body.kind : undefined;

  let embedding: number[] | null = null;
  try {
    embedding = await embed(content);
  } catch {}

  const service = createServiceClient();
  const update: Record<string, any> = { content: content.slice(0, 1000) };
  if (kind) update.kind = kind;
  if (embedding) update.embedding = embedding;

  // гарантируем company_scope — через users.company_id
  const { data: profile } = await supabase
    .from("users")
    .select("company_id")
    .eq("id", user.id)
    .single();

  const { error } = await service
    .from("memories")
    .update(update)
    .eq("id", id)
    .eq("company_id", profile?.company_id ?? "");

  if (error) return Response.json({ error: error.message }, { status: 500 });
  return Response.json({ ok: true });
}

/** DELETE /api/memories?id=... */
export async function DELETE(req: NextRequest) {
  const url = new URL(req.url);
  const id = url.searchParams.get("id");
  if (!id) return Response.json({ error: "id required" }, { status: 400 });

  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return new Response("unauthorized", { status: 401 });

  const { data: profile } = await supabase
    .from("users")
    .select("company_id")
    .eq("id", user.id)
    .single();

  const service = createServiceClient();
  const { error } = await service
    .from("memories")
    .delete()
    .eq("id", id)
    .eq("company_id", profile?.company_id ?? "");
  if (error) return Response.json({ error: error.message }, { status: 500 });
  return Response.json({ ok: true });
}
