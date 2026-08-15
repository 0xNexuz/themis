import { NextResponse } from "next/server";
import { evaluateEvidence, isEvaluationInput } from "@/lib/themis";
import { finalizeEvidence } from "@/lib/finalize";
import { audit, checkRateLimit, isAuthorizedUnsignedRequest } from "@/lib/security";

export const runtime = "nodejs";

export async function POST(request: Request) {
  const rate = checkRateLimit(request, "evaluate", 12);
  if (!rate.allowed) return NextResponse.json({ error: "Rate limit exceeded" }, { status: 429, headers: { "Retry-After": String(rate.retryAfter) } });
  if (!isAuthorizedUnsignedRequest(request)) return NextResponse.json({ error: "Use a same-origin request, API bearer key, or the signed agent endpoint" }, { status: 401 });
  try {
    const payload = (await request.json()) as unknown;
    if (!isEvaluationInput(payload)) return NextResponse.json({ error: "Invalid evidence bundle" }, { status: 400 });
    const receipt = evaluateEvidence(payload);
    const finalized = await finalizeEvidence(payload, receipt);
    audit("receipt.issued", { receiptId: finalized.receiptId, decision: finalized.decision, storage: finalized.storage.status });
    return NextResponse.json(finalized);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Malformed request";
    const status = message.startsWith("EVIDENCE_STORAGE_REQUIRED") ? 503 : 400;
    return NextResponse.json({ error: message }, { status });
  }
}
