import { NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return new Response("unauthorized", { status: 401 });

  const body = (await req.json()) as { content?: string; source?: string };
  const content = (body.content ?? "").trim();
  if (!content) return new Response("empty note", { status: 400 });

  // обновим last_contact_at
  await supabase.from("clients").update({ last_contact_at: new Date().toISOString() }).eq("id", params.id);

  const { data, error } = await supabase
    .from("client_notes")
    .insert({
      client_id: params.id,
      user_id: user.id,
      content: content.slice(0, 4000),
      source: body.source ?? "manual",
    })
    .select("id, content, source, created_at, user_id")
    .single();
  if (error) return new Response(error.message, { status: 500 });
  return Response.json({ note: data });
}

export async function DELETE(req: NextRequest, { params }: { params: { id: string } }) {
  const supabase = createClient();
  const { searchParams } = new URL(req.url);
  const noteId = searchParams.get("noteId");
  if (!noteId) return new Response("noteId required", { status: 400 });

  const { error } = await supabase
    .from("client_notes")
    .delete()
    .eq("id", noteId)
    .eq("client_id", params.id);
  if (error) return new Response(error.message, { status: 500 });
  return Response.json({ ok: true });
}
