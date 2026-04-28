import { loadConfig } from "@/lib/contract-generator/registry";

export const runtime = "nodejs";

export async function GET(_req: Request, { params }: { params: { id: string } }) {
  try {
    const config = await loadConfig(params.id);
    return Response.json({
      id: params.id,
      name: config.name,
      description: config.description,
      fields: config.fields,
    });
  } catch (err) {
    return new Response((err as Error).message, { status: 404 });
  }
}
