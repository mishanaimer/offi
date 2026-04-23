import { createClient } from "@/lib/supabase/server";
import { ChatView } from "./chat-view";
import { currentPeriod, getPlan } from "@/lib/plans";

export const dynamic = "force-dynamic";

export default async function ChatPage({
  searchParams,
}: {
  searchParams?: { c?: string };
}) {
  const supabase = createClient();
  const requestedChannel = searchParams?.c?.trim() || null;

  // Если явно задан ?c=<id> — берём этот канал.
  // Иначе — AI-канал с САМОЙ СВЕЖЕЙ активностью (по last message), а не по created_at.
  const channelPromise = requestedChannel
    ? supabase.from("channels").select("*").eq("id", requestedChannel).eq("type", "ai").maybeSingle()
    : (async () => {
        // Берём последнее сообщение любого AI-канала компании и по нему выбираем канал.
        const { data: lastMsg } = await supabase
          .from("messages")
          .select("channel_id, channels!inner(id, type)")
          .eq("channels.type", "ai")
          .order("created_at", { ascending: false })
          .limit(1)
          .maybeSingle();
        const lastChannelId = (lastMsg as any)?.channel_id as string | undefined;
        if (lastChannelId) {
          return supabase
            .from("channels")
            .select("*")
            .eq("id", lastChannelId)
            .maybeSingle();
        }
        // Нет ни одного сообщения — возвращаем самый свежий созданный канал.
        return supabase
          .from("channels")
          .select("*")
          .eq("type", "ai")
          .order("created_at", { ascending: false })
          .limit(1)
          .maybeSingle();
      })();

  const [channelRes, companyRes, usageRes] = await Promise.all([
    channelPromise,
    supabase.from("companies").select("plan").maybeSingle(),
    supabase
      .from("usage_counters")
      .select("requests_count")
      .eq("period", currentPeriod())
      .maybeSingle(),
  ]);
  const channel = channelRes.data;

  // Берём ВСЕ сообщения канала (до 500 — практически без потерь).
  // Сортируем ascending, чтобы сохранить исходный порядок диалога.
  const { data: latest } = channel
    ? await supabase
        .from("messages")
        .select("*")
        .eq("channel_id", channel.id)
        .order("created_at", { ascending: true })
        .limit(500)
    : { data: [] };
  const messages = latest ?? [];

  const plan = getPlan(companyRes.data?.plan);
  const used = usageRes.data?.requests_count ?? 0;

  return (
    <ChatView
      // key — чтобы при переходе между диалогами история/стейт/ref'ы сбрасывались
      // (иначе сообщения прошлого канала «перетекают» в новый)
      key={channel?.id ?? "empty"}
      channelId={channel?.id ?? null}
      initialMessages={messages}
      quota={{ used, limit: plan.limits.requests, planName: plan.name }}
    />
  );
}
