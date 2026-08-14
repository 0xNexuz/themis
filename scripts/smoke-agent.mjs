import { Wallet, getAddress } from "ethers";

const baseUrl = process.env.THEMIS_BASE_URL ?? "http://localhost:3000";
const wallet = new Wallet("0x59c6995e998f97a5a0044966f0945389dc9e86dae88c7a8412f4603b6b78690d");
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

const previewResponse = await fetch(`${baseUrl}/api/evaluate`, {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify(evidence),
});
if (!previewResponse.ok) throw new Error(`Preview failed: ${previewResponse.status}`);
const preview = await previewResponse.json();

const timestamp = Date.now();
const nonce = "smoke-agent-001";
const message = [
  "THEMIS_AGENT_REQUEST_V1",
  `address=${getAddress(wallet.address)}`,
  "agenticId=none",
  `timestamp=${timestamp}`,
  `nonce=${nonce}`,
  `evidenceHash=${preview.evidenceHash}`,
].join("\n");

const response = await fetch(`${baseUrl}/api/agent/evaluate`, {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify({
    agent: { address: wallet.address, timestamp, nonce, signature: await wallet.signMessage(message) },
    evidence,
  }),
});
const body = await response.json();
if (!response.ok) throw new Error(`Agent evaluation failed: ${response.status} ${JSON.stringify(body)}`);
if (body.decision !== "release" || body.agent?.signer !== wallet.address) {
  throw new Error(`Unexpected agent receipt: ${JSON.stringify(body)}`);
}

const checks = await Promise.all([
  fetch(`${baseUrl}/.well-known/themis-agent.json`),
  fetch(`${baseUrl}/api/agent/manifest`),
  fetch(`${baseUrl}/api/contracts/themis-escrow`),
  fetch(`${baseUrl}/docs`),
]);
if (checks.some((entry) => !entry.ok)) throw new Error(`Discovery smoke failed: ${checks.map((entry) => entry.status).join(",")}`);

console.log(JSON.stringify({
  baseUrl,
  receiptId: body.receiptId,
  decision: body.decision,
  signer: body.agent.signer,
  agenticIdVerified: body.agent.agenticIdVerified,
  discoveryStatuses: checks.map((entry) => entry.status),
}, null, 2));
