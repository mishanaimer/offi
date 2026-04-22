import { createClient } from "@/lib/supabase/server";
import { ChatView } from "./chat-view";
import { currentPeriod, getPlan } from "@/lib/plans";

export const dynamic = "force-dynamic";

export default async function ChatPage() {
  const supabase = createClient();

  // Берём САМЫЙ СВЕЖИЙ AI-канал, чтобы кнопка «Новый» открывала новый диалог.
  const [channelRes, companyRes, usageRes] = await Promise.all([
    supabase
      .from("channels")
      .select("*")
      .eq("type", "ai")
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle(),
    supabase.from("companies").select("plan").maybeSingle(),
    supabase
      .from("usage_counters")
      .select("requests_count")
      .eq("period", currentPeriod())
      .maybeSingle(),
  ]);
  const channel = channelRes.data;

  // Берём ПОСЛЕДНИЕ 100 сообщений (desc → reverse), иначе при >100 сообщениях новые исчезают.
  const { data: latest } = channel
    ? await supabase
        .from("messages")
        .select("*")
        .eq("channel_id", channel.id)
        .order("created_at", { ascending: false })
        .limit(100)
    : { data: [] };
  const messages = (latest ?? []).slice().reverse();

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
