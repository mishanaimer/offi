import { createClient } from "@/lib/supabase/server";
import { ClientsView } from "./clients-view";
import { CLIENT_LIST_COLUMNS } from "@/lib/clients";

export const dynamic = "force-dynamic";

export default async function ClientsPage() {
  const supabase = createClient();
  const { data: clients } = await supabase
    .from("clients")
    .select(CLIENT_LIST_COLUMNS)
    .order("last_contact_at", { ascending: false, nullsFirst: false })
    .order("created_at", { ascending: false })
    .limit(300);
  return <ClientsView initialClients={(clients ?? []) as any} />;
}
