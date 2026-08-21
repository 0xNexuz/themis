import { Contract, JsonRpcProvider, Wallet, parseUnits } from "ethers";
import { ResearchPolicy, hashCanonical, hashEvidence, hashPolicy, evaluatePolicy, type EvidenceBundle } from "@themis-protocol/sdk";
import { runVerifiedInference } from "./og/compute";
import { OG_NETWORK } from "./og/config";
import { uploadEvidenceBundle } from "./og/storage";
import { encryptEvidence } from "./finalize";

const SOURCES = [
  "https://www.nist.gov/itl/ai-risk-management-framework",
  "https://www.cisa.gov/ai",
  "https://owasp.org/www-project-top-10-for-large-language-model-applications/",
] as const;
const ALLOWED = new Set(["www.nist.gov", "www.cisa.gov", "owasp.org"]);
const escrowAbi = ["function nextTaskId() view returns(uint256)", "function createTask(address,uint256,address,bytes32) returns(uint256)", "function acceptTask(uint256)", "function submitEvidence(uint256,bytes32)", "function settleWithReceipt((uint256 taskId,address buyer,address worker,bytes32 policyHash,bytes32 evidenceHash,uint256 amount,uint8 decision,uint256 nonce,uint256 deadline),bytes)"];
const tokenAbi = ["function claimed(address) view returns(bool)", "function claim()", "function approve(address,uint256) returns(bool)"];

export type DemoStep = { key: string; status: "complete" | "failed"; detail: string; txHash?: string };
export type DemoRun = { mode: "live"; taskId: string; decision: "release"; steps: DemoStep[]; evidenceHash: string; policyHash: string; storageRoot: string; computeProvider: string; settlementTx: string; explorer: string };

async function sourcePack() {
  return Promise.all(SOURCES.map(async (url) => {
    const parsed = new URL(url);
    if (!ALLOWED.has(parsed.hostname)) throw new Error("SOURCE_DOMAIN_NOT_ALLOWED");
    const response = await fetch(url, { signal: AbortSignal.timeout(12_000), headers: { "user-agent": "Themis/0.4 evidence-builder" } });
    if (!response.ok) throw new Error(`SOURCE_UNRESOLVABLE_${response.status}`);
    const text = (await response.text()).replace(/<script[\s\S]*?<\/script>/gi, " ").replace(/<style[\s\S]*?<\/style>/gi, " ").replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").slice(0, 12_000);
    return { url, domain: parsed.hostname, retrievedAt: new Date().toISOString(), resolvable: true, excerpt: text, commitment: hashCanonical({ url, text }) };
  }));
}

