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

  // Если явно задан ?c=<id> — берём этот канал. Иначе — самый свежий AI-канал.
  const channelPromise = requestedChannel
    ? supabase.from("channels").select("*").eq("id", requestedChannel).eq("type", "ai").maybeSingle()
    : supabase
        .from("channels")
        .select("*")
        .eq("type", "ai")
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();

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
      channelId={channel?.id ?? null}
      initialMessages={messages}
      quota={{ used, limit: plan.limits.requests, planName: plan.name }}
    />
  );
}
