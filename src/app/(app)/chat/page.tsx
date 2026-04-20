import { createClient } from "@/lib/supabase/server";
import { ChatView } from "./chat-view";

export const dynamic = "force-dynamic";

export default async function ChatPage() {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();

  const { data: channel } = await supabase
    .from("channels")
    .select("*")
    .eq("type", "ai")
    .order("created_at", { ascending: true })
    .limit(1)
    .maybeSingle();

  const { data: messages } = channel
    ? await supabase
        .from("messages")
        .select("*")
        .eq("channel_id", channel.id)
        .order("created_at", { ascending: true })
        .limit(100)
    : { data: [] };

  const { data: profile } = await supabase
    .from("users")
    .select("company:companies(assistant_name, name)")
    .eq("id", user!.id)
    .single();

  return (
    <ChatView
      channelId={channel?.id ?? null}
      initialMessages={messages ?? []}
      assistantName={(profile?.company as any)?.assistant_name ?? "Оффи"}
      companyName={(profile?.company as any)?.name ?? ""}
    />
  );
}
