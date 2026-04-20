import Link from "next/link";
import { LoginForm } from "./login-form";

export default function LoginPage({ searchParams }: { searchParams: { next?: string; error?: string } }) {
  return (
    <div className="animate-fade-in">
      <h1 className="text-2xl font-semibold tracking-tight">Вход в Offi</h1>
      <p className="mt-1.5 text-sm text-muted-foreground">Продолжим там, где остановились</p>

      <div className="mt-8">
        <LoginForm next={searchParams.next} />
      </div>

      {searchParams.error && (
        <div className="mt-4 rounded-xl bg-destructive/10 text-destructive text-sm p-3">{searchParams.error}</div>
      )}

      <p className="mt-8 text-sm text-muted-foreground">
        Нет аккаунта?{" "}
        <Link href="/register" className="text-primary hover:underline">Создать</Link>
      </p>
    </div>
  );
}
