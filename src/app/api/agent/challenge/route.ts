import { randomBytes } from "node:crypto";
import { NextResponse } from "next/server";
import { AGENT_REQUEST_TTL_MS } from "@/lib/agent";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export function GET() {
  const timestamp = Date.now();
  return NextResponse.json({
    timestamp,
    nonce: randomBytes(16).toString("hex"),
    expiresAt: timestamp + AGENT_REQUEST_TTL_MS,
    signatureScheme: "eip191",
  }, {
    headers: { "Cache-Control": "no-store" },
  });
}
