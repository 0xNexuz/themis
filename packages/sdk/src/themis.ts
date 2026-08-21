import { Contract, JsonRpcProvider, type Signer, verifyTypedData } from "ethers";
import { CodeDeliveryPolicy, DataDeliveryPolicy, ResearchPolicy, evaluatePolicy, hashEvidence, hashPolicy, type AcceptancePolicy, type EvidenceBundle, type Hex32 } from "./protocol";

export const networks = { "0g-galileo": { chainId: 16602, rpcUrl: "https://evmrpc-testnet.0g.ai", explorer: "https://chainscan-galileo.0g.ai" } } as const;
export class ThemisError extends Error { constructor(message: string, public code = "THEMIS_ERROR", public cause?: unknown) { super(message); } }
export class PolicyViolationError extends ThemisError { constructor(public checks: ReturnType<typeof evaluatePolicy>["checks"]) { super("Evidence does not satisfy the acceptance policy", "POLICY_VIOLATION"); } }
export type ThemisConfig = { network?: keyof typeof networks; apiUrl?: string; contractAddress?: string; signer?: Signer };
const escrowAbi = ["function createTask(address token,uint256 amount,address expectedWorker,bytes32 policyHash) returns (uint256)", "function acceptTask(uint256 taskId)", "function submitEvidence(uint256 taskId,bytes32 evidenceHash)", "function settleWithReceipt((uint256 taskId,address buyer,address worker,bytes32 policyHash,bytes32 evidenceHash,uint256 amount,uint8 decision,uint256 nonce,uint256 deadline) receipt,bytes signature)", "function disputeTask(uint256 taskId,bytes32 reasonHash)"];

export class Themis {
  readonly network;
  readonly provider;
  constructor(readonly config: ThemisConfig = {}) { this.network = networks[config.network ?? "0g-galileo"]; this.provider = new JsonRpcProvider(this.network.rpcUrl); }
  policy = { research: () => structuredClone(ResearchPolicy), codeDelivery: () => structuredClone(CodeDeliveryPolicy), dataDelivery: () => structuredClone(DataDeliveryPolicy), hash: hashPolicy };
  evidence = { hash: hashEvidence, evaluate: evaluatePolicy };
  private contract() { if (!this.config.contractAddress) throw new ThemisError("contractAddress is required", "CONFIGURATION_ERROR"); return new Contract(this.config.contractAddress, escrowAbi, this.config.signer ?? this.provider); }
  async createTask(input: { token: string; amount: bigint; expectedWorker?: string; policy: AcceptancePolicy }) { const tx = await this.contract().createTask(input.token, input.amount, input.expectedWorker ?? "0x0000000000000000000000000000000000000000", hashPolicy(input.policy)); return { hash: tx.hash, wait: () => tx.wait() }; }
  async acceptTask(taskId: bigint) { return this.contract().acceptTask(taskId); }
  async submitEvidence(taskId: bigint, evidence: EvidenceBundle) { return this.contract().submitEvidence(taskId, hashEvidence(evidence)); }
  async dispute(taskId: bigint, reasonHash: Hex32) { return this.contract().disputeTask(taskId, reasonHash); }
  async evaluate(input: { policy: AcceptancePolicy; evidence: EvidenceBundle }) { return evaluatePolicy(input.policy, input.evidence); }
  static verifyReceipt(domain: Record<string, unknown>, types: Record<string, Array<{ name: string; type: string }>>, receipt: Record<string, unknown>, signature: string, verifier: string) { return verifyTypedData(domain, types, receipt, signature).toLowerCase() === verifier.toLowerCase(); }
}
