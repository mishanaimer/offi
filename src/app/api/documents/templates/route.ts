import { listTemplates } from "@/lib/contract-generator/registry";

export const runtime = "nodejs";

export async function GET() {
  const templates = await listTemplates();
  return Response.json({ templates });
}
