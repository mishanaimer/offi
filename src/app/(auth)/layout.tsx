import { Logo } from "@/components/logo";
import Link from "next/link";

export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-dvh flex flex-col bg-background">
      <header className="h-16 flex items-center">
        <div className="container-page">
          <Link href="/"><Logo /></Link>
        </div>
      </header>
      <main className="flex-1 grid place-items-center px-4 py-8">
        <div className="w-full max-w-sm">{children}</div>
      </main>
    </div>
  );
}
