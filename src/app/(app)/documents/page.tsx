import { createClient } from "@/lib/supabase/server";
import { DocumentsView } from "./documents-view";

export const dynamic = "force-dynamic";

export default async function DocumentsPage() {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();

  const profilePromise = user
    ? supabase
        .from("users")
        .select("full_name, email, company:companies(name, assistant_name)")
        .eq("id", user.id)
        .single()
    : null;

  const [{ data: templates }, { data: clients }, profileRes] = await Promise.all([
    supabase
      .from("templates")
      .select("id, name, body, variables, created_at, updated_at")
      .order("updated_at", { ascending: false, nullsFirst: false })
      .order("created_at", { ascending: false }),
    supabase.from("clients").select("id, name, short_name, contact, email, phone, inn"),
    profilePromise,
  ]);

  const profile = profileRes?.data as any;
  const me = profile
    ? { full_name: profile.full_name ?? null, email: profile.email ?? null }
    : undefined;
  const company = profile?.company
    ? { name: profile.company.name ?? null, assistant_name: profile.company.assistant_name ?? null }
    : undefined;

  return (
    <DocumentsView
      templates={templates ?? []}
      clients={(clients ?? []) as any}
      user={me}
      company={company}
    />
  );
}
