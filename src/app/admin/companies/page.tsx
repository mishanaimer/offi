import { createServiceClient } from "@/lib/supabase/server";
import { formatDate } from "@/lib/utils";
import { PLANS } from "@/lib/plans";

export const dynamic = "force-dynamic";

export default async function AdminCompanies() {
  const service = createServiceClient();
  const { data: companies } = await service
    .from("companies")
    .select("id, name, assistant_name, plan, brand_accent, created_at")
    .order("created_at", { ascending: false })
    .limit(200);

  // Подсчёт сотрудников по компаниям — одним запросом через RPC было бы красивее,
  // на MVP считаем на клиенте JS.
  const { data: users } = await service.from("users").select("company_id");
  const memberCount = new Map<string, number>();
  for (const u of users ?? []) {
    if (!u.company_id) continue;
    memberCount.set(u.company_id, (memberCount.get(u.company_id) ?? 0) + 1);
  }

  return (
    <div className="container-page max-w-5xl py-8 space-y-4">
      <h1 className="text-xl font-semibold">Компании ({companies?.length ?? 0})</h1>

      <section className="card-surface overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="text-left text-muted-foreground text-xs bg-muted/40">
              <tr>
                <th className="py-2.5 px-3 font-medium">Название</th>
                <th className="py-2.5 px-3 font-medium">Ассистент</th>
                <th className="py-2.5 px-3 font-medium">Тариф</th>
                <th className="py-2.5 px-3 font-medium text-right">Сотрудников</th>
                <th className="py-2.5 px-3 font-medium">Создана</th>
              </tr>
            </thead>
            <tbody>
              {(companies ?? []).map((c: any) => {
                const plan = (PLANS as any)[c.plan] ?? PLANS.trial;
                return (
                  <tr key={c.id} className="border-t border-border/50">
                    <td className="py-2.5 px-3">
                      <div className="flex items-center gap-2">
                        <span
                          className="w-5 h-5 rounded-md shrink-0"
                          style={{ background: c.brand_accent ?? "#1a6eff" }}
                        />
                        <span className="font-medium">{c.name}</span>
                      </div>
                    </td>
                    <td className="py-2.5 px-3 text-muted-foreground">{c.assistant_name}</td>
                    <td className="py-2.5 px-3">
                      <span className="rounded-full bg-muted px-2 py-0.5 text-[11px] text-muted-foreground">
                        {plan.name}
                      </span>
                    </td>
                    <td className="py-2.5 px-3 text-right tabular-nums">
                      {(memberCount.get(c.id) ?? 0).toString()}
                    </td>
                    <td className="py-2.5 px-3 text-muted-foreground">{formatDate(c.created_at)}</td>
                  </tr>
                );
              })}
              {(!companies || companies.length === 0) && (
                <tr>
                  <td colSpan={5} className="py-8 text-center text-sm text-muted-foreground">
                    Пока нет компаний.
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
