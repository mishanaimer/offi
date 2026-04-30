import { redirect } from "next/navigation";
import Link from "next/link";
import { createClient, createServiceClient } from "@/lib/supabase/server";
import { isSuperadmin } from "@/lib/admin";
import { Logo } from "@/components/logo";
import { BugReportOverlay } from "@/components/bug-report-overlay";
import { BrandingProvider, type Branding } from "@/components/branding-provider";

export const dynamic = "force-dynamic";

const OFFI_BRANDING: Branding = {
  companyId: "platform",
  companyName: "Offi",
  assistantName: "Оффи",
  accentColor: "#0259DD",
  assistantColor: "#0259DD",
  assistantIcon: "sparkles",
  welcomeMessage: "Админка Offi",
  logoUrl: null,
  role: "owner",
  mascot: { enabled: true, headShape: "classic", antenna: "ball", ears: "round", bg: "#EEF4FF" },
};

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");
  if (!isSuperadmin(user.email)) redirect("/chat");

  const service = createServiceClient();
  const [{ count: openBugs }, { count: pendingPlans }] = await Promise.all([
    service
      .from("bug_reports")
      .select("id", { count: "exact", head: true })
      .in("status", ["new", "in_progress"]),
    service
      .from("plan_requests")
      .select("id", { count: "exact", head: true })
      .eq("status", "pending"),
  ]);

  return (
    <BrandingProvider value={OFFI_BRANDING}>
      <div className="min-h-dvh bg-background flex flex-col">
        <header className="h-14 border-b border-border/60 flex items-center px-4 md:px-6 gap-4">
          <Logo />
          <span className="text-xs rounded-full bg-destructive/10 text-destructive px-2 py-0.5 font-medium">
            super-admin
          </span>
          <nav className="ml-auto flex items-center gap-3 text-sm">
            <Link href="/admin" className="hover:underline">
              Обзор
            </Link>
            <Link href="/admin/metrics" className="hover:underline">
              Метрики
            </Link>
            <Link href="/admin/companies" className="hover:underline">
              Компании
            </Link>
            <Link href="/admin/founders" className="hover:underline">
              Founders
            </Link>
            <Link href="/admin/plan-requests" className="hover:underline inline-flex items-center gap-1.5">
              Заявки
              {!!pendingPlans && pendingPlans > 0 && (
                <span className="text-[10px] rounded-full bg-destructive/15 text-destructive px-1.5 py-0.5 font-semibold">
                  {pendingPlans}
                </span>
              )}
            </Link>
            <Link
              href="/admin/bug-reports"
              className="hover:underline inline-flex items-center gap-1.5"
            >
              Обращения
              {!!openBugs && openBugs > 0 && (
                <span className="text-[10px] rounded-full bg-[#F59E0B]/15 text-[#B45309] px-1.5 py-0.5 font-semibold">
                  {openBugs}
                </span>
              )}
            </Link>
            <Link href="/chat" className="text-muted-foreground hover:underline">
              ← к чату
            </Link>
          </nav>
        </header>
        <div className="flex-1">{children}</div>
        <BugReportOverlay />
      </div>
    </BrandingProvider>
  );
}
