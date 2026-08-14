import { NextResponse } from "next/server";
import { evaluateEvidence, type EvaluationInput } from "@/lib/themis";

export const runtime = "nodejs";

function isValidInput(value: unknown): value is EvaluationInput {
  if (!value || typeof value !== "object") return false;
  const input = value as Partial<EvaluationInput>;
  return typeof input.task === "string" && typeof input.maxSpend === "number" && Boolean(input.result) && typeof input.result?.summary === "string" && Array.isArray(input.result?.sources) && input.result.sources.every((source) => typeof source === "string") && typeof input.result?.amount === "number";
}

export async function POST(request: Request) {
  try {
    const payload = (await request.json()) as unknown;
    if (!isValidInput(payload)) return NextResponse.json({ error: "Invalid evidence bundle" }, { status: 400 });
    return NextResponse.json(evaluateEvidence(payload));
  } catch {
    return NextResponse.json({ error: "Malformed request" }, { status: 400 });
  }
}
