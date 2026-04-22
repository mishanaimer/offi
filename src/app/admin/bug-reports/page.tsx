import { createServiceClient } from "@/lib/supabase/server";
import { formatDate } from "@/lib/utils";
import { BugRow } from "./bug-row";
import { AlertTriangle } from "lucide-react";

export const dynamic = "force-dynamic";

type Report = {
  id: string;
  subject: string | null;
  message: string;
  severity: "low" | "normal" | "high" | "critical";
  status: "new" | "in_progress" | "resolved" | "dismissed";
  email: string | null;
  page_url: string | null;
  details: Record<string, unknown> | null;
  admin_notes: string | null;
  created_at: string;
  resolved_at: string | null;
  companies: { name: string } | null;
  users: { full_name: string | null; email: string | null } | null;
};

export default async function AdminBugReports({
  searchParams,
}: {
  searchParams?: { status?: string };
}) {
  const service = createServiceClient();
  const filter = searchParams?.status ?? "open";

  let query = service
    .from("bug_reports")
    .select(
      "id, subject, message, severity, status, email, page_url, details, admin_notes, created_at, resolved_at, companies:companies(name), users:users(full_name, email)"
    )
    .order("created_at", { ascending: false })
    .limit(300);

  if (filter === "open") {
    query = query.in("status", ["new", "in_progress"]);
  } else if (filter !== "all") {
    query = query.eq("status", filter);
  }

  const { data: reports } = await query;

  const [
    { count: newCount },
    { count: progressCount },
    { count: resolvedCount },
  ] = await Promise.all([
    service.from("bug_reports").select("id", { count: "exact", head: true }).eq("status", "new"),
    service
      .from("bug_reports")
      .select("id", { count: "exact", head: true })
      .eq("status", "in_progress"),
    service
      .from("bug_reports")
      .select("id", { count: "exact", head: true })
      .eq("status", "resolved"),
  ]);

  const tabs: Array<{ key: string; label: string; badge?: number }> = [
    { key: "open", label: "Открытые", badge: (newCount ?? 0) + (progressCount ?? 0) },
    { key: "new", label: "Новые", badge: newCount ?? 0 },
    { key: "in_progress", label: "В работе", badge: progressCount ?? 0 },
    { key: "resolved", label: "Решено", badge: resolvedCount ?? 0 },
    { key: "dismissed", label: "Отклонено" },
    { key: "all", label: "Все" },
  ];

  return (
    <div className="container-page max-w-5xl py-8 space-y-5">
      <div className="flex items-center gap-3">
        <span className="w-9 h-9 rounded-xl grid place-items-center bg-[#F59E0B]/15 text-[#B45309]">
          <AlertTriangle className="w-4 h-4" />
        </span>
        <div>
          <h1 className="text-xl font-semibold leading-tight">Обращения об ошибках</h1>
          <p className="text-[12px] text-muted-foreground">
            Пользователи отправляют их через «!» в правом нижнем углу приложения.
          </p>
        </div>
      </div>

      <nav className="flex flex-wrap gap-1.5">
        {tabs.map((t) => {
          const active = filter === t.key;
          return (
            <a
              key={t.key}
              href={`/admin/bug-reports?status=${t.key}`}
              className={
                "inline-flex items-center gap-1.5 rounded-full px-3 h-8 text-[13px] border transition " +
                (active
                  ? "bg-foreground text-background border-foreground"
                  : "bg-card border-border text-muted-foreground hover:bg-muted")
              }
            >
              {t.label}
              {typeof t.badge === "number" && t.badge > 0 && (
                <span
                  className={
                    "text-[10px] rounded-full px-1.5 py-0.5 font-medium " +
                    (active
                      ? "bg-background/20 text-background"
                      : "bg-muted text-foreground")
                  }
                >
                  {t.badge}
                </span>
              )}
            </a>
          );
        })}
      </nav>

      <section className="space-y-3">
        {((reports as unknown) as Report[] | null)?.length ? (
          (reports as unknown as Report[]).map((r) => (
            <BugRow key={r.id} r={r} />
          ))
        ) : (
          <div className="card-surface py-14 text-center text-sm text-muted-foreground">
            Обращений нет.
          </div>
        )}
      </section>
    </div>
  );
}
