import { NextRequest } from "next/server";
import { loadConfig, loadTemplateBuffer } from "@/lib/contract-generator/registry";
import { generateAndPreview } from "@/lib/contract-generator/generator";

export const runtime = "nodejs";
export const maxDuration = 60;

export async function POST(req: NextRequest) {
  const body = (await req.json()) as { template_id?: string; data?: Record<string, string> };
  const { template_id, data } = body;
  if (!template_id || !data) {
    return new Response("template_id and data required", { status: 400 });
  }

  let config, templateBuffer;
  try {
    config = await loadConfig(template_id);
    templateBuffer = await loadTemplateBuffer(config);
  } catch (err) {
    return new Response((err as Error).message, { status: 404 });
  }

  try {
    const result = await generateAndPreview({ templateBuffer, config, data });
    return Response.json(result);
  } catch (err) {
    return new Response("Ошибка генерации: " + (err as Error).message, { status: 500 });
  }
}
