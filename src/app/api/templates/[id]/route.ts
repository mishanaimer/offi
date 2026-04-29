import { NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  const supabase = createClient();
  const body = (await req.json()) as { name?: string; body?: string };
  const update: Record<string, unknown> = {};
  if (typeof body.name === "string" && body.name.trim()) update.name = body.name.trim();
  if (typeof body.body === "string") update.body = body.body;
  if (Object.keys(update).length === 0) {
    return new Response("nothing to update", { status: 400 });
  }
  const { data, error } = await supabase
    .from("templates")
    .update(update)
    .eq("id", params.id)
    .select("id, name, body, variables, created_at, updated_at")
    .single();
  if (error) return new Response(error.message, { status: 500 });
  return Response.json({ template: data });
}

export async function DELETE(_req: NextRequest, { params }: { params: { id: string } }) {
  const supabase = createClient();
  const { error } = await supabase.from("templates").delete().eq("id", params.id);
  if (error) return new Response(error.message, { status: 500 });
  return Response.json({ ok: true });
}
