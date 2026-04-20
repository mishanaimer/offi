import { createClient } from "@/lib/supabase/server";
import { KnowledgeView } from "./knowledge-view";

export const dynamic = "force-dynamic";

export default async function KnowledgePage() {
  const supabase = createClient();
  const { data: documents } = await supabase
    .from("documents")
    .select("*")
    .order("created_at", { ascending: false });

  return <KnowledgeView initialDocuments={documents ?? []} />;
}
