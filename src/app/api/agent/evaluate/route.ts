import { NextResponse } from "next/server";
import { signSettlementAuthorization, verifyAgentIdentity, type AgentEvaluationEnvelope } from "@/lib/agent";
import { isEvaluationInput } from "@/lib/themis";

export const runtime = "nodejs";

function isAgentEnvelope(value: unknown): value is AgentEvaluationEnvelope {
  if (!value || typeof value !== "object") return false;
  const envelope = value as Partial<AgentEvaluationEnvelope>;
  return Boolean(envelope.agent)
    && typeof envelope.agent?.address === "string"
    && typeof envelope.agent?.timestamp === "number"
    && typeof envelope.agent?.nonce === "string"
    && typeof envelope.agent?.signature === "string"
    && isEvaluationInput(envelope.evidence);
}

export async function POST(request: Request) {
  try {
    const payload = (await request.json()) as unknown;
    if (!isAgentEnvelope(payload)) return NextResponse.json({ error: "Invalid agent envelope" }, { status: 400 });

    const verified = await verifyAgentIdentity(payload.agent, payload.evidence);
    const authorization = payload.settlement
      ? await signSettlementAuthorization(
        payload.settlement,
        verified.receipt.evidenceHash,
        verified.receipt.decision === "release",
      )
      : null;

    return NextResponse.json({
      ...verified.receipt,
      agent: {
        signer: verified.signer,
        agenticId: payload.agent.agenticId ?? null,
        agenticIdVerified: verified.agenticIdVerified,
      },
      settlementAuthorization: authorization,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "AGENT_VERIFICATION_FAILED";
    const status = message === "STALE_AGENT_REQUEST" ? 408 : 403;
    return NextResponse.json({ error: message }, { status });
  }
}
