import {
  AbiCoder,
  Contract,
  JsonRpcProvider,
  Wallet,
  getAddress,
  getBytes,
  isAddress,
  keccak256,
  verifyMessage,
} from "ethers";
import { OG_NETWORK } from "./og/config";
import { evaluateEvidence, type EvaluationInput } from "./themis";

export const AGENTIC_ID_REGISTRY = "0x2700F6A3e505402C9daB154C5c6ab9cAEC98EF1F";
export const AGENT_REQUEST_TTL_MS = 5 * 60 * 1000;

export type AgentIdentity = {
  address: string;
  agenticId?: string;
  timestamp: number;
  nonce: string;
  signature: string;
};

export type SettlementRequest = {
  escrowAddress: string;
  taskId: string;
  deadline: number;
};

export type AgentEvaluationEnvelope = {
  agent: AgentIdentity;
  evidence: EvaluationInput;
  settlement?: SettlementRequest;
};

export function buildAgentRequestMessage(
  identity: Omit<AgentIdentity, "signature">,
  evidenceHash: string,
) {
  return [
    "THEMIS_AGENT_REQUEST_V1",
    `address=${getAddress(identity.address)}`,
    `agenticId=${identity.agenticId ?? "none"}`,
    `timestamp=${identity.timestamp}`,
    `nonce=${identity.nonce}`,
    `evidenceHash=${evidenceHash}`,
  ].join("\n");
}

export async function verifyAgentIdentity(identity: AgentIdentity, evidence: EvaluationInput) {
  if (!isAddress(identity.address)) throw new Error("INVALID_AGENT_ADDRESS");
  if (!Number.isSafeInteger(identity.timestamp) || Math.abs(Date.now() - identity.timestamp) > AGENT_REQUEST_TTL_MS) {
    throw new Error("STALE_AGENT_REQUEST");
  }
  if (!/^[a-zA-Z0-9_-]{8,96}$/.test(identity.nonce)) throw new Error("INVALID_NONCE");

  const receipt = evaluateEvidence(evidence);
  const message = buildAgentRequestMessage(identity, receipt.evidenceHash);
  const recovered = getAddress(verifyMessage(message, identity.signature));
  const requested = getAddress(identity.address);
  if (recovered !== requested) throw new Error("INVALID_AGENT_SIGNATURE");

  let agenticIdVerified = false;
  if (identity.agenticId !== undefined) {
    if (!/^\d+$/.test(identity.agenticId)) throw new Error("INVALID_AGENTIC_ID");
    agenticIdVerified = await verifyAgenticIdController(identity.agenticId, requested);
    if (!agenticIdVerified) throw new Error("AGENTIC_ID_NOT_CONTROLLED");
  }

  return { receipt, signer: recovered, agenticIdVerified, message };
}

async function verifyAgenticIdController(tokenId: string, signer: string) {
  const provider = new JsonRpcProvider(OG_NETWORK.rpcUrl);
  const registry = new Contract(AGENTIC_ID_REGISTRY, [
    "function ownerOf(uint256 tokenId) view returns (address)",
    "function getApproved(uint256 tokenId) view returns (address)",
    "function isApprovedForAll(address owner, address operator) view returns (bool)",
  ], provider);
  const owner = getAddress(await registry.ownerOf(BigInt(tokenId)));
  if (owner === signer) return true;
  try {
    const approved = getAddress(await registry.getApproved(BigInt(tokenId)));
    if (approved === signer) return true;
    return Boolean(await registry.isApprovedForAll(owner, signer));
  } catch {
    return false;
  }
}

export async function signSettlementAuthorization(
  settlement: SettlementRequest,
  evidenceHash: string,
  release: boolean,
) {
  const privateKey = process.env.THEMIS_VERIFIER_PRIVATE_KEY;
  if (!privateKey) return null;
  if (!isAddress(settlement.escrowAddress)) throw new Error("INVALID_ESCROW_ADDRESS");
  if (!/^\d+$/.test(settlement.taskId)) throw new Error("INVALID_TASK_ID");
  if (!Number.isSafeInteger(settlement.deadline) || settlement.deadline <= Math.floor(Date.now() / 1000)) {
    throw new Error("INVALID_SETTLEMENT_DEADLINE");
  }

  const coder = AbiCoder.defaultAbiCoder();
  const hash = keccak256(coder.encode(
    ["address", "uint256", "uint256", "bytes32", "bool", "uint256"],
    [settlement.escrowAddress, OG_NETWORK.chainId, settlement.taskId, evidenceHash, release, settlement.deadline],
  ));
  const wallet = new Wallet(privateKey);
  return {
    verifier: wallet.address,
    hash,
    signature: await wallet.signMessage(getBytes(hash)),
    ...settlement,
    release,
  };
}

export function getAgentManifest(origin: string) {
  return {
    name: "Themis",
    version: "0.2.0",
    description: "Evidence-gated settlement and proof receipts for autonomous agents on 0G.",
    network: {
      name: OG_NETWORK.name,
      chainId: OG_NETWORK.chainId,
      rpc: OG_NETWORK.rpcUrl,
      explorer: OG_NETWORK.explorerUrl,
      faucet: "https://faucet.0g.ai/",
    },
    identity: {
      scheme: "eip191",
      agenticId: { optional: true, registry: AGENTIC_ID_REGISTRY, standard: "ERC-7857" },
      requestTtlSeconds: AGENT_REQUEST_TTL_MS / 1000,
    },
    endpoints: {
      evaluate: `${origin}/api/agent/evaluate`,
      unsignedEvaluate: `${origin}/api/evaluate`,
      contractArtifact: `${origin}/api/contracts/themis-escrow`,
      health: `${origin}/api/health`,
      networkStatus: `${origin}/api/og/status`,
      documentation: `${origin}/docs#agents`,
    },
  };
}
