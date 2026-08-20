import { ResearchPolicy, evaluatePolicy, hashCanonical, hashEvidence, hashPolicy, type EvidenceBundle } from "@themis-protocol/sdk";
import { evaluateEvidence } from "./themis";

export const adversarialScenarios = ["valid", "fake-sources", "insufficient-sources", "over-budget", "wrong-worker", "invalid-agentic-id", "tampered-artifact", "missing-storage", "invalid-compute", "sensitive-data", "expired-receipt", "replayed-receipt", "policy-tampering"] as const;
export type AdversarialScenario = typeof adversarialScenarios[number];
const worker = "0x1111111111111111111111111111111111111111";

export function runAdversarialScenario(scenario: AdversarialScenario) {
  const artifact = hashCanonical("risk-brief-artifact");
  const policy = { ...structuredClone(ResearchPolicy), rules: { ...ResearchPolicy.rules, allowedWorkers: [worker], allowedAgenticIds: ["42"], requiredArtifactHash: artifact } };
  const base: EvidenceBundle = { schema: "themis.evidence.v1", taskId: "1042", task: "Produce a source-grounded risk brief", worker, agenticId: "42", resultHash: hashCanonical("verified risk brief"), artifactHash: artifact, summary: "Verified provider signals indicate a bounded and source-grounded risk profile.", sources: ["nist.gov", "cisa.gov", "owasp.org"].map((domain) => ({ url: `https://${domain}/reference`, domain, resolvable: true, commitment: hashCanonical(domain) })), computeAttestation: { mode: "live", provider: worker, model: "qwen fixture", verified: true }, storageCommitment: { mode: "live", rootHash: "fixture:storage-root", verified: true }, executionTimestamp: new Date().toISOString(), policyHash: hashPolicy(policy), amount: "25", privacyFlags: { sensitiveData: false } };
  const patch: Partial<EvidenceBundle> = scenario === "fake-sources" ? { sources: base.sources.map((source) => ({ ...source, resolvable: false })) }
    : scenario === "insufficient-sources" ? { sources: base.sources.slice(0, 1) }
    : scenario === "over-budget" ? { amount: "30" }
    : scenario === "wrong-worker" ? { worker: "0x2222222222222222222222222222222222222222" }
    : scenario === "invalid-agentic-id" ? { agenticId: "999" }
    : scenario === "tampered-artifact" ? { artifactHash: hashCanonical("tampered") }
    : scenario === "missing-storage" ? { storageCommitment: undefined }
    : scenario === "invalid-compute" ? { computeAttestation: { ...base.computeAttestation!, verified: false } }
    : scenario === "sensitive-data" ? { privacyFlags: { sensitiveData: true } }
    : {};
  const evidence = { ...base, ...patch };
  if (scenario === "policy-tampering") return evaluateEvidence({ policy: { ...policy, rules: { ...policy.rules, minimumSources: 4 } }, evidence });
  const result = evaluatePolicy(policy, evidence);
  if (scenario === "expired-receipt" || scenario === "replayed-receipt") {
    result.decision = "block";
    result.violations += 1;
    const id = scenario;
    result.checks.unshift({ id, key: id, label: scenario === "expired-receipt" ? "Receipt is within deadline" : "Receipt nonce is unused", status: "fail", expected: scenario === "expired-receipt" ? "future deadline" : "unused digest", actual: scenario === "expired-receipt" ? "expired" : "already consumed", evidencePath: scenario === "expired-receipt" ? "receipt.deadline" : "receipt.nonce", reason: scenario === "expired-receipt" ? "The settlement authorization expired" : "The receipt digest has already been consumed", passed: false, detail: scenario === "expired-receipt" ? "The settlement authorization expired" : "The receipt digest has already been consumed" });
  }
  const evidenceHash = hashEvidence(evidence);
  return { schema: "themis.receipt.v1", receiptId: `THM-${evidenceHash.slice(2, 10).toUpperCase()}`, evidenceHash, policyHash: hashPolicy(policy), decision: result.decision, checks: result.checks.filter((check) => check.status !== "not_applicable"), violations: result.violations, createdAt: new Date().toISOString(), mode: "adversarial-demo" as const };
}
