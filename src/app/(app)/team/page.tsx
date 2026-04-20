import { createClient } from "@/lib/supabase/server";
import { TeamView } from "./team-view";

export const dynamic = "force-dynamic";

export default async function TeamPage() {
  const supabase = createClient();
  const { data: channels } = await supabase
    .from("channels")
    .select("*")
    .order("created_at", { ascending: true });
  return <TeamView initialChannels={channels ?? []} />;
}
