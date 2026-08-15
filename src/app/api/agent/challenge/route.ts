import { NextResponse } from "next/server";
import { AGENT_REQUEST_TTL_MS, issueAgentChallenge } from "@/lib/agent";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export function GET() {
  const { timestamp, nonce } = issueAgentChallenge();
  return NextResponse.json({
    timestamp,
    nonce,
    expiresAt: timestamp + AGENT_REQUEST_TTL_MS,
    signatureScheme: "eip191",
  }, {
    headers: { "Cache-Control": "no-store" },
  });
}
