import { NextResponse } from "next/server";
import { evaluateEvidence, isEvaluationInput } from "@/lib/themis";

export const runtime = "nodejs";

export async function POST(request: Request) {
  try {
    const payload = (await request.json()) as unknown;
    if (!isEvaluationInput(payload)) return NextResponse.json({ error: "Invalid evidence bundle" }, { status: 400 });
    return NextResponse.json(evaluateEvidence(payload));
  } catch {
    return NextResponse.json({ error: "Malformed request" }, { status: 400 });
  }
}
