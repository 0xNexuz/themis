import { sha256 } from "@noble/hashes/sha2.js";
import { bytesToHex } from "@noble/hashes/utils.js";
import { z } from "zod";

export const Hex32 = z.string().regex(/^0x[a-fA-F0-9]{64}$/);
export type Hex32 = `0x${string}`;

export type PolicyRules = {
  minimumSources?: number;
  minimumIndependentDomains?: number;
  citationsResolvable?: boolean;
  maximumSpend?: string;
  maximumAgeSeconds?: number;
  allowedDomains?: string[];
  requiredArtifactHash?: Hex32;
  requireComputeAttestation?: boolean;
  requireStorageCommitment?: boolean;
  requireAgentIdentity?: boolean;
  allowedWorkers?: string[];
  allowedAgenticIds?: string[];
  disallowSensitiveData?: boolean;
  minimumTestCoverage?: number;
  requireBuildSuccess?: boolean;
  maximumCriticalVulnerabilities?: number;
  requireSchemaValid?: boolean;
  minimumRows?: number;
  requireSourceCommitment?: boolean;
  minimumQualityScore?: number;
};

export type AcceptancePolicy = {
  schema: "themis.policy.v1";
  template: "research" | "code-delivery" | "data-delivery" | "custom";
  name: string;
  rules: PolicyRules;
};

export type EvidenceSource = { url: string; domain?: string; retrievedAt?: string; resolvable?: boolean; commitment?: Hex32 };
export type ComputeAttestation = {
  mode: "live" | "demo";
  provider?: string;
  model?: string;
  requestHash?: Hex32;
  responseHash?: Hex32;
  responseKey?: string;
  teeType?: string;
  verified: boolean;
};
export type StorageCommitment = { mode: "live" | "demo"; rootHash?: string; transactionHash?: string; verified: boolean };

export type EvidenceBundle = {
  schema: "themis.evidence.v1";
  taskId: string;
  task: string;
  worker: string;
  agenticId?: string;
  resultHash: Hex32;
  artifactHash?: Hex32;
  summary: string;
  sources: EvidenceSource[];
  computeAttestation?: ComputeAttestation;
  storageCommitment?: StorageCommitment;
  executionTimestamp: string;
  policyHash: Hex32;
  amount: string;
  privacyFlags: { sensitiveData: boolean };
  metrics?: { testsPassed?: boolean; coverage?: number; buildSucceeded?: boolean; criticalVulnerabilities?: number; schemaValid?: boolean; rows?: number; qualityScore?: number };
  metadata?: Record<string, unknown>;
};

export type CheckResult = {
  id: string;
  label: string;
  status: "pass" | "fail" | "not_applicable" | "indeterminate";
  expected?: unknown;
  actual?: unknown;
  evidencePath?: string;
  reason: string;
  passed: boolean;
  key: string;
  detail: string;
};

function canonical(value: unknown): string {
  if (value === null || typeof value !== "object") return JSON.stringify(value);
  if (Array.isArray(value)) return `[${value.map(canonical).join(",")}]`;
  const object = value as Record<string, unknown>;
  return `{${Object.keys(object).filter((key) => object[key] !== undefined).sort().map((key) => `${JSON.stringify(key)}:${canonical(object[key])}`).join(",")}}`;
}

export function canonicalize(value: unknown) { return canonical(value); }
export function hashCanonical(value: unknown): Hex32 {
  return `0x${bytesToHex(sha256(new TextEncoder().encode(canonicalize(value))))}` as Hex32;
}
export function canonicalPolicy(policy: AcceptancePolicy): AcceptancePolicy {
  return { ...policy, rules: { ...policy.rules, allowedDomains: policy.rules.allowedDomains?.map((v) => v.toLowerCase()).sort(), allowedWorkers: policy.rules.allowedWorkers?.map((v) => v.toLowerCase()).sort(), allowedAgenticIds: policy.rules.allowedAgenticIds?.sort() } };
}
export function hashPolicy(policy: AcceptancePolicy): Hex32 { return hashCanonical(canonicalPolicy(policy)); }
export function canonicalEvidence(evidence: EvidenceBundle) {
  return { ...evidence, worker: evidence.worker.toLowerCase(), sources: evidence.sources.map((source) => ({ ...source, domain: source.domain?.toLowerCase() })).sort((a, b) => a.url.localeCompare(b.url)) };
}
export function hashEvidence(evidence: EvidenceBundle): Hex32 { return hashCanonical(canonicalEvidence(evidence)); }

