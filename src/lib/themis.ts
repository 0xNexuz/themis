import { hashCanonical, hashEvidence, hashPolicy, evaluatePolicy, type AcceptancePolicy, type EvidenceBundle } from "@themis-protocol/sdk";

export * from "@themis-protocol/sdk";

export type EvaluationInput = { task: string; maxSpend: number; constraints?: { minSources?: number; disallowSensitiveData?: boolean }; result: { summary: string; sources: string[]; amount: number; sensitiveData?: boolean } };
export type ProtocolEvaluationInput = { policy: AcceptancePolicy; evidence: EvidenceBundle };

export function isEvaluationInput(value: unknown): value is EvaluationInput | ProtocolEvaluationInput {
  if (!value || typeof value !== "object") return false;
  const input = value as Record<string, unknown>;
  if (input.policy && input.evidence) return true;
  const result = input.result as Record<string, unknown> | undefined;
  return typeof input.task === "string" && typeof input.maxSpend === "number" && Boolean(result) && typeof result?.summary === "string" && Array.isArray(result.sources) && result.sources.every((source) => typeof source === "string") && typeof result.amount === "number";
}

function safeDomain(value: string) { try { return new URL(value).hostname.toLowerCase(); } catch { return "unresolved.invalid"; } }

export function legacyToProtocol(input: EvaluationInput): ProtocolEvaluationInput {
  const policy: AcceptancePolicy = { schema: "themis.policy.v1", template: "custom", name: "Legacy acceptance policy", rules: { minimumSources: input.constraints?.minSources ?? 1, maximumSpend: String(input.maxSpend), disallowSensitiveData: input.constraints?.disallowSensitiveData ?? true } };
  const policyHash = hashPolicy(policy);
  const summary = input.result.summary.trim();
  const evidence: EvidenceBundle = { schema: "themis.evidence.v1", taskId: "offchain", task: input.task.trim(), worker: "0x0000000000000000000000000000000000000000", resultHash: hashCanonical({ summary, sources: [...input.result.sources].sort() }), summary, sources: input.result.sources.map((url) => ({ url, domain: safeDomain(url), resolvable: true })), executionTimestamp: "1970-01-01T00:00:00.000Z", policyHash, amount: String(input.result.amount), privacyFlags: { sensitiveData: Boolean(input.result.sensitiveData) }, metadata: { compatibility: "v0.3" } };
  return { policy, evidence };
}

export function evaluateEvidence(input: EvaluationInput | ProtocolEvaluationInput) {
  const legacy = !("policy" in input);
  const protocol = legacy ? legacyToProtocol(input) : input;
  const policyHash = hashPolicy(protocol.policy);
  const evaluated = evaluatePolicy(protocol.policy, protocol.evidence);
  if (protocol.evidence.policyHash.toLowerCase() !== policyHash.toLowerCase()) {
    evaluated.checks.unshift({ id: "policy-commitment", key: "policy-commitment", label: "Policy commitment matches", status: "fail", expected: policyHash, actual: protocol.evidence.policyHash, evidencePath: "policyHash", reason: "The evaluated policy differs from the committed policy", passed: false, detail: "The evaluated policy differs from the committed policy" });
    evaluated.decision = "block";
    evaluated.violations += 1;
  }
  const evidenceHash = hashEvidence(protocol.evidence);
  if (legacy) {
    const old = input as EvaluationInput;
    const keys: Record<string, string> = { "minimum-sources": "source-threshold", "maximum-spend": "budget-policy", "sensitive-data": "privacy-policy" };
    evaluated.checks = [
      { id: "task-defined", key: "task-defined", label: "Task output is complete", status: old.task.trim().length >= 12 && old.result.summary.trim().length >= 24 ? "pass" : "fail", expected: 24, actual: old.result.summary.trim().length, evidencePath: "result.summary", reason: `${old.result.summary.trim().length} characters supplied`, passed: old.task.trim().length >= 12 && old.result.summary.trim().length >= 24, detail: `${old.result.summary.trim().length} characters supplied` },
      ...evaluated.checks.filter((check) => ["minimum-sources", "maximum-spend", "sensitive-data"].includes(check.id)).map((check) => ({ ...check, key: keys[check.id] })),
    ];
  }
  return { schema: "themis.receipt.v1", receiptId: `THM-${evidenceHash.slice(2, 10).toUpperCase()}`, evidenceHash, policyHash, decision: legacy && evaluated.decision === "block" ? "blocked" as const : evaluated.decision, checks: evaluated.checks, violations: evaluated.violations, createdAt: new Date().toISOString(), network: { name: "0G Galileo Testnet", chainId: 16602, explorer: "https://chainscan-galileo.0g.ai" } };
}
