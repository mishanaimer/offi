import { NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { deleteCompanyTemplate, getTemplateDetails } from "@/lib/contract-generator/registry";

export const runtime = "nodejs";

async function getCompanyId(): Promise<{ companyId: string | null; userId: string | null }> {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { companyId: null, userId: null };
  const { data: profile } = await supabase
    .from("users")
    .select("company_id")
    .eq("id", user.id)
    .single();
  return { companyId: (profile?.company_id as string) ?? null, userId: user.id };
}

export async function GET(_req: NextRequest, { params }: { params: { id: string } }) {
  const { companyId } = await getCompanyId();
  try {
    const { meta, fields } = await getTemplateDetails(params.id, companyId);
    return Response.json({
      id: meta.id,
      name: meta.name,
      description: meta.description,
      source: meta.source,
      canDelete: meta.canDelete,
      warnings: meta.warnings ?? [],
      fields,
    });
  } catch (err) {
    return new Response((err as Error).message, { status: 404 });
  }
}

export async function DELETE(_req: NextRequest, { params }: { params: { id: string } }) {
  const { companyId } = await getCompanyId();
  if (!companyId) return new Response("unauthorized", { status: 401 });
  try {
    await deleteCompanyTemplate(params.id, companyId);
    return Response.json({ ok: true });
  } catch (err) {
    return new Response((err as Error).message, { status: 400 });
  }
}