export const ResearchPolicy: AcceptancePolicy = { schema: "themis.policy.v1", template: "research", name: "Research Quality v1", rules: { minimumSources: 3, minimumIndependentDomains: 2, citationsResolvable: true, maximumSpend: "25", maximumAgeSeconds: 86400, requireComputeAttestation: true, requireStorageCommitment: true, requireAgentIdentity: true, disallowSensitiveData: true } };
export const CodeDeliveryPolicy: AcceptancePolicy = { schema: "themis.policy.v1", template: "code-delivery", name: "Code Delivery v1", rules: { minimumTestCoverage: 80, requireBuildSuccess: true, maximumCriticalVulnerabilities: 0, requireAgentIdentity: true, disallowSensitiveData: true } };
export const DataDeliveryPolicy: AcceptancePolicy = { schema: "themis.policy.v1", template: "data-delivery", name: "Data Delivery v1", rules: { requireSchemaValid: true, minimumRows: 1, requireSourceCommitment: true, maximumAgeSeconds: 86400, minimumQualityScore: 0.8, disallowSensitiveData: true } };

const makeCheck = (id: string, label: string, status: CheckResult["status"], expected: unknown, actual: unknown, evidencePath: string, reason: string): CheckResult => ({ id, key: id, label, status, expected, actual, evidencePath, reason, passed: status === "pass" || status === "not_applicable", detail: reason });

