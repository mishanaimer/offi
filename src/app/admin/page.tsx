import { createServiceClient } from "@/lib/supabase/server";
import { currentPeriod, PLANS } from "@/lib/plans";

export const dynamic = "force-dynamic";

export default async function AdminOverview() {
  const service = createServiceClient();
  const period = currentPeriod();

  const [
    { count: companiesCount },
    { count: usersCount },
    { count: messagesCount },
    { count: docsCount },
    { count: memoriesCount },
    { count: pendingReqCount },
    { data: topUsage },
  ] = await Promise.all([
    service.from("companies").select("id", { count: "exact", head: true }),
    service.from("users").select("id", { count: "exact", head: true }),
    service.from("messages").select("id", { count: "exact", head: true }),
    service.from("documents").select("id", { count: "exact", head: true }),
    service.from("memories").select("id", { count: "exact", head: true }),
    service.from("plan_requests").select("id", { count: "exact", head: true }).eq("status", "pending"),
    service
      .from("usage_counters")
      .select("company_id, requests_count, actions_count, companies:companies(name, plan)")
      .eq("period", period)
      .order("requests_count", { ascending: false })
      .limit(10),
  ]);

  return (
    <div className="container-page max-w-5xl py-8 space-y-6">
      <h1 className="text-xl font-semibold">Обзор платформы</h1>

      <div className="grid sm:grid-cols-3 gap-3">
        <Stat label="Компании" value={companiesCount ?? 0} />
        <Stat label="Пользователи" value={usersCount ?? 0} />
        <Stat label="Ожидают тариф" value={pendingReqCount ?? 0} highlight />
        <Stat label="Сообщений" value={messagesCount ?? 0} />
        <Stat label="Документов" value={docsCount ?? 0} />
        <Stat label="Фактов в памяти" value={memoriesCount ?? 0} />
      </div>

      <section className="card-surface p-5">
        <h2 className="font-semibold">Использование за {period}</h2>
        <p className="text-xs text-muted-foreground">топ-10 компаний по запросам</p>
        <div className="mt-3 overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="text-left text-muted-foreground text-xs">
              <tr className="border-b border-border/60">
                <th className="py-2 pr-2 font-medium">Компания</th>
                <th className="py-2 px-2 font-medium">Тариф</th>
                <th className="py-2 px-2 font-medium text-right">Запросов</th>
                <th className="py-2 pl-2 font-medium text-right">Действий</th>
              </tr>
            </thead>
            <tbody>
              {(topUsage ?? []).map((row: any) => {
                const planCode = row.companies?.plan ?? "trial";
                const plan = (PLANS as any)[planCode] ?? PLANS.trial;
                const reqLimit = plan.limits.requests;
                const percent = reqLimit ? Math.round((row.requests_count / reqLimit) * 100) : 0;
                return (
                  <tr key={row.company_id} className="border-b border-border/40">
                    <td className="py-2 pr-2 font-medium">{row.companies?.name ?? "—"}</td>
                    <td className="py-2 px-2 text-muted-foreground">{plan.name}</td>
                    <td className="py-2 px-2 text-right tabular-nums">
                      {row.requests_count.toLocaleString("ru")}
                      <span className="text-muted-foreground">
                        {" "}
                        / {reqLimit.toLocaleString("ru")}
                      </span>
                      <span
                        className={
                          percent >= 100
                            ? "ml-2 text-[11px] text-destructive"
                            : percent >= 80
                            ? "ml-2 text-[11px] text-[#B45309]"
                            : "ml-2 text-[11px] text-muted-foreground"
                        }
                      >
                        {percent}%
                      </span>
                    </td>
                    <td className="py-2 pl-2 text-right tabular-nums">
                      {row.actions_count.toLocaleString("ru")}
                    </td>
                  </tr>
                );
              })}
              {(!topUsage || topUsage.length === 0) && (
                <tr>
                  <td colSpan={4} className="py-6 text-center text-sm text-muted-foreground">
                    Пока нет данных за этот период.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}

function Stat({ label, value, highlight }: { label: string; value: number; highlight?: boolean }) {
  return (
    <div className="card-surface p-4">
      <div className="text-xs text-muted-foreground">{label}</div>
      <div
        className={
          "mt-1 text-2xl font-semibold tabular-nums " +
          (highlight && value > 0 ? "text-destructive" : "")
        }
      >
        {value.toLocaleString("ru")}
      </div>
    </div>
  );
}
