import { describe, expect, it } from "vitest";
import { ResearchPolicy, evaluatePolicy, hashCanonical, hashEvidence, hashPolicy, type EvidenceBundle } from "@themis-protocol/sdk";
import { evaluateEvidence } from "./themis";

const worker = "0x1111111111111111111111111111111111111111";
const artifact = hashCanonical("artifact");
const policy = { ...structuredClone(ResearchPolicy), rules: { ...ResearchPolicy.rules, allowedWorkers: [worker], allowedAgenticIds: ["42"], requiredArtifactHash: artifact } };
const base: EvidenceBundle = { schema: "themis.evidence.v1", taskId: "1042", task: "Produce a source-grounded risk brief", worker, agenticId: "42", resultHash: hashCanonical("result"), artifactHash: artifact, summary: "A source-grounded result with traceable claims.", sources: ["nist.gov", "cisa.gov", "owasp.org"].map((domain) => ({ url: `https://${domain}/source`, domain, resolvable: true, commitment: hashCanonical(domain) })), computeAttestation: { mode: "live", provider: worker, model: "qwen", verified: true }, storageCommitment: { mode: "live", rootHash: "0xroot", transactionHash: "0xtx", verified: true }, executionTimestamp: new Date().toISOString(), policyHash: hashPolicy(policy), amount: "25", privacyFlags: { sensitiveData: false } };

describe("typed policy protocol", () => {
  it("releases valid research evidence and returns structured checks", () => { const result = evaluatePolicy(policy, base); expect(result.decision).toBe("release"); expect(result.checks.every((check) => check.reason && check.evidencePath)).toBe(true); });
  it.each([
    ["FAKE SOURCES", { sources: base.sources.map((source) => ({ ...source, resolvable: false })) }, "citations-resolvable"],
    ["INSUFFICIENT SOURCES", { sources: base.sources.slice(0, 1) }, "minimum-sources"],
    ["OVER BUDGET", { amount: "26" }, "maximum-spend"],
    ["WRONG WORKER", { worker: "0x2222222222222222222222222222222222222222" }, "approved-worker"],
    ["INVALID AGENTIC ID", { agenticId: "99" }, "approved-agentic-id"],
    ["TAMPERED ARTIFACT", { artifactHash: hashCanonical("tampered") }, "artifact-hash"],
    ["MISSING STORAGE COMMITMENT", { storageCommitment: undefined }, "storage-commitment"],
    ["INVALID COMPUTE ATTESTATION", { computeAttestation: { ...base.computeAttestation!, verified: false } }, "compute-attestation"],
    ["SENSITIVE DATA LEAK", { privacyFlags: { sensitiveData: true } }, "sensitive-data"],
    ["STALE EVIDENCE", { executionTimestamp: "2020-01-01T00:00:00.000Z" }, "freshness"],
  ])("blocks %s", (_name, patch, failed) => { const result = evaluatePolicy(policy, { ...base, ...patch } as EvidenceBundle); expect(result.decision).toBe("block"); expect(result.checks.find((check) => check.id === failed)?.status).toBe("fail"); });
  it("canonicalizes equivalent evidence ordering", () => { expect(hashEvidence(base)).toBe(hashEvidence({ ...base, sources: [...base.sources].reverse() })); });
  it("detects policy tampering", () => { const changed = { ...policy, rules: { ...policy.rules, minimumSources: 4 } }; const result = evaluateEvidence({ policy: changed, evidence: base }); expect(result.decision).toBe("block"); expect(result.checks[0].id).toBe("policy-commitment"); });
});
