import Link from "next/link";
import { Crown } from "lucide-react";
import { createServiceClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

export default async function AdminFoundersPage() {
  const service = createServiceClient();

  const [{ data: founders }, { data: status }] = await Promise.all([
    service
      .from("companies")
      .select("id, name, plan, is_founder, founder_at, locked_price, promo_code, created_at, pilot_until")
      .eq("is_founder", true)
      .order("founder_at", { ascending: false }),
    service.rpc("founders_status"),
  ]);

  const s = Array.isArray(status) ? status[0] : status;

  return (
    <div className="container-page max-w-5xl py-8 space-y-6">
      <div className="flex items-baseline justify-between">
        <div>
          <h1 className="text-xl font-semibold">Founders Programme</h1>
          <p className="text-xs text-muted-foreground">первые 50 платящих клиентов с пожизненной скидкой 50%</p>
        </div>
        <Link href="/admin" className="text-sm text-muted-foreground hover:underline">
          ← обзор
        </Link>
      </div>

      <div className="card-surface p-5 bg-gradient-to-r from-amber-50 to-orange-50/60 border-amber-200">
        <div className="flex items-center gap-4">
          <div className="grid h-14 w-14 place-items-center rounded-2xl bg-amber-100 text-amber-700">
            <Crown className="w-6 h-6" />
          </div>
          <div className="flex-1">
            <div className="text-3xl font-extrabold tabular-nums text-amber-900">
              {s?.used ?? 0}
              <span className="text-amber-700/60">/{s?.total ?? 50}</span>
            </div>
            <div className="text-sm text-amber-900/80 mt-0.5">
              мест занято · осталось <span className="font-semibold">{s?.remaining ?? 50}</span>
            </div>
          </div>
          <div className="hidden sm:block w-48 h-2 rounded-full bg-amber-200/60 overflow-hidden">
            <div
              className="h-full bg-gradient-to-r from-amber-500 to-orange-500"
              style={{ width: `${Math.min(100, ((s?.used ?? 0) / Math.max(s?.total ?? 50, 1)) * 100)}%` }}
            />
          </div>
        </div>
      </div>

      <section className="card-surface p-5">
        <h2 className="font-semibold">Список Founders</h2>
        <p className="text-xs text-muted-foreground">по дате присоединения</p>
        <div className="mt-3 overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="text-left text-muted-foreground text-xs">
              <tr className="border-b border-border/60">
                <th className="py-2 pr-2 font-medium">Компания</th>
                <th className="py-2 px-2 font-medium">Тариф</th>
                <th className="py-2 px-2 font-medium">Цена/мес</th>
                <th className="py-2 px-2 font-medium">Промокод</th>
                <th className="py-2 pl-2 font-medium">Дата</th>
              </tr>
            </thead>
            <tbody>
              {(founders ?? []).map((f: any) => {
                const lp = f.locked_price ?? {};
                const planPrice = lp[f.plan] ?? null;
                return (
                  <tr key={f.id} className="border-b border-border/40">
                    <td className="py-2 pr-2 font-medium">{f.name}</td>
                    <td className="py-2 px-2 text-muted-foreground">{f.plan}</td>
                    <td className="py-2 px-2 tabular-nums">
                      {planPrice !== null ? `${planPrice.toLocaleString("ru")} ₽` : "—"}
                    </td>
                    <td className="py-2 px-2 text-muted-foreground font-mono text-xs">
                      {f.promo_code ?? "—"}
                    </td>
                    <td className="py-2 pl-2 text-muted-foreground tabular-nums">
                      {f.founder_at ? new Date(f.founder_at).toLocaleDateString("ru") : "—"}
                    </td>
                  </tr>
                );
              })}
              {(!founders || founders.length === 0) && (
                <tr>
                  <td colSpan={5} className="py-8 text-center text-sm text-muted-foreground">
                    Пока нет Founders. После активации промокода <code className="bg-muted px-1.5 py-0.5 rounded">FOUNDER</code> компания появится здесь.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </section>

      <section className="card-surface p-5 text-sm text-muted-foreground">
        <h3 className="font-semibold text-foreground mb-2">Как это работает</h3>
        <ul className="space-y-1.5 list-disc pl-5">
          <li>Клиент вводит промокод <code className="bg-muted px-1.5 py-0.5 rounded">FOUNDER</code> в /settings/plans</li>
          <li>Помечается флаг <code>is_founder=true</code>, в <code>locked_price</code> сохраняется JSON с фиксированными ценами по тарифам</li>
          <li>На странице тарифов видит свою (со скидкой) цену вместо стандартной</li>
          <li>При смене тарифа цена остаётся в Founders-сетке</li>
          <li>При непрерывной подписке цена не меняется никогда</li>
          <li>Прерывание подписки на 30+ дней — снятие is_founder вручную через админку (запрос в БД)</li>
        </ul>
      </section>
    </div>
  );
}
