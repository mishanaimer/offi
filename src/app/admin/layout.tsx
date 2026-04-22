import { redirect } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { isSuperadmin } from "@/lib/admin";
import { Logo } from "@/components/logo";

export const dynamic = "force-dynamic";

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");
  if (!isSuperadmin(user.email)) redirect("/chat");

  return (
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
          <Link href="/admin/companies" className="hover:underline">
            Компании
          </Link>
          <Link href="/admin/plan-requests" className="hover:underline">
            Заявки
          </Link>
          <Link href="/chat" className="text-muted-foreground hover:underline">
            ← к чату
          </Link>
        </nav>
      </header>
      <div className="flex-1">{children}</div>
    </div>
  );
}
