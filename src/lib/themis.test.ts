import { describe, expect, it } from "vitest";
import { evaluateEvidence } from "./themis";

const validBundle = {
  task: "Produce a source-grounded risk brief for the buyer agent",
  maxSpend: 0.25,
  constraints: { minSources: 2, disallowSensitiveData: true },
  result: {
    summary: "Verified provider signals indicate a stable execution path with bounded downside.",
    sources: ["0G Compute attestation", "0G Storage commitment"],
    amount: 0.18,
    sensitiveData: false,
  },
};

describe("Themis policy engine", () => {
  it("releases payment only when every policy check passes", () => {
    const receipt = evaluateEvidence(validBundle);
    expect(receipt.decision).toBe("release");
    expect(receipt.checks.every((check) => check.passed)).toBe(true);
    expect(receipt.receiptId).toMatch(/^THM-[A-F0-9]{8}$/);
    expect(receipt.evidenceHash).toMatch(/^0x[a-f0-9]{64}$/);
  });

  it("blocks an over-budget output with missing sources and sensitive data", () => {
    const receipt = evaluateEvidence({
      ...validBundle,
      result: { ...validBundle.result, sources: [], amount: 0.42, sensitiveData: true },
    });
    expect(receipt.decision).toBe("blocked");
    expect(receipt.checks.filter((check) => !check.passed).map((check) => check.key)).toEqual([
      "source-threshold",
      "budget-policy",
      "privacy-policy",
    ]);
  });

  it("produces deterministic evidence commitments", () => {
    expect(evaluateEvidence(validBundle).evidenceHash).toBe(evaluateEvidence(validBundle).evidenceHash);
  });
});
