import { NextResponse } from "next/server";

export function GET() {
  const storageRequired = process.env.THEMIS_REQUIRE_STORAGE === "true";
  const storageConfigured = Boolean(process.env.OG_STORAGE_PRIVATE_KEY && process.env.THEMIS_EVIDENCE_ENCRYPTION_KEY);
  return NextResponse.json({
    service: "themis-verifier",
    status: storageRequired && !storageConfigured ? "degraded" : "ok",
    version: "0.3.0",
    escrowAddress: process.env.THEMIS_ESCROW_ADDRESS ?? "0x46032577415dfaeddc9758a9d72bc16c47cb1c47",
    capabilities: {
      encryptedStorage: storageConfigured,
      storageRequired,
      compute: Boolean(process.env.OG_COMPUTE_PRIVATE_KEY),
      verifier: Boolean(process.env.THEMIS_VERIFIER_PRIVATE_KEY),
      signedAgents: Boolean(process.env.THEMIS_CHALLENGE_SECRET || process.env.THEMIS_VERIFIER_PRIVATE_KEY),
    },
    time: new Date().toISOString(),
  });
}
