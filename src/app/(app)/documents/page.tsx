import { createClient } from "@/lib/supabase/server";
import { DocumentsView } from "./documents-view";

export const dynamic = "force-dynamic";

export default async function DocumentsPage() {
  const supabase = createClient();
  const [{ data: templates }, { data: clients }] = await Promise.all([
    supabase.from("templates").select("*").order("created_at", { ascending: false }),
    supabase.from("clients").select("id, name, contact, email, phone"),
  ]);
  return <DocumentsView templates={templates ?? []} clients={clients ?? []} />;
}
