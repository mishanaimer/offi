import { NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const VALID_REACTIONS = new Set(["thumbs_up", "thumbs_down"]);
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export async function POST(req: NextRequest) {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return new Response("unauthorized", { status: 401 });

  const body = await req.json().catch(() => ({}));
  const messageId = String(body.messageId ?? "").trim();
  const reaction = body.reaction === null ? null : String(body.reaction ?? "").trim();

  if (!UUID_RE.test(messageId)) {
    return Response.json({ error: "invalid message id" }, { status: 400 });
  }
  if (reaction !== null && !VALID_REACTIONS.has(reaction)) {
    return Response.json({ error: "invalid reaction" }, { status: 400 });
  }

  const { data: me } = await supabase
    .from("users")
    .select("company_id")
    .eq("id", user.id)
    .maybeSingle();
  if (!me?.company_id) return Response.json({ error: "no company" }, { status: 404 });

  // Снятие реакции
  if (reaction === null) {
    const { error } = await supabase
      .from("message_reactions")
      .delete()
      .match({ message_id: messageId, user_id: user.id });
    if (error) return Response.json({ error: error.message }, { status: 500 });
    return Response.json({ ok: true, reaction: null });
  }

  // Установка / переключение реакции
  const { error } = await supabase
    .from("message_reactions")
    .upsert(
      {
        message_id: messageId,
        user_id: user.id,
        company_id: me.company_id,
        reaction,
      },
      { onConflict: "message_id,user_id" }
    );

  if (error) return Response.json({ error: error.message }, { status: 500 });
  return Response.json({ ok: true, reaction });
}
