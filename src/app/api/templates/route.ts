import { NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  const supabase = createClient();
  const { data, error } = await supabase
    .from("templates")
    .select("id, name, body, variables, created_at, updated_at")
    .order("updated_at", { ascending: false, nullsFirst: false })
    .order("created_at", { ascending: false });
  if (error) return new Response(error.message, { status: 500 });
  return Response.json({ templates: data ?? [] });
}

export async function POST(req: NextRequest) {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return new Response("unauthorized", { status: 401 });

  const body = (await req.json()) as { name?: string; body?: string };
  const name = (body.name ?? "").trim();
  const tplBody = body.body ?? "";
  if (!name) return new Response("name required", { status: 400 });
  if (!tplBody.trim()) return new Response("body required", { status: 400 });

  const { data, error } = await supabase
    .from("templates")
    .insert({ name, body: tplBody })
    .select("id, name, body, variables, created_at, updated_at")
    .single();
  if (error) return new Response(error.message, { status: 500 });
  return Response.json({ template: data });
}
