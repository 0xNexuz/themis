import { Wallet } from "ethers";
import { describe, expect, it } from "vitest";
import { buildAgentRequestMessage, buildAgentRequestTypedData, issueAgentChallenge, verifyAgentIdentity } from "./agent";
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
    const challenge = issueAgentChallenge();
    const identity = {
      address: wallet.address,
      ...challenge,
    };
    const message = buildAgentRequestMessage(identity, evaluateEvidence(evidence).evidenceHash);
    const result = await verifyAgentIdentity({ ...identity, signature: await wallet.signMessage(message) }, evidence);
    expect(result.signer).toBe(wallet.address);
    expect(result.receipt.decision).toBe("release");
    expect(result.agenticIdVerified).toBe(false);
  });

  it("rejects stale signed requests", async () => {
    const wallet = new Wallet("0x8b3a350cf5c34c9194ca3a545d03c5b5a5b8f5b0dfc6f5d6aee2e83f0d7b5d2a");
    const timestamp = Date.now() - 10 * 60 * 1000;
    const identity = {
      address: wallet.address,
      ...issueAgentChallenge(timestamp),
    };
    const message = buildAgentRequestMessage(identity, evaluateEvidence(evidence).evidenceHash);
    await expect(verifyAgentIdentity({ ...identity, signature: await wallet.signMessage(message) }, evidence))
      .rejects.toThrow("STALE_AGENT_REQUEST");
  });

  it("accepts EIP-712 V2 and rejects nonce replay", async () => {
    const wallet = new Wallet("0x0dbbe8e7318e00d4f6f13aa5c0671a0f112d8a4784173994fd146d50417fdd65");
    const identity = { address: wallet.address, ...issueAgentChallenge(), scheme: "eip712" as const, method: "POST", path: "/api/agent/evaluate" };
    const receipt = evaluateEvidence(evidence);
    const typed = buildAgentRequestTypedData(identity, receipt.evidenceHash);
    const signed = { ...identity, signature: await wallet.signTypedData(typed.domain, typed.types, typed.value) };
    await expect(verifyAgentIdentity(signed, evidence)).resolves.toMatchObject({ signer: wallet.address });
    await expect(verifyAgentIdentity(signed, evidence)).rejects.toThrow("REPLAYED_AGENT_REQUEST");
  });
});
