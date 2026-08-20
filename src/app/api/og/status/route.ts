import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";
const RPC_URL = process.env.OG_RPC_URL ?? "https://evmrpc-testnet.0g.ai";

export async function GET() {
  let online = false;
  let blockNumber: string | null = null;
  try {
    const response = await fetch(RPC_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ jsonrpc: "2.0", id: 1, method: "eth_blockNumber", params: [] }),
      signal: AbortSignal.timeout(5000),
      cache: "no-store",
    });
    const payload = (await response.json()) as { result?: string };
    if (payload.result) {
      online = true;
      blockNumber = Number.parseInt(payload.result, 16).toLocaleString("en-US");
    }
  } catch {
    online = false;
  }
  return NextResponse.json({
    network: { name: "0G Galileo Testnet", chainId: 16602, rpc: RPC_URL },
    chain: { online, blockNumber },
    compute: { sdk: true, signerConfigured: Boolean(process.env.OG_COMPUTE_PRIVATE_KEY), providerConfigured: Boolean(process.env.OG_COMPUTE_PROVIDER), funded: "not-checked" },
    storage: { sdk: true, signerConfigured: Boolean(process.env.OG_STORAGE_PRIVATE_KEY), encryptionConfigured: Boolean(process.env.THEMIS_EVIDENCE_ENCRYPTION_KEY) },
    escrow: { address: process.env.THEMIS_ESCROW_ADDRESS ?? "0x0B1Cdef5CE5EE077BFEC7d8B50C3fE3073857640", version: process.env.THEMIS_ESCROW_VERSION ?? "2" },
    demo: { asset: process.env.THEMIS_DEMO_USDC_ADDRESS ?? null, durableJobs: Boolean(process.env.UPSTASH_REDIS_REST_URL) },
  });
}
