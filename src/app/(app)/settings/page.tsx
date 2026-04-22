import { createClient } from "@/lib/supabase/server";
import { SettingsView } from "./settings-view";

export const dynamic = "force-dynamic";

export default async function SettingsPage() {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const [{ data: company }, { data: integrations }, { data: me }] = await Promise.all([
    supabase.from("companies").select("*").maybeSingle(),
    supabase.from("integrations").select("*"),
    supabase.from("users").select("role").eq("id", user!.id).maybeSingle(),
  ]);

  return (
    <SettingsView
      company={company!}
      integrations={integrations ?? []}
      currentUserRole={(me?.role as any) ?? "member"}
    />
  );
}
