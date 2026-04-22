import { createClient } from "@/lib/supabase/server";
import { KnowledgeView } from "./knowledge-view";
import { currentPeriod } from "@/lib/plans";

export const dynamic = "force-dynamic";

export default async function KnowledgePage() {
  const supabase = createClient();

  const [{ data: documents }, { data: memories }, { data: company }, chunksRes, usageRes] =
    await Promise.all([
      supabase
        .from("documents")
        .select("id, name, source_type, chunks_count, status, created_at")
        .order("created_at", { ascending: false }),
      supabase
        .from("memories")
        .select("id, content, kind, source, created_at")
        .order("created_at", { ascending: false })
        .limit(500),
      supabase.from("companies").select("plan").maybeSingle(),
      supabase.from("chunks").select("id", { count: "exact", head: true }),
      supabase
        .from("usage_counters")
        .select("requests_count")
        .eq("period", currentPeriod())
        .maybeSingle(),
    ]);

  return (
    <KnowledgeView
      initialDocuments={documents ?? []}
      initialMemories={memories ?? []}
      stats={{
        documentsCount: documents?.length ?? 0,
        memoriesCount: memories?.length ?? 0,
        chunksCount: chunksRes.count ?? 0,
        requestsUsed: usageRes.data?.requests_count ?? 0,
        plan: ((company?.plan as any) ?? "trial"),
      }}
    />
  );
}
