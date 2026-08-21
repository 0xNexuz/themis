import { NextResponse } from "next/server";

export function GET() {
  const storageRequired = process.env.THEMIS_REQUIRE_STORAGE === "true";
  const storageConfigured = Boolean(process.env.OG_STORAGE_PRIVATE_KEY && process.env.THEMIS_EVIDENCE_ENCRYPTION_KEY);
  return NextResponse.json({
    service: "themis-verifier",
    status: storageRequired && !storageConfigured ? "degraded" : "ok",
    version: "0.4.0",
    escrowAddress: process.env.THEMIS_ESCROW_ADDRESS ?? "0x0B1Cdef5CE5EE077BFEC7d8B50C3fE3073857640",
    capabilities: {
      encryptedStorage: storageConfigured,
      storageRequired,
      compute: Boolean(process.env.OG_COMPUTE_PRIVATE_KEY),
      verifier: Boolean(process.env.THEMIS_VERIFIER_PRIVATE_KEY),
      signedAgents: Boolean(process.env.THEMIS_CHALLENGE_SECRET || process.env.THEMIS_VERIFIER_PRIVATE_KEY),
      durableJobs: Boolean(process.env.UPSTASH_REDIS_REST_URL && process.env.UPSTASH_REDIS_REST_TOKEN),
      liveDemo: Boolean(process.env.THEMIS_DEMO_USDC_ADDRESS && process.env.THEMIS_DEMO_BUYER_PRIVATE_KEY && process.env.THEMIS_DEMO_WORKER_PRIVATE_KEY && process.env.THEMIS_DEMO_AGENTIC_ID),
    },
    time: new Date().toISOString(),
  });
}
