import Link from "next/link";
import { ArrowDownRight, ArrowUpRight, Activity, MessageSquare, Coins, Users, FileText, AlertCircle } from "lucide-react";
import { createServiceClient } from "@/lib/supabase/server";
import { currentPeriod, PLANS } from "@/lib/plans";

export const dynamic = "force-dynamic";

const KOPECKS_PER_RUB = 100;

export default async function AdminMetricsPage() {
  const service = createServiceClient();
  const period = currentPeriod();
  const since30 = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();
  const since7 = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();
  const since1 = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();

  const [
    { data: usageRows },
    { data: pilots },
    { data: foundersStatusRows },
    { count: dau24h },
    { count: wau7d },
    { count: mau30d },
    { data: csatRows },
    { data: feedbackRows },
  ] = await Promise.all([
    service
      .from("usage_counters")
      .select("company_id, requests_count, actions_count, tokens_input, tokens_output, cost_kop, companies:companies(name, plan, is_founder)")
      .eq("period", period)
      .order("cost_kop", { ascending: false })
      .limit(50),
    service
      .from("companies")
      .select("id, name, plan, pilot_until, is_founder, created_at")
      .eq("plan", "pilot")
      .order("created_at", { ascending: false }),
    service.rpc("founders_status"),
    service
      .from("messages")
      .select("user_id", { count: "exact", head: true })
      .eq("is_ai", false)
      .gte("created_at", since1),
    service
      .from("messages")
      .select("user_id", { count: "exact", head: true })
      .eq("is_ai", false)
      .gte("created_at", since7),
    service
      .from("messages")
      .select("user_id", { count: "exact", head: true })
      .eq("is_ai", false)
      .gte("created_at", since30),
    service
      .from("message_reactions")
      .select("reaction")
      .gte("created_at", since30),
    service
      .from("pilot_feedback")
      .select("nps_score, anchor")
      .gte("created_at", since30),
  ]);

  const founders = Array.isArray(foundersStatusRows) ? foundersStatusRows[0] : foundersStatusRows;

  // Aggregate
  let totalRequests = 0;
  let totalCostKop = 0;
  let totalTokensIn = 0;
  let totalTokensOut = 0;
  for (const r of usageRows ?? []) {
    totalRequests += r.requests_count ?? 0;
    totalCostKop += r.cost_kop ?? 0;
    totalTokensIn += r.tokens_input ?? 0;
    totalTokensOut += r.tokens_output ?? 0;
  }

  const csatUp = (csatRows ?? []).filter((r) => r.reaction === "thumbs_up").length;
  const csatDown = (csatRows ?? []).filter((r) => r.reaction === "thumbs_down").length;
  const csatTotal = csatUp + csatDown;
  const csatPct = csatTotal === 0 ? null : Math.round((csatUp / csatTotal) * 100);

  const npsScores = (feedbackRows ?? [])
    .map((r) => r.nps_score)
    .filter((v): v is number => typeof v === "number");
  const promoters = npsScores.filter((v) => v >= 9).length;
  const detractors = npsScores.filter((v) => v <= 6).length;
  const nps = npsScores.length === 0 ? null : Math.round(((promoters - detractors) / npsScores.length) * 100);

  return (
    <div className="container-page max-w-6xl py-8 space-y-6">
      <div className="flex items-baseline justify-between">
        <div>
          <h1 className="text-xl font-semibold">Метрики платформы</h1>
          <p className="text-xs text-muted-foreground">период {period} · сводка по 5 пилотам и платным клиентам</p>
        </div>
        <Link href="/admin" className="text-sm text-muted-foreground hover:underline">
          ← обзор
        </Link>
      </div>

      {/* KPI cards */}
      <div className="grid sm:grid-cols-2 md:grid-cols-4 gap-3">
        <Stat icon={Users} label="DAU (24ч)" value={dau24h ?? 0} />
        <Stat icon={Activity} label="WAU (7д)" value={wau7d ?? 0} />
        <Stat icon={Activity} label="MAU (30д)" value={mau30d ?? 0} />
        <Stat
          icon={Coins}
          label="Расход AI за месяц"
          value={`${(totalCostKop / KOPECKS_PER_RUB).toLocaleString("ru", { maximumFractionDigits: 0 })} ₽`}
          hint={`${totalRequests.toLocaleString("ru")} запросов`}
        />
        <Stat
          icon={Crown_}
          label="Founders"
          value={`${founders?.used ?? 0} / ${founders?.total ?? 50}`}
          hint={`осталось ${founders?.remaining ?? 50}`}
        />
        <Stat
          icon={MessageSquare}
          label="CSAT (30д)"
          value={csatPct === null ? "нет данных" : `${csatPct}%`}
          hint={csatTotal > 0 ? `${csatUp} 👍 / ${csatDown} 👎` : "—"}
          tone={csatPct === null ? "muted" : csatPct >= 75 ? "good" : csatPct >= 50 ? "warn" : "bad"}
        />
        <Stat
          icon={ArrowUpRight}
          label="NPS (30д)"
          value={nps === null ? "нет данных" : nps.toString()}
          hint={`${npsScores.length} ответов`}
          tone={nps === null ? "muted" : nps >= 30 ? "good" : nps >= 0 ? "warn" : "bad"}
        />
        <Stat
          icon={FileText}
          label="Token расход"
          value={`${formatTokens(totalTokensIn + totalTokensOut)}`}
          hint={`in ${formatTokens(totalTokensIn)} / out ${formatTokens(totalTokensOut)}`}
        />
      </div>

      {/* Pilots health */}
      <section className="card-surface p-5">
        <h2 className="font-semibold">Здоровье пилотов</h2>
        <p className="text-xs text-muted-foreground">статусы по активности за последние 7 дней</p>
        <div className="mt-3 overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="text-left text-muted-foreground text-xs">
              <tr className="border-b border-border/60">
                <th className="py-2 pr-2 font-medium">Компания</th>
                <th className="py-2 px-2 font-medium">Пилот до</th>
                <th className="py-2 px-2 font-medium">Founder</th>
                <th className="py-2 px-2 font-medium text-right">Запросов</th>
                <th className="py-2 pl-2 font-medium text-right">Расход</th>
              </tr>
            </thead>
            <tbody>
              {(pilots ?? []).map((p: any) => {
                const usage = (usageRows ?? []).find((u) => u.company_id === p.id);
                const requests = usage?.requests_count ?? 0;
                const costRub = ((usage?.cost_kop ?? 0) / KOPECKS_PER_RUB).toLocaleString("ru", { maximumFractionDigits: 0 });
                const pilotUntil = p.pilot_until ? new Date(p.pilot_until) : null;
                const daysLeft = pilotUntil ? Math.max(0, Math.round((pilotUntil.getTime() - Date.now()) / 86400000)) : null;
                return (
                  <tr key={p.id} className="border-b border-border/40">
                    <td className="py-2 pr-2 font-medium">{p.name}</td>
                    <td className="py-2 px-2 text-muted-foreground tabular-nums">
                      {pilotUntil
                        ? `${pilotUntil.toLocaleDateString("ru")} (${daysLeft} дн)`
                        : "—"}
                    </td>
                    <td className="py-2 px-2">
                      {p.is_founder ? (
                        <span className="text-amber-700 text-xs font-semibold">✓ founder</span>
                      ) : (
                        <span className="text-muted-foreground text-xs">—</span>
                      )}
                    </td>
                    <td className="py-2 px-2 text-right tabular-nums">{requests.toLocaleString("ru")}</td>
                    <td className="py-2 pl-2 text-right tabular-nums">{costRub} ₽</td>
                  </tr>
                );
              })}
              {(!pilots || pilots.length === 0) && (
                <tr>
                  <td colSpan={5} className="py-6 text-center text-sm text-muted-foreground">
                    Нет активных пилотов. Активируйте промокод PILOT2026 для тестовой компании.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </section>

      {/* Top by cost */}
      <section className="card-surface p-5">
        <h2 className="font-semibold">Топ-10 компаний по расходу AI</h2>
        <p className="text-xs text-muted-foreground">за {period} — для контроля юнит-экономики</p>
        <div className="mt-3 overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="text-left text-muted-foreground text-xs">
              <tr className="border-b border-border/60">
                <th className="py-2 pr-2 font-medium">Компания</th>
                <th className="py-2 px-2 font-medium">Тариф</th>
                <th className="py-2 px-2 font-medium text-right">Запросов</th>
                <th className="py-2 px-2 font-medium text-right">Tokens</th>
                <th className="py-2 pl-2 font-medium text-right">Расход</th>
              </tr>
            </thead>
            <tbody>
              {(usageRows ?? []).slice(0, 10).map((row: any) => {
                const planCode = row.companies?.plan ?? "trial";
                const plan = (PLANS as any)[planCode] ?? PLANS.trial;
                const reqLimit = plan.limits.requests;
                const percent = reqLimit ? Math.round((row.requests_count / reqLimit) * 100) : 0;
                const costRub = ((row.cost_kop ?? 0) / KOPECKS_PER_RUB).toLocaleString("ru", { maximumFractionDigits: 0 });
                return (
                  <tr key={row.company_id} className="border-b border-border/40">
                    <td className="py-2 pr-2 font-medium">
                      {row.companies?.name ?? "—"}
                      {row.companies?.is_founder && (
                        <span className="ml-2 text-[10px] text-amber-700 font-semibold">FOUNDER</span>
                      )}
                    </td>
                    <td className="py-2 px-2 text-muted-foreground">{plan.name}</td>
                    <td className="py-2 px-2 text-right tabular-nums">
                      {row.requests_count.toLocaleString("ru")}
                      <span
                        className={
                          percent >= 100
                            ? "ml-2 text-[10px] text-destructive"
                            : percent >= 80
                            ? "ml-2 text-[10px] text-[#B45309]"
                            : "ml-2 text-[10px] text-muted-foreground"
                        }
                      >
                        {percent}%
                      </span>
                    </td>
                    <td className="py-2 px-2 text-right tabular-nums text-muted-foreground">
                      {formatTokens((row.tokens_input ?? 0) + (row.tokens_output ?? 0))}
                    </td>
                    <td className="py-2 pl-2 text-right tabular-nums font-medium">{costRub} ₽</td>
                  </tr>
                );
              })}
              {(!usageRows || usageRows.length === 0) && (
                <tr>
                  <td colSpan={5} className="py-6 text-center text-sm text-muted-foreground">
                    Пока нет данных за этот период.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </section>

      <section className="card-surface p-5 bg-amber-50/50 border-amber-200/40">
        <div className="flex items-start gap-3">
          <AlertCircle className="w-5 h-5 text-amber-700 flex-shrink-0 mt-0.5" />
          <div className="text-sm">
            <p className="font-semibold text-amber-900">Учёт расхода токенов</p>
            <p className="text-amber-900/80 text-[13px] mt-1">
              Чтобы метрики токенов и стоимости работали, обновите /api/chat и /api/upload — добавьте вызов{" "}
              <code className="bg-amber-100 px-1.5 py-0.5 rounded">supabase.rpc(&quot;increment_usage&quot;, &#123; ..., p_tokens_input, p_tokens_output, p_cost_kop &#125;)</code>{" "}
              после получения ответа от AI. До этого таблица показывает 0 ₽ расход.
            </p>
          </div>
        </div>
      </section>
    </div>
  );
}

function Stat({
  icon: Icon,
  label,
  value,
  hint,
  tone = "default",
}: {
  icon: any;
  label: string;
  value: string | number;
  hint?: string;
  tone?: "default" | "good" | "warn" | "bad" | "muted";
}) {
  const toneStyles: Record<string, string> = {
    default: "",
    good: "text-[#059669]",
    warn: "text-[#B45309]",
    bad: "text-destructive",
    muted: "text-muted-foreground",
  };
  return (
    <div className="card-surface p-4">
      <div className="flex items-center gap-2 text-xs text-muted-foreground">
        <Icon className="w-3.5 h-3.5" />
        {label}
      </div>
      <div className={`mt-1.5 text-xl font-semibold tabular-nums ${toneStyles[tone]}`}>
        {typeof value === "number" ? value.toLocaleString("ru") : value}
      </div>
      {hint && <div className="text-[11px] text-muted-foreground mt-0.5">{hint}</div>}
    </div>
  );
}

// inline crown icon (избегаем доп.import)
function Crown_({ className }: { className?: string }) {
  return (
    <svg className={className} width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M2 4l3 12h14l3-12-6 7-4-7-4 7-6-7zm3 16h14" />
    </svg>
  );
}

function formatTokens(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}k`;
  return String(n);
}
