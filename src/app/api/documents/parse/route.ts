import { NextRequest } from "next/server";
import { parseRequisites } from "@/lib/contract-generator/parse-requisites";

export const runtime = "nodejs";

export async function POST(req: NextRequest) {
  const { text } = (await req.json()) as { text?: string };
  if (typeof text !== "string") {
    return new Response("text required", { status: 400 });
  }
  const parsed = parseRequisites(text);
  return Response.json(parsed);
}