export function evaluatePolicy(policy: AcceptancePolicy, evidence: EvidenceBundle, now = new Date()) {
  const r = policy.rules;
  const domains = new Set(evidence.sources.map((s) => (s.domain || new URL(s.url).hostname).toLowerCase()));
  const checks: CheckResult[] = [];
  const add = (id: string, label: string, applies: boolean, pass: boolean, expected: unknown, actual: unknown, path: string, reason: string) => checks.push(makeCheck(id, label, applies ? (pass ? "pass" : "fail") : "not_applicable", expected, actual, path, applies ? reason : "Policy does not require this check"));
  add("minimum-sources", "Required source count", r.minimumSources !== undefined, evidence.sources.length >= (r.minimumSources ?? 0), r.minimumSources, evidence.sources.length, "sources", `${evidence.sources.length} source(s) supplied`);
  add("independent-domains", "Independent source domains", r.minimumIndependentDomains !== undefined, domains.size >= (r.minimumIndependentDomains ?? 0), r.minimumIndependentDomains, domains.size, "sources[].domain", `${domains.size} independent domain(s)`);
  add("citations-resolvable", "Citations resolve", r.citationsResolvable === true, evidence.sources.every((s) => s.resolvable === true), true, evidence.sources.filter((s) => s.resolvable).length, "sources[].resolvable", "Every citation must resolve");
  add("maximum-spend", "Spend remains inside budget", r.maximumSpend !== undefined, Number(evidence.amount) <= Number(r.maximumSpend) && Number(evidence.amount) >= 0, r.maximumSpend, evidence.amount, "amount", `${evidence.amount} requested`);
  add("freshness", "Evidence is fresh", r.maximumAgeSeconds !== undefined, now.getTime() - new Date(evidence.executionTimestamp).getTime() <= (r.maximumAgeSeconds ?? 0) * 1000, r.maximumAgeSeconds, Math.max(0, Math.floor((now.getTime() - new Date(evidence.executionTimestamp).getTime()) / 1000)), "executionTimestamp", "Execution age in seconds");
  add("allowed-domains", "Sources use allowed domains", Boolean(r.allowedDomains?.length), evidence.sources.every((s) => (r.allowedDomains ?? []).includes((s.domain || new URL(s.url).hostname).toLowerCase())), r.allowedDomains, [...domains], "sources[].domain", "All source domains must be allowed");
  add("artifact-hash", "Artifact hash matches", Boolean(r.requiredArtifactHash), evidence.artifactHash?.toLowerCase() === r.requiredArtifactHash?.toLowerCase(), r.requiredArtifactHash, evidence.artifactHash, "artifactHash", "Committed artifact must match policy");
  add("compute-attestation", "0G Compute attestation", r.requireComputeAttestation === true, evidence.computeAttestation?.mode === "live" && evidence.computeAttestation.verified, "verified live proof", evidence.computeAttestation, "computeAttestation", "Compute response must be verified");
  add("storage-commitment", "0G Storage commitment", r.requireStorageCommitment === true, evidence.storageCommitment?.mode === "live" && evidence.storageCommitment.verified && Boolean(evidence.storageCommitment.rootHash), "verified live commitment", evidence.storageCommitment, "storageCommitment", "Encrypted evidence must be committed and verified");
  add("agent-identity", "Worker Agentic ID", r.requireAgentIdentity === true, Boolean(evidence.agenticId), "registered identity", evidence.agenticId, "agenticId", "Worker identity is required");
  add("approved-worker", "Worker is approved", Boolean(r.allowedWorkers?.length), r.allowedWorkers?.includes(evidence.worker.toLowerCase()) ?? false, r.allowedWorkers, evidence.worker, "worker", "Worker must be allowlisted");
  add("approved-agentic-id", "Agentic ID is approved", Boolean(r.allowedAgenticIds?.length), r.allowedAgenticIds?.includes(evidence.agenticId ?? "") ?? false, r.allowedAgenticIds, evidence.agenticId, "agenticId", "Agentic ID must be allowlisted");
  add("sensitive-data", "No sensitive data", r.disallowSensitiveData === true, !evidence.privacyFlags.sensitiveData, false, evidence.privacyFlags.sensitiveData, "privacyFlags.sensitiveData", "Sensitive data is forbidden");
  add("test-coverage", "Minimum test coverage", r.minimumTestCoverage !== undefined, (evidence.metrics?.coverage ?? -1) >= (r.minimumTestCoverage ?? 0), r.minimumTestCoverage, evidence.metrics?.coverage, "metrics.coverage", "Coverage threshold must be met");
  add("build-success", "Build succeeds", r.requireBuildSuccess === true, evidence.metrics?.buildSucceeded === true && evidence.metrics?.testsPassed === true, true, evidence.metrics, "metrics", "Build and tests must pass");
  add("critical-vulnerabilities", "Critical vulnerability limit", r.maximumCriticalVulnerabilities !== undefined, (evidence.metrics?.criticalVulnerabilities ?? Infinity) <= (r.maximumCriticalVulnerabilities ?? 0), r.maximumCriticalVulnerabilities, evidence.metrics?.criticalVulnerabilities, "metrics.criticalVulnerabilities", "Critical vulnerability threshold");
  add("schema-valid", "Data schema is valid", r.requireSchemaValid === true, evidence.metrics?.schemaValid === true, true, evidence.metrics?.schemaValid, "metrics.schemaValid", "Data must satisfy schema");
  add("minimum-rows", "Minimum row count", r.minimumRows !== undefined, (evidence.metrics?.rows ?? -1) >= (r.minimumRows ?? 0), r.minimumRows, evidence.metrics?.rows, "metrics.rows", "Minimum row count must be met");
  add("source-commitment", "Source commitment present", r.requireSourceCommitment === true, evidence.sources.every((s) => Boolean(s.commitment)), true, evidence.sources.map((s) => s.commitment), "sources[].commitment", "Every source must be committed");
  add("quality-score", "Minimum quality score", r.minimumQualityScore !== undefined, (evidence.metrics?.qualityScore ?? -1) >= (r.minimumQualityScore ?? 0), r.minimumQualityScore, evidence.metrics?.qualityScore, "metrics.qualityScore", "Quality threshold must be met");
  const failures = checks.filter((check) => check.status === "fail");
  return { decision: failures.length ? "block" as const : "release" as const, checks, violations: failures.length };
}
