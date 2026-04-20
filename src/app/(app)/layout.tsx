import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { AppShell } from "@/components/app-shell";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: profile } = await supabase
    .from("users")
    .select("id, full_name, email, company:companies(id, name, assistant_name, brand_accent)")
    .eq("id", user.id)
    .single();

  if (!profile?.company) redirect("/onboarding");

  return (
    <AppShell
      user={{ id: user.id, email: user.email ?? "", fullName: profile.full_name ?? "" }}
      company={{
        id: (profile.company as any).id,
        name: (profile.company as any).name,
        assistantName: (profile.company as any).assistant_name,
        brandAccent: (profile.company as any).brand_accent,
      }}
    >
      {children}
    </AppShell>
  );
}
