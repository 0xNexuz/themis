import { Contract, JsonRpcProvider } from "ethers";
import { NextResponse } from "next/server";
import { AGENTIC_ID_REGISTRY } from "@/lib/agent";
import { OG_NETWORK } from "@/lib/og/config";

export async function GET(_request: Request, context: { params: Promise<{ agenticId: string }> }) {
  const { agenticId } = await context.params;
  if (!/^\d+$/.test(agenticId)) return NextResponse.json({ error: "Invalid Agentic ID" }, { status: 400 });
  try {
    const registry = new Contract(AGENTIC_ID_REGISTRY, [
      "function ownerOf(uint256) view returns (address)",
      "function tokenURI(uint256) view returns (string)",
      "function getApproved(uint256) view returns (address)",
    ], new JsonRpcProvider(OG_NETWORK.rpcUrl));
    const [owner, tokenURI, approved] = await Promise.all([
      registry.ownerOf(BigInt(agenticId)),
      registry.tokenURI(BigInt(agenticId)).catch(() => null),
      registry.getApproved(BigInt(agenticId)).catch(() => null),
    ]);
    return NextResponse.json({ agenticId, registry: AGENTIC_ID_REGISTRY, owner, approved, tokenURI });
  } catch {
    return NextResponse.json({ error: "Agentic ID not found" }, { status: 404 });
  }
}
