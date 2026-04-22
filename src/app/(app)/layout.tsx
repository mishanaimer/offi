import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { AppShell } from "@/components/app-shell";
import { BrandingProvider, type Branding } from "@/components/branding-provider";
import { ApiHealthProvider } from "@/components/api-health";
import { isSuperadmin } from "@/lib/admin";
import { ensureAdminPlatformCompany } from "@/lib/platform-seed";
import { BugReportOverlay } from "@/components/bug-report-overlay";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  // Супер-админ платформы без компании → авто-сидим «Offi» / ассистент «Оффи»
  // (чтобы ngig45@yandex.ru и gign230102@gmail.com сразу попадали в платформу
  // с фирменной айдентикой Offi, минуя онбординг).
  if (isSuperadmin(user.email)) {
    await ensureAdminPlatformCompany(user.id, user.email ?? "");
  }

  const { data: profile } = await supabase
    .from("users")
    .select(
      "id, full_name, email, role, company:companies(id, name, assistant_name, brand_accent, assistant_color, assistant_icon, welcome_message, logo_url, mascot_enabled, mascot_head_shape, mascot_antenna, mascot_ears, mascot_bg)"
    )
    .eq("id", user.id)
    .single();

  if (!profile?.company) redirect("/onboarding");

  const company = profile.company as any;
  const assistantColor = company.assistant_color ?? company.brand_accent ?? "#1a6eff";

  const branding: Branding = {
    companyId: company.id,
    companyName: company.name,
    assistantName: company.assistant_name ?? "Оффи",
    accentColor: company.brand_accent ?? "#1a6eff",
    assistantColor,
    assistantIcon: company.assistant_icon ?? "sparkles",
    welcomeMessage: company.welcome_message ?? "",
    logoUrl: company.logo_url ?? null,
    role: (profile.role ?? "member") as Branding["role"],
    mascot: {
      enabled: company.mascot_enabled ?? true,
      headShape: (company.mascot_head_shape ?? "classic") as Branding["mascot"]["headShape"],
      antenna: (company.mascot_antenna ?? "ball") as Branding["mascot"]["antenna"],
      ears: (company.mascot_ears ?? "round") as Branding["mascot"]["ears"],
      bg: company.mascot_bg ?? "#EEF4FF",
    },
  };

  return (
    <BrandingProvider value={branding}>
      <ApiHealthProvider>
        <AppShell
          user={{
            id: user.id,
            email: user.email ?? "",
            fullName: profile.full_name ?? "",
            isSuperadmin: isSuperadmin(user.email),
          }}
        >
          {children}
        </AppShell>
        <BugReportOverlay />
      </ApiHealthProvider>
    </BrandingProvider>
  );
}
