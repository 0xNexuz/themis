import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { network } from "hardhat";

const policyHash = `0x${"11".repeat(32)}`;
const evidenceHash = `0x${"22".repeat(32)}`;
const badHash = `0x${"33".repeat(32)}`;

async function fixture() {
  const { ethers } = await network.connect();
  const [admin, verifier, resolver, buyer, worker, stranger] = await ethers.getSigners();
  const token = await ethers.deployContract("DemoUSDC");
  const escrow = await ethers.deployContract("ThemisEscrow", [admin.address, verifier.address, resolver.address, 3600]);
  await token.connect(buyer).claim();
  await token.connect(buyer).approve(await escrow.getAddress(), 25_000_000n);
  return { ethers, admin, verifier, resolver, buyer, worker, stranger, token, escrow };
}

async function submitted() {
  const f = await fixture();
  await f.escrow.connect(f.buyer).createTask(await f.token.getAddress(), 25_000_000n, f.worker.address, policyHash);
  await f.escrow.connect(f.worker).acceptTask(0);
  await f.escrow.connect(f.worker).submitEvidence(0, evidenceHash);
  return f;
}

function receipt(f: Awaited<ReturnType<typeof fixture>>, overrides: Record<string, unknown> = {}) {
  return { taskId: 0n, buyer: f.buyer.address, worker: f.worker.address, policyHash, evidenceHash, amount: 25_000_000n, decision: 0, nonce: 1n, deadline: BigInt(Math.floor(Date.now() / 1000) + 3600), ...overrides };
}

async function sign(f: Awaited<ReturnType<typeof fixture>>, value: ReturnType<typeof receipt>, signer = f.verifier, domain: Record<string, unknown> = {}) {
  const chainId = (await f.ethers.provider.getNetwork()).chainId;
  return signer.signTypedData({ name: "ThemisEscrow", version: "2", chainId, verifyingContract: await f.escrow.getAddress(), ...domain }, { SettlementReceipt: [{ name: "taskId", type: "uint256" }, { name: "buyer", type: "address" }, { name: "worker", type: "address" }, { name: "policyHash", type: "bytes32" }, { name: "evidenceHash", type: "bytes32" }, { name: "amount", type: "uint256" }, { name: "decision", type: "uint8" }, { name: "nonce", type: "uint256" }, { name: "deadline", type: "uint256" }] }, value);
}

describe("ThemisEscrow V2", () => {
  it("creates, assigns, accepts, submits, and releases a task", async () => {
    const f = await submitted(); const r = receipt(f); const signature = await sign(f, r);
    await f.escrow.settleWithReceipt(r, signature);
    assert.equal((await f.escrow.tasks(0)).status, 4n);
    assert.equal(await f.token.balanceOf(f.worker.address), 25_000_000n);
  });
  it("rejects the wrong worker", async () => { const f = await fixture(); await f.escrow.connect(f.buyer).createTask(await f.token.getAddress(), 1n, f.worker.address, policyHash); await assert.rejects(f.escrow.connect(f.stranger).acceptTask(0)); });
  it("rejects altered policy, evidence, task, amount, and worker receipt fields", async () => {
    for (const changed of [{ policyHash: badHash }, { evidenceHash: badHash }, { taskId: 1n }, { amount: 1n }, { worker: "0x0000000000000000000000000000000000000001" }]) { const f = await submitted(); const r = receipt(f, changed); await assert.rejects(f.escrow.settleWithReceipt(r, await sign(f, r))); }
  });
  it("rejects expired, unauthorized, wrong-chain, and wrong-contract signatures", async () => {
    const cases = [async (f: Awaited<ReturnType<typeof submitted>>) => { const r = receipt(f, { deadline: 1n }); return [r, await sign(f, r)] as const; }, async (f: Awaited<ReturnType<typeof submitted>>) => { const r = receipt(f); return [r, await sign(f, r, f.stranger)] as const; }, async (f: Awaited<ReturnType<typeof submitted>>) => { const r = receipt(f); return [r, await sign(f, r, f.verifier, { chainId: 1 })] as const; }, async (f: Awaited<ReturnType<typeof submitted>>) => { const r = receipt(f); return [r, await sign(f, r, f.verifier, { verifyingContract: f.stranger.address })] as const; }];
    for (const make of cases) { const f = await submitted(); const [r, signature] = await make(f); await assert.rejects(f.escrow.settleWithReceipt(r, signature)); }
  });
  it("prevents replay through terminal task state and consumed digest", async () => { const f = await submitted(); const r = receipt(f); const signature = await sign(f, r); await f.escrow.settleWithReceipt(r, signature); assert.equal(await f.escrow.consumedReceipts(await f.escrow.receiptDigest(r)), true); await assert.rejects(f.escrow.settleWithReceipt(r, signature)); });
  it("supports disputes and resolver release/refund", async () => { const f = await submitted(); await f.escrow.connect(f.buyer).disputeTask(0, badHash); await assert.rejects(f.escrow.connect(f.stranger).resolveDispute(0, true)); await f.escrow.connect(f.resolver).resolveDispute(0, false); assert.equal((await f.escrow.tasks(0)).status, 5n); });
  it("enforces refund challenge window", async () => { const f = await submitted(); const r = receipt(f, { decision: 1 }); await assert.rejects(f.escrow.settleWithReceipt(r, await sign(f, r))); });
  it("pauses task mutation", async () => { const f = await fixture(); await f.escrow.connect(f.admin).pause(); await assert.rejects(f.escrow.connect(f.buyer).createTask(await f.token.getAddress(), 1n, f.worker.address, policyHash)); });
  it("fails closed when an ERC-20 returns false", async () => { const f = await fixture(); const failing = await f.ethers.deployContract("FailingToken"); await failing.mint(f.buyer.address, 10n); await failing.connect(f.buyer).approve(await f.escrow.getAddress(), 10n); await failing.setFailTransfers(true); await assert.rejects(f.escrow.connect(f.buyer).createTask(await failing.getAddress(), 10n, f.worker.address, policyHash)); });
  it("limits DemoUSDC faucet claims", async () => { const f = await fixture(); await assert.rejects(f.token.connect(f.buyer).claim()); });
});
