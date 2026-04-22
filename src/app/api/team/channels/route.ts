import { NextRequest } from "next/server";
import { createClient, createServiceClient } from "@/lib/supabase/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * POST { name?, type: 'dm'|'group'|'shared_ai', member_ids: string[] }
 *   dm        — 1-на-1, member_ids = [один другой user_id]. Имя генерируется на клиенте.
 *   group     — групповой, участники без AI
 *   shared_ai — групповой + включение ассистента
 *
 * Автоматически добавляет создателя в channel_members.
 */
export async function POST(req: NextRequest) {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return new Response("unauthorized", { status: 401 });

  const body = await req.json().catch(() => ({}));
  const type = ["dm", "group", "shared_ai"].includes(body.type) ? body.type : "group";
  const memberIds: string[] = Array.isArray(body.member_ids) ? body.member_ids.filter(Boolean) : [];
  const rawName = typeof body.name === "string" ? body.name.trim() : "";

  if (type === "dm" && memberIds.length !== 1) {
    return Response.json({ error: "dm requires exactly one other member" }, { status: 400 });
  }
  if ((type === "group" || type === "shared_ai") && memberIds.length < 1) {
    return Response.json({ error: "group needs members" }, { status: 400 });
  }

  const { data: me } = await supabase
    .from("users")
    .select("company_id, full_name, email")
    .eq("id", user.id)
    .single();
  if (!me?.company_id) return Response.json({ error: "no company" }, { status: 400 });

  // имя канала — для DM клиент назовёт по собеседнику, для group/shared_ai — по name
  const name = rawName || (type === "dm" ? "Личные сообщения" : type === "shared_ai" ? "Общий с ассистентом" : "Новый канал");

  const service = createServiceClient();

  // создаём канал
  const { data: channel, error } = await service
    .from("channels")
    .insert({
      company_id: me.company_id,
      name,
      type,
      created_by: user.id,
    })
    .select()
    .single();
  if (error) return Response.json({ error: error.message }, { status: 500 });

  // добавляем создателя + выбранных участников
  const uniq = Array.from(new Set([user.id, ...memberIds]));
  const memberRows = uniq.map((uid) => ({
    channel_id: channel.id,
    user_id: uid,
    role: uid === user.id ? "owner" : "member",
  }));
  const { error: memErr } = await service.from("channel_members").insert(memberRows);
  if (memErr) return Response.json({ error: memErr.message }, { status: 500 });

  return Response.json({ channel });
}