export async function runRiskBrief(onStep: (step: DemoStep) => Promise<void> | void = () => undefined): Promise<DemoRun> {
  const required = ["THEMIS_DEMO_BUYER_PRIVATE_KEY", "THEMIS_DEMO_WORKER_PRIVATE_KEY", "THEMIS_VERIFIER_PRIVATE_KEY", "THEMIS_ESCROW_ADDRESS", "THEMIS_DEMO_USDC_ADDRESS", "THEMIS_DEMO_AGENTIC_ID"];
  const missing = required.filter((key) => !process.env[key]);
  if (missing.length) throw new Error(`LIVE_DEMO_NOT_CONFIGURED: ${missing.join(",")}`);
  const steps: DemoStep[] = [];
  const record = async (step: DemoStep) => { steps.push(step); await onStep(step); };
  const provider = new JsonRpcProvider(OG_NETWORK.rpcUrl);
  const buyer = new Wallet(process.env.THEMIS_DEMO_BUYER_PRIVATE_KEY!, provider);
  const worker = new Wallet(process.env.THEMIS_DEMO_WORKER_PRIVATE_KEY!, provider);
  const verifier = new Wallet(process.env.THEMIS_VERIFIER_PRIVATE_KEY!);
  const escrowAddress = process.env.THEMIS_ESCROW_ADDRESS!;
  const tokenAddress = process.env.THEMIS_DEMO_USDC_ADDRESS!;
  const amount = parseUnits("25", 6);
  const policy = structuredClone(ResearchPolicy);
  policy.rules.allowedDomains = [...ALLOWED].sort();
  policy.rules.allowedWorkers = [worker.address.toLowerCase()];
  policy.rules.allowedAgenticIds = [process.env.THEMIS_DEMO_AGENTIC_ID!];
  const policyHash = hashPolicy(policy);

  const token = new Contract(tokenAddress, tokenAbi, buyer);
  if (!(await token.claimed(buyer.address))) await (await token.claim()).wait();
  await (await token.approve(escrowAddress, amount)).wait();
  const escrowBuyer = new Contract(escrowAddress, escrowAbi, buyer);
  const taskId = await escrowBuyer.nextTaskId();
  const createTx = await escrowBuyer.createTask(tokenAddress, amount, worker.address, policyHash); await createTx.wait();
  await record({ key: "task", status: "complete", detail: `Task #${taskId} committed`, txHash: createTx.hash });
  const escrowWorker = new Contract(escrowAddress, escrowAbi, worker);
  const acceptTx = await escrowWorker.acceptTask(taskId); await acceptTx.wait();
  await record({ key: "work", status: "complete", detail: "Dedicated worker accepted task", txHash: acceptTx.hash });

  const sources = await sourcePack();
  const compute = await runVerifiedInference([{ role: "system", content: "Return strict JSON with keys summary and citations. Cite only supplied URLs. Produce a concise source-grounded AI system risk brief." }, { role: "user", content: JSON.stringify({ task: "Produce a source-grounded risk brief", sources: sources.map(({ excerpt, ...source }) => ({ ...source, excerpt })) }) }]);
  if (!compute.attestation.verified) throw new Error("COMPUTE_ATTESTATION_INVALID");
  const parsed = JSON.parse(compute.content.replace(/^```json\s*|\s*```$/g, "")) as { summary?: string; citations?: string[] };
  if (!parsed.summary) throw new Error("COMPUTE_RESULT_SCHEMA_INVALID");
  await record({ key: "compute", status: "complete", detail: `${compute.attestation.model} response verified` });

  const core = { taskId: taskId.toString(), task: "Produce a source-grounded risk brief", worker: worker.address, agenticId: process.env.THEMIS_DEMO_AGENTIC_ID!, summary: parsed.summary, sources: sources.map((source) => ({ url: source.url, domain: source.domain, retrievedAt: source.retrievedAt, resolvable: source.resolvable, commitment: source.commitment })), computeAttestation: compute.attestation, executionTimestamp: new Date().toISOString(), policyHash, amount: "25", privacyFlags: { sensitiveData: false }, metadata: { citations: parsed.citations ?? [] } };
  const encrypted = encryptEvidence({ schema: "themis.evidence.core.v1", ...core });
  const stored = await uploadEvidenceBundle({ schema: "themis.encrypted-evidence.v1", policyHash, encryption: encrypted });
  await record({ key: "storage", status: "complete", detail: `Encrypted evidence committed at ${stored.rootHash}`, txHash: stored.txHash });
  const evidence: EvidenceBundle = { schema: "themis.evidence.v1", ...core, resultHash: hashCanonical({ summary: parsed.summary, citations: parsed.citations ?? [] }), storageCommitment: { mode: "live", rootHash: stored.rootHash, transactionHash: stored.txHash, verified: stored.verified } };
  const evaluated = evaluatePolicy(policy, evidence);
  if (evaluated.decision !== "release") throw new Error(`POLICY_BLOCKED: ${evaluated.checks.filter((c) => !c.passed).map((c) => c.id).join(",")}`);
  const evidenceHash = hashEvidence(evidence);
  const submitTx = await escrowWorker.submitEvidence(taskId, evidenceHash); await submitTx.wait();
  await record({ key: "evidence", status: "complete", detail: "Final evidence hash submitted", txHash: submitTx.hash });
  const deadline = Math.floor(Date.now() / 1000) + 900;
  const receipt = { taskId, buyer: buyer.address, worker: worker.address, policyHash, evidenceHash, amount, decision: 0, nonce: BigInt(Date.now()), deadline };
  const signature = await verifier.signTypedData({ name: "ThemisEscrow", version: "2", chainId: OG_NETWORK.chainId, verifyingContract: escrowAddress }, { SettlementReceipt: [{ name: "taskId", type: "uint256" }, { name: "buyer", type: "address" }, { name: "worker", type: "address" }, { name: "policyHash", type: "bytes32" }, { name: "evidenceHash", type: "bytes32" }, { name: "amount", type: "uint256" }, { name: "decision", type: "uint8" }, { name: "nonce", type: "uint256" }, { name: "deadline", type: "uint256" }] }, receipt);
  const settleTx = await escrowBuyer.settleWithReceipt(receipt, signature); await settleTx.wait();
  await record({ key: "payment", status: "complete", detail: "25 DemoUSDC released", txHash: settleTx.hash });
  return { mode: "live", taskId: taskId.toString(), decision: "release", steps, evidenceHash, policyHash, storageRoot: stored.rootHash, computeProvider: compute.attestation.provider!, settlementTx: settleTx.hash, explorer: OG_NETWORK.explorerUrl };
}
