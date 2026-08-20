import {
  Contract,
  JsonRpcProvider,
  Wallet,
  getAddress,
  isAddress,
  verifyMessage,
  verifyTypedData,
} from "ethers";
import { createHmac, randomBytes, timingSafeEqual } from "node:crypto";
import { OG_NETWORK } from "./og/config";
import { evaluateEvidence, type EvaluationInput } from "./themis";
import { consumeNonce } from "./job-store";

export const AGENTIC_ID_REGISTRY = "0x2700F6A3e505402C9daB154C5c6ab9cAEC98EF1F";
export const AGENT_REQUEST_TTL_MS = 5 * 60 * 1000;

export type AgentIdentity = {
  address: string;
  agenticId?: string;
  timestamp: number;
  nonce: string;
  signature: string;
  scheme?: "eip191" | "eip712";
  method?: string;
  path?: string;
  bodyHash?: string;
};

export type SettlementRequest = {
  escrowAddress: string;
  taskId: string;
  deadline: number;
  buyer: string;
  worker: string;
  policyHash: string;
  amount: string;
  nonce: string;
};

export type AgentEvaluationEnvelope = {
  agent: AgentIdentity;
  evidence: EvaluationInput;
  settlement?: SettlementRequest;
};

function challengeSecret() {
  const secret = process.env.THEMIS_CHALLENGE_SECRET ?? process.env.THEMIS_VERIFIER_PRIVATE_KEY;
  if (!secret && process.env.NODE_ENV === "production") throw new Error("CHALLENGE_SECRET_NOT_CONFIGURED");
  if (!secret) return "themis-local-development-challenge-secret";
  return secret;
}

export function issueAgentChallenge(timestamp = Date.now()) {
  const random = randomBytes(8).toString("hex");
  const signature = createHmac("sha256", challengeSecret()).update(`${timestamp}:${random}`).digest("hex");
  return { timestamp, nonce: `${random}${signature}` };
}

function verifyChallenge(timestamp: number, nonce: string) {
  if (!/^[a-f0-9]{80}$/.test(nonce)) return false;
  const random = nonce.slice(0, 16);
  const supplied = Buffer.from(nonce.slice(16), "hex");
  const expected = createHmac("sha256", challengeSecret()).update(`${timestamp}:${random}`).digest();
  return timingSafeEqual(supplied, expected);
}

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

export function buildAgentRequestTypedData(identity: Omit<AgentIdentity, "signature">, evidenceHash: string) {
  return {
    domain: { name: "Themis Agent API", version: "2", chainId: OG_NETWORK.chainId },
    types: { AgentRequest: [{ name: "address", type: "address" }, { name: "agenticId", type: "string" }, { name: "timestamp", type: "uint256" }, { name: "nonce", type: "string" }, { name: "method", type: "string" }, { name: "path", type: "string" }, { name: "bodyHash", type: "bytes32" }, { name: "evidenceHash", type: "bytes32" }] },
    value: { address: getAddress(identity.address), agenticId: identity.agenticId ?? "none", timestamp: identity.timestamp, nonce: identity.nonce, method: identity.method ?? "POST", path: identity.path ?? "/api/agent/evaluate", bodyHash: identity.bodyHash ?? evidenceHash, evidenceHash },
  };
}

