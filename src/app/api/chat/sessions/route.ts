import { NextRequest } from "next/server";
import { createClient, createServiceClient } from "@/lib/supabase/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * GET — список AI-диалогов пользователя (история чатов).
 * Возвращает каналы с последним сообщением (preview) и количеством сообщений.
 */
export async function GET(_req: NextRequest) {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return new Response("unauthorized", { status: 401 });

  const { data: profile } = await supabase
    .from("users")
    .select("company_id")
    .eq("id", user.id)
    .single();
  const companyId = profile?.company_id;
  if (!companyId) return Response.json({ sessions: [] });

  const service = createServiceClient();
  const { data: channels } = await service
    .from("channels")
    .select("id, name, created_at")
    .eq("company_id", companyId)
    .eq("type", "ai")
    .order("created_at", { ascending: false })
    .limit(50);

  if (!channels || !channels.length) return Response.json({ sessions: [] });

  const ids = channels.map((c) => c.id);

  // Последнее сообщение на канал — через RPC было бы эффективнее, но в лоб
  // берём до 300 последних по всем и группируем на клиенте.
  const { data: msgs } = await service
    .from("messages")
    .select("channel_id, content, is_ai, created_at")
    .in("channel_id", ids)
    .order("created_at", { ascending: false })
    .limit(300);

  const lastByChannel = new Map<string, { content: string; is_ai: boolean; created_at: string }>();
  const countByChannel = new Map<string, number>();
  for (const m of msgs ?? []) {
    countByChannel.set(m.channel_id, (countByChannel.get(m.channel_id) ?? 0) + 1);
    if (!lastByChannel.has(m.channel_id)) {
      lastByChannel.set(m.channel_id, {
        content: m.content,
        is_ai: m.is_ai,
        created_at: m.created_at,
      });
    }
  }

  const sessions = channels.map((c) => {
    const last = lastByChannel.get(c.id);
    return {
      id: c.id,
      name: c.name,
      created_at: c.created_at,
      last_message: last?.content ? last.content.slice(0, 120) : null,
      last_is_ai: last?.is_ai ?? null,
      last_at: last?.created_at ?? c.created_at,
      messages_count: countByChannel.get(c.id) ?? 0,
    };
  });

  return Response.json({ sessions });
}
