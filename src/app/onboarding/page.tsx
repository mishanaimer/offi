import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { OnboardingWizard } from "./wizard";
import { BrandMorph } from "@/components/mascot";

export default async function OnboardingPage() {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: profile } = await supabase.from("users").select("*, company:companies(*)").eq("id", user.id).single();
  // если у пользователя уже есть компания — сразу в чат
  if (profile?.company_id) redirect("/chat");

  return (
    <div className="min-h-dvh flex flex-col bg-background">
      <header className="h-16 flex items-center">
        <div className="container-page">
          <Link href="/" aria-label="На главную">
            <BrandMorph size={19} startState="text" autoCycle={false} hoverMorph interactive phase={0.9} />
          </Link>
        </div>
      </header>
      <main className="flex-1 grid place-items-center px-4 py-8">
        <OnboardingWizard userEmail={user.email!} userId={user.id} />
      </main>
    </div>
  );
}