export async function verifyAgentIdentity(identity: AgentIdentity, evidence: EvaluationInput) {
  if (!isAddress(identity.address)) throw new Error("INVALID_AGENT_ADDRESS");
  if (!Number.isSafeInteger(identity.timestamp) || Math.abs(Date.now() - identity.timestamp) > AGENT_REQUEST_TTL_MS) {
    throw new Error("STALE_AGENT_REQUEST");
  }
  if (!verifyChallenge(identity.timestamp, identity.nonce)) throw new Error("INVALID_CHALLENGE");

  const receipt = evaluateEvidence(evidence);
  const message = buildAgentRequestMessage(identity, receipt.evidenceHash);
  const typed = buildAgentRequestTypedData(identity, receipt.evidenceHash);
  const recovered = getAddress(identity.scheme === "eip712" ? verifyTypedData(typed.domain, typed.types, typed.value, identity.signature) : verifyMessage(message, identity.signature));
  const requested = getAddress(identity.address);
  if (recovered !== requested) throw new Error("INVALID_AGENT_SIGNATURE");
  if (!(await consumeNonce(identity.nonce))) throw new Error("REPLAYED_AGENT_REQUEST");

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

  const wallet = new Wallet(privateKey);
  const receipt = { taskId: settlement.taskId, buyer: settlement.buyer, worker: settlement.worker, policyHash: settlement.policyHash, evidenceHash, amount: settlement.amount, decision: release ? 0 : 1, nonce: settlement.nonce, deadline: settlement.deadline };
  const domain = { name: "ThemisEscrow", version: "2", chainId: OG_NETWORK.chainId, verifyingContract: settlement.escrowAddress };
  const types = { SettlementReceipt: [{ name: "taskId", type: "uint256" }, { name: "buyer", type: "address" }, { name: "worker", type: "address" }, { name: "policyHash", type: "bytes32" }, { name: "evidenceHash", type: "bytes32" }, { name: "amount", type: "uint256" }, { name: "decision", type: "uint8" }, { name: "nonce", type: "uint256" }, { name: "deadline", type: "uint256" }] };
  return {
    verifier: wallet.address,
    signature: await wallet.signTypedData(domain, types, receipt),
    receipt,
    ...settlement,
    release,
  };
}

export function getAgentManifest(origin: string) {
  return {
    name: "Themis",
    version: "0.4.0",
    description: "Proof-carrying commerce infrastructure for autonomous agents on 0G.",
    network: {
      name: OG_NETWORK.name,
      chainId: OG_NETWORK.chainId,
      rpc: OG_NETWORK.rpcUrl,
      explorer: OG_NETWORK.explorerUrl,
      faucet: "https://faucet.0g.ai/",
    },
    identity: {
      schemes: ["eip712-v2", "eip191-v1-compatibility"],
      agenticId: { optional: true, registry: AGENTIC_ID_REGISTRY, standard: "ERC-7857" },
      requestTtlSeconds: AGENT_REQUEST_TTL_MS / 1000,
    },
    endpoints: {
      challenge: `${origin}/api/agent/challenge`,
      evaluate: `${origin}/api/agent/evaluate`,
      actions: `${origin}/api/agent/actions`,
      identityLookup: `${origin}/api/agent/identity/{agenticId}`,
      unsignedEvaluate: `${origin}/api/evaluate`,
      contractArtifact: `${origin}/api/contracts/themis-escrow`,
      health: `${origin}/api/health`,
      networkStatus: `${origin}/api/og/status`,
      documentation: `${origin}/docs#agents`,
    },
    escrow: {
      address: process.env.THEMIS_ESCROW_ADDRESS ?? "0x0B1Cdef5CE5EE077BFEC7d8B50C3fE3073857640",
      version: 2,
      disputeWindowSeconds: 86400,
    },
    protocol: { policySchema: "themis.policy.v1", evidenceSchema: "themis.evidence.v1", receiptSchema: "themis.receipt.v1", policyTemplates: ["research", "code-delivery", "data-delivery", "custom"], decisions: ["release", "block", "dispute"] },
    sdk: { package: "@themis-protocol/sdk", version: "0.4.0", publishStatus: "source-available" },
    demoAsset: { symbol: "dUSDC", noValue: true, address: process.env.THEMIS_DEMO_USDC_ADDRESS ?? null },
    capabilities: { computeInference: Boolean(process.env.OG_COMPUTE_PRIVATE_KEY), encryptedStorage: Boolean(process.env.OG_STORAGE_PRIVATE_KEY), durableJobs: Boolean(process.env.UPSTASH_REDIS_REST_URL), liveSettlement: Boolean(process.env.THEMIS_DEMO_USDC_ADDRESS && process.env.THEMIS_ESCROW_ADDRESS) },
  };
}
