import { createClient } from "@/lib/supabase/server";
import { ClientsView } from "./clients-view";

export const dynamic = "force-dynamic";

export default async function ClientsPage() {
  const supabase = createClient();
  const { data: clients } = await supabase
    .from("clients")
    .select("*")
    .order("created_at", { ascending: false });
  return <ClientsView initialClients={clients ?? []} />;
}
