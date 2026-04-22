import { createClient } from "@/lib/supabase/server";
import { TeamView } from "./team-view";

export const dynamic = "force-dynamic";

export default async function TeamPage() {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const [
    { data: company },
    { data: me },
    { data: members },
    { data: departments },
  ] = await Promise.all([
    supabase.from("companies").select("id, plan").maybeSingle(),
    supabase.from("users").select("role").eq("id", user!.id).maybeSingle(),
    supabase
      .from("users")
      .select("id, email, full_name, role, position, department_id, bio, created_at")
      .order("created_at", { ascending: true }),
    supabase.from("departments").select("id, name, color, created_at").order("created_at"),
  ]);

  return (
    <TeamView
      company={company!}
      currentUser={{ id: user!.id, role: (me?.role as any) ?? "member" }}
      initialMembers={members ?? []}
      initialDepartments={departments ?? []}
    />
  );
}
