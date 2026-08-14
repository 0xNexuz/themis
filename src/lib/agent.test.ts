import { Wallet } from "ethers";
import { describe, expect, it } from "vitest";
import { buildAgentRequestMessage, verifyAgentIdentity } from "./agent";
import { evaluateEvidence } from "./themis";

const evidence = {
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

describe("Themis agent authentication", () => {
  it("accepts a fresh EIP-191 request signed by the declared wallet", async () => {
    const wallet = new Wallet("0x59c6995e998f97a5a0044966f0945389dc9e86dae88c7a8412f4603b6b78690d");
    const identity = {
      address: wallet.address,
      timestamp: Date.now(),
      nonce: "agent-test-001",
    };
    const message = buildAgentRequestMessage(identity, evaluateEvidence(evidence).evidenceHash);
    const result = await verifyAgentIdentity({ ...identity, signature: await wallet.signMessage(message) }, evidence);
    expect(result.signer).toBe(wallet.address);
    expect(result.receipt.decision).toBe("release");
    expect(result.agenticIdVerified).toBe(false);
  });

  it("rejects stale signed requests", async () => {
    const wallet = new Wallet("0x8b3a350cf5c34c9194ca3a545d03c5b5a5b8f5b0dfc6f5d6aee2e83f0d7b5d2a");
    const identity = {
      address: wallet.address,
      timestamp: Date.now() - 10 * 60 * 1000,
      nonce: "agent-test-002",
    };
    const message = buildAgentRequestMessage(identity, evaluateEvidence(evidence).evidenceHash);
    await expect(verifyAgentIdentity({ ...identity, signature: await wallet.signMessage(message) }, evidence))
      .rejects.toThrow("STALE_AGENT_REQUEST");
  });
});
