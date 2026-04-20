import { NextRequest } from "next/server";
import { classify } from "@/lib/ai";

export const runtime = "nodejs";

export async function POST(req: NextRequest) {
  const { text } = await req.json();
  if (!text) return Response.json({ type: "question", confidence: 0 });
  try {
    const result = await classify(text);
    return Response.json(result);
  } catch (e) {
    return Response.json({ type: "question", confidence: 0, error: (e as Error).message }, { status: 500 });
  }
}
