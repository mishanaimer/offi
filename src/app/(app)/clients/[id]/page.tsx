import { notFound } from "next/navigation";
import { createClient, createServiceClient } from "@/lib/supabase/server";
import { CLIENT_FULL_COLUMNS } from "@/lib/clients";
import { ClientDetailView } from "./client-detail-view";

export const dynamic = "force-dynamic";

export default async function ClientPage({ params }: { params: { id: string } }) {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) notFound();

  const { data: profile } = await supabase
    .from("users")
    .select("company_id")
    .eq("id", user.id)
    .single();
  const companyId = profile?.company_id as string | undefined;
  if (!companyId) notFound();

  const [
    { data: client },
    { data: notes },
    { data: files },
    { data: contractsRaw },
    { data: memories },
    { data: templates },
  ] = await Promise.all([
    supabase.from("clients").select(CLIENT_FULL_COLUMNS).eq("id", params.id).single(),
    supabase
      .from("client_notes")
      .select("id, content, source, created_at, user_id")
      .eq("client_id", params.id)
      .order("created_at", { ascending: false })
      .limit(100),
    supabase
      .from("client_files")
      .select("id, name, size_bytes, mime, kind, storage_path, created_at")
      .eq("client_id", params.id)
      .order("created_at", { ascending: false }),
    supabase
      .from("generated_contracts")
      .select(
        "id, template_id, name, storage_path, download_url, warnings, created_at, contract_templates(name)"
      )
      .eq("client_id", params.id)
      .order("created_at", { ascending: false })
      .limit(50),
    supabase
      .from("memories")
      .select("id, content, kind, created_at")
      .eq("client_id", params.id)
      .order("created_at", { ascending: false })
      .limit(50),
    supabase
      .from("contract_templates")
      .select("id, name, description")
      .eq("company_id", companyId)
      .order("created_at", { ascending: false }),
  ]);

  if (!client) notFound();

  const contracts = (contractsRaw ?? []).map((r: any) => ({
    id: r.id,
    template_id: r.template_id,
    template_name: r.contract_templates?.name ?? null,
    name: r.name,
    storage_path: r.storage_path,
    download_url: r.download_url,
    warnings: r.warnings ?? null,
    created_at: r.created_at,
  }));

  return (
    <ClientDetailView
      client={client as any}
      initialNotes={notes ?? []}
      initialFiles={files ?? []}
      initialContracts={contracts}
      initialMemories={memories ?? []}
      templates={templates ?? []}
    />
  );
}
