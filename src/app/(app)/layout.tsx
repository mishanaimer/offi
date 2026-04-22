import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { AppShell } from "@/components/app-shell";
import { BrandingProvider, type Branding } from "@/components/branding-provider";
import { ApiHealthProvider } from "@/components/api-health";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: profile } = await supabase
    .from("users")
    .select(
      "id, full_name, email, role, company:companies(id, name, assistant_name, brand_accent, assistant_color, assistant_icon, welcome_message, logo_url)"
    )
    .eq("id", user.id)
    .single();

  if (!profile?.company) redirect("/onboarding");

  const company = profile.company as any;

  const branding: Branding = {
    companyId: company.id,
    companyName: company.name,
    assistantName: company.assistant_name ?? "Оффи",
    accentColor: company.brand_accent ?? "#1a6eff",
    assistantColor: company.assistant_color ?? company.brand_accent ?? "#1a6eff",
    assistantIcon: company.assistant_icon ?? "sparkles",
    welcomeMessage: company.welcome_message ?? "",
    logoUrl: company.logo_url ?? null,
    role: (profile.role ?? "member") as Branding["role"],
  };

  return (
    <BrandingProvider value={branding}>
      <ApiHealthProvider>
        <AppShell
          user={{ id: user.id, email: user.email ?? "", fullName: profile.full_name ?? "" }}
        >
          {children}
        </AppShell>
      </ApiHealthProvider>
    </BrandingProvider>
  );
}
