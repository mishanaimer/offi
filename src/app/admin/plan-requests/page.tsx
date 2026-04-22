import { createServiceClient } from "@/lib/supabase/server";
import { formatDate } from "@/lib/utils";
import { PLANS } from "@/lib/plans";
import { StatusControls } from "./status-controls";

export const dynamic = "force-dynamic";

export default async function AdminPlanRequests() {
  const service = createServiceClient();

  const { data: requests } = await service
    .from("plan_requests")
    .select(
      "id, plan, billing_period, status, note, created_at, companies:companies(name, plan), users:users(email, full_name)"
    )
    .order("created_at", { ascending: false })
    .limit(200);

  return (
    <div className="container-page max-w-5xl py-8 space-y-4">
      <h1 className="text-xl font-semibold">Заявки на тариф</h1>

      <section className="card-surface overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="text-left text-muted-foreground text-xs bg-muted/40">
              <tr>
                <th className="py-2.5 px-3 font-medium">Когда</th>
                <th className="py-2.5 px-3 font-medium">Компания</th>
                <th className="py-2.5 px-3 font-medium">Сейчас</th>
                <th className="py-2.5 px-3 font-medium">Хотят</th>
                <th className="py-2.5 px-3 font-medium">Кто</th>
                <th className="py-2.5 px-3 font-medium">Статус</th>
              </tr>
            </thead>
            <tbody>
              {(requests ?? []).map((r: any) => {
                const curPlan = (PLANS as any)[r.companies?.plan ?? "trial"] ?? PLANS.trial;
                const wantPlan = (PLANS as any)[r.plan] ?? PLANS.trial;
                const price =
                  r.billing_period === "year" ? wantPlan.priceYear : wantPlan.priceMonth;
                return (
                  <tr key={r.id} className="border-t border-border/50">
                    <td className="py-2.5 px-3 text-muted-foreground whitespace-nowrap">
                      {formatDate(r.created_at)}
                    </td>
                    <td className="py-2.5 px-3 font-medium">{r.companies?.name ?? "—"}</td>
                    <td className="py-2.5 px-3 text-muted-foreground">{curPlan.name}</td>
                    <td className="py-2.5 px-3">
                      <span className="font-medium">{wantPlan.name}</span>
                      <span className="text-muted-foreground text-xs">
                        {" "}
                        · {r.billing_period === "year" ? "год" : "мес"} · {price.toLocaleString("ru")} ₽
                      </span>
                    </td>
                    <td className="py-2.5 px-3">
                      <div className="text-xs">
                        <div className="font-medium">{r.users?.full_name ?? "—"}</div>
                        <div className="text-muted-foreground">{r.users?.email ?? ""}</div>
                      </div>
                    </td>
                    <td className="py-2.5 px-3">
                      <StatusControls
                        id={r.id}
                        status={r.status}
                        companyPlan={r.companies?.plan ?? "trial"}
                        targetPlan={r.plan}
                      />
                    </td>
                  </tr>
                );
              })}
              {(!requests || requests.length === 0) && (
                <tr>
                  <td colSpan={6} className="py-8 text-center text-sm text-muted-foreground">
                    Пока нет заявок.
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
