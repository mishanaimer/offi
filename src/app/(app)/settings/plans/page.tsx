import { createClient } from "@/lib/supabase/server";
import { PlansView } from "./plans-view";
import { currentPeriod } from "@/lib/plans";

export const dynamic = "force-dynamic";

export default async function PlansPage() {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const [
    { data: company },
    { data: me },
    { data: employees },
    docsRes,
    memsRes,
    actionsRes,
    usageRes,
    { data: lastRequest },
  ] = await Promise.all([
    supabase.from("companies").select("*").maybeSingle(),
    supabase.from("users").select("role").eq("id", user!.id).maybeSingle(),
    supabase.from("users").select("id"),
    supabase.from("documents").select("id", { count: "exact", head: true }),
    supabase.from("memories").select("id", { count: "exact", head: true }),
    supabase.from("action_log").select("id", { count: "exact", head: true }),
    supabase
      .from("usage_counters")
      .select("*")
      .eq("period", currentPeriod())
      .maybeSingle(),
    supabase
      .from("plan_requests")
      .select("plan, billing_period, status, created_at")
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle(),
  ]);

  return (
    <PlansView
      company={company!}
      currentUserRole={(me?.role as any) ?? "member"}
      usage={{
        requestsCount: usageRes.data?.requests_count ?? 0,
        actionsCount: usageRes.data?.actions_count ?? 0,
        documentsCount: docsRes.count ?? 0,
        memoriesCount: memsRes.count ?? 0,
        actionsLogCount: actionsRes.count ?? 0,
        employeesCount: employees?.length ?? 0,
      }}
      lastRequest={lastRequest ?? null}
    />
  );
}
