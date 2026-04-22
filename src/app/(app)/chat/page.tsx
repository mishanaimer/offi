import { createClient } from "@/lib/supabase/server";
import { ChatView } from "./chat-view";
import { currentPeriod, getPlan } from "@/lib/plans";

export const dynamic = "force-dynamic";

export default async function ChatPage() {
  const supabase = createClient();

  const [channelRes, companyRes, usageRes] = await Promise.all([
    supabase
      .from("channels")
      .select("*")
      .eq("type", "ai")
      .order("created_at", { ascending: true })
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

  const { data: messages } = channel
    ? await supabase
        .from("messages")
        .select("*")
        .eq("channel_id", channel.id)
        .order("created_at", { ascending: true })
        .limit(100)
    : { data: [] };

  const plan = getPlan(companyRes.data?.plan);
  const used = usageRes.data?.requests_count ?? 0;

  return (
    <ChatView
      channelId={channel?.id ?? null}
      initialMessages={messages ?? []}
      quota={{ used, limit: plan.limits.requests, planName: plan.name }}
    />
  );
}
