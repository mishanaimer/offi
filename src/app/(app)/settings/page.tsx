import { createClient } from "@/lib/supabase/server";
import { SettingsView } from "./settings-view";

export const dynamic = "force-dynamic";

export default async function SettingsPage() {
  const supabase = createClient();
  const [{ data: company }, { data: members }, { data: integrations }] = await Promise.all([
    supabase.from("companies").select("*").maybeSingle(),
    supabase.from("users").select("id, email, full_name, role"),
    supabase.from("integrations").select("*"),
  ]);
  return (
    <SettingsView
      company={company!}
      members={members ?? []}
      integrations={integrations ?? []}
    />
  );
}
