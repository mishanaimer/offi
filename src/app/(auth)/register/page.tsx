import Link from "next/link";
import { RegisterForm } from "./register-form";

export default function RegisterPage() {
  return (
    <div className="animate-fade-in">
      <h1 className="text-2xl font-semibold tracking-tight">Создать аккаунт</h1>
      <p className="mt-1.5 text-sm text-muted-foreground">14 дней бесплатно, без карты</p>

      <div className="mt-8">
        <RegisterForm />
      </div>

      <p className="mt-8 text-sm text-muted-foreground">
        Уже есть аккаунт?{" "}
        <Link href="/login" className="text-primary hover:underline">Войти</Link>
      </p>
    </div>
  );
}
