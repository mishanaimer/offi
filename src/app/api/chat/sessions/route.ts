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

  // Для каждого канала тянем его ПОСЛЕДНЕЕ сообщение + общий count.
  // Параллельно: 50 каналов × 2 запроса — ~100 быстрых пойнт-лукапов.
  // Раньше брали верхние 300 сообщений по всем каналам, из-за чего активный
  // канал мог «съесть» лимит и другие каналы показывались пустыми.
  const [lasts, counts] = await Promise.all([
    Promise.all(
      ids.map((id) =>
        service
          .from("messages")
          .select("content, is_ai, created_at")
          .eq("channel_id", id)
          .order("created_at", { ascending: false })
          .limit(1)
          .maybeSingle()
          .then((r) => ({ id, row: r.data }))
      )
    ),
    Promise.all(
      ids.map((id) =>
        service
          .from("messages")
          .select("*", { count: "exact", head: true })
          .eq("channel_id", id)
          .then((r) => ({ id, count: r.count ?? 0 }))
      )
    ),
  ]);

  const lastByChannel = new Map<string, { content: string; is_ai: boolean; created_at: string }>();
  for (const { id, row } of lasts) {
    if (row) lastByChannel.set(id, row as any);
  }
  const countByChannel = new Map<string, number>();
  for (const { id, count } of counts) countByChannel.set(id, count);

  const sessions = channels
    .map((c) => {
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
    })
    // Сортируем по последней активности (а не по дате создания канала),
    // чтобы свежие диалоги были наверху.
    .sort((a, b) => (a.last_at < b.last_at ? 1 : a.last_at > b.last_at ? -1 : 0));

  return Response.json({ sessions });
}
