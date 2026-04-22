import { createClient } from "@/lib/supabase/server";
import { TeamView } from "./team-view";

export const dynamic = "force-dynamic";

export default async function TeamPage() {
  const supabase = createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  const [
    { data: members },
    { data: memberships },
    { data: company },
  ] = await Promise.all([
    supabase.from("users").select("id, email, full_name, role, position"),
    supabase
      .from("channel_members")
      .select("channel_id, user_id, channels:channels(id, name, type, created_at)")
      .eq("user_id", user!.id),
    supabase.from("companies").select("id").maybeSingle(),
  ]);

  const channels = (memberships ?? [])
    .map((m: any) => m.channels)
    .filter(Boolean)
    .sort((a: any, b: any) => (a.created_at > b.created_at ? 1 : -1));

  return (
    <TeamView
      currentUser={{ id: user!.id }}
      initialChannels={channels}
      companyMembers={members ?? []}
    />
  );
}
