import type { Metadata } from "next";
import Link from "next/link";
import DeployEscrow from "./deploy-escrow";

export const metadata: Metadata = {
  title: "Themis Docs — Build proof-carrying commerce",
  description: "Architecture, API, receipts, 0G adapters, and escrow lifecycle for the Themis protocol.",
};

const requestExample = `curl -X POST https://themis0g.vercel.app/api/evaluate \\\\
  -H "Content-Type: application/json" \\\\
  -d '{
    "task": "Produce a source-grounded risk brief",
    "maxSpend": 0.25,
    "constraints": { "minSources": 2, "disallowSensitiveData": true },
    "result": {
      "summary": "Verified provider signals indicate a stable execution path.",
      "sources": ["0G Compute attestation", "0G Storage commitment"],
      "amount": 0.18,
      "sensitiveData": false
    }
  }'`;

const responseExample = `{
  "receiptId": "THM-AF4F5133",
  "evidenceHash": "0xaf4f5133…",
  "policyHash": "0xc7e81d9a…",
  "decision": "release",
  "checks": [
    { "key": "task-defined", "passed": true },
    { "key": "source-threshold", "passed": true },
    { "key": "budget-policy", "passed": true },
    { "key": "privacy-policy", "passed": true }
  ],
  "network": { "name": "0G Galileo Testnet", "chainId": 16602 }
}`;

const agentExample = `import { ethers } from "ethers";

const evidence = { /* same schema as /api/evaluate */ };
const preview = await fetch("/api/evaluate", {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify(evidence)
}).then((response) => response.json());

const { timestamp, nonce } = await fetch(
  "/api/agent/challenge",
  { cache: "no-store" }
).then((response) => response.json());
const address = await signer.getAddress();
const message = [
  "THEMIS_AGENT_REQUEST_V1",
  \`address=\${ethers.getAddress(address)}\`,
  "agenticId=none", // or an ERC-7857 token ID
  \`timestamp=\${timestamp}\`,
  \`nonce=\${nonce}\`,
  \`evidenceHash=\${preview.evidenceHash}\`
].join("\\n");

const signature = await signer.signMessage(message);
const receipt = await fetch("/api/agent/evaluate", {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify({
    agent: { address, timestamp, nonce, signature },
    evidence
  })
}).then((response) => response.json());`;

const sections = [
  ["overview", "Overview"], ["flow", "Protocol flow"], ["api", "Evaluator API"],
  ["agents", "0G agents"], ["receipts", "Proof receipts"], ["stack", "0G integration"],
  ["escrow", "Escrow contract"], ["deploy", "Wallet deployment"], ["configuration", "Configuration"],
];

export default function DocsPage() {
  return (
    <main className="docs-page">
      <header className="docs-header">
        <Link className="wordmark" href="/" aria-label="Themis home"><span>Θ</span>THEMIS</Link>
        <nav aria-label="Documentation navigation"><span>Protocol docs</span><a href="https://github.com/0xNexuz/themis" target="_blank" rel="noreferrer">GitHub ↗</a><Link href="/">Launch app</Link></nav>
      </header>
      <div className="docs-shell">
        <aside className="docs-sidebar">
          <p>Build reference</p>
          <nav aria-label="On this page">{sections.map(([id, label]) => <a href={`#${id}`} key={id}>{label}</a>)}</nav>
          <div><i />0G Galileo live</div>
        </aside>
        <article className="docs-content">
          <section className="docs-hero" id="overview">
            <p className="eyebrow">Themis protocol · v0.1</p>
            <h1>Build transactions that carry their own proof.</h1>
            <p>Themis is an evidence-gated settlement layer for autonomous agents. A buyer commits the work, budget, and acceptance policy; a worker submits a result; the evaluator emits a deterministic receipt that authorizes release or blocks payment.</p>
            <div className="docs-badges"><span>Next.js API</span><span>0G Galileo · 16602</span><span>Solidity escrow</span><span>Deterministic receipts</span></div>
          </section>

          <section className="docs-section" id="flow">
            <div className="docs-title"><span>01</span><div><p>Protocol flow</p><h2>Commit → Execute → Prove → Settle</h2></div></div>
            <div className="docs-flow">
              <article><b>01</b><h3>Commit</h3><p>The buyer defines the task, maximum spend, minimum source count, and privacy rule. The canonical policy becomes a SHA-256 commitment.</p></article>
              <article><b>02</b><h3>Execute</h3><p>A worker completes the task. The funded adapter can create a wallet-signed 0G Compute broker and discover inference services.</p></article>
              <article><b>03</b><h3>Prove</h3><p>The result is normalized and hashed. When configured, the bundle is Merkle-committed and uploaded through the official 0G Storage SDK.</p></article>
              <article><b>04</b><h3>Settle</h3><p>Every check must pass for <code>release</code>. Failed completeness, source, budget, or privacy checks produce <code>blocked</code>.</p></article>
            </div>
          </section>

          <section className="docs-section" id="api">
            <div className="docs-title"><span>02</span><div><p>Evaluator API</p><h2>Evaluate an evidence bundle</h2></div></div>
            <p className="docs-lead"><code>POST /api/evaluate</code> validates the payload, canonicalizes policy and evidence, executes four deterministic checks, and returns an inspectable receipt.</p>
            <div className="endpoint"><span>POST</span><code>/api/evaluate</code><b>application/json</b></div>
            <div className="code-grid"><div><p>Request</p><pre><code>{requestExample}</code></pre></div><div><p>Release receipt</p><pre><code>{responseExample}</code></pre></div></div>
            <div className="docs-note"><strong>Failure behavior</strong><p>Malformed payloads return HTTP 400. Valid bundles return a receipt; policy failures appear as <code>{'decision: "blocked"'}</code> with check-level details.</p></div>
          </section>

          <section className="docs-section" id="agents">
            <div className="docs-title"><span>03</span><div><p>0G agent interface</p><h2>Bring an existing agent to Themis</h2></div></div>
            <p className="docs-lead">Agents discover Themis at <code>/.well-known/themis-agent.json</code>, request a server-timed challenge, sign a five-minute EIP-191 request, and submit the standard evidence schema to <code>POST /api/agent/evaluate</code>.</p>
            <div className="integration-list">
              <article><span>Discover</span><div><h3>Machine-readable manifest</h3><p>Network, identity scheme, faucet, artifact, health, evaluation, and documentation endpoints are published in one document.</p></div><b>Live</b></article>
              <article><span>Authenticate</span><div><h3>EVM wallet signature</h3><p>The signer commits to its address, server-issued timestamp and nonce, optional Agentic ID, and deterministic evidence hash.</p></div><b>Required</b></article>
              <article><span>Identify</span><div><h3>ERC-7857 Agentic ID</h3><p>Supplying <code>agenticId</code> verifies the signer as owner, approved address, or approved operator on the Galileo registry.</p></div><b>Optional</b></article>
              <article><span>Settle</span><div><h3>Verifier authorization</h3><p>When the server verifier is configured, a contract-bound signature authorizes <code>settleWithReceipt</code> for release or refund.</p></div><b>Key-gated</b></article>
            </div>
            <div className="endpoint"><span>POST</span><code>/api/agent/evaluate</code><b>EIP-191 signed envelope</b></div>
            <div className="code-grid agent-code"><div><p>Agent integration</p><pre><code>{agentExample}</code></pre></div><div><p>Discovery and artifacts</p><pre><code>{`GET /.well-known/themis-agent.json
GET /api/agent/manifest
GET /api/agent/challenge
GET /api/contracts/themis-escrow
GET /api/og/status

# Optional agent identity registry
ERC-7857: 0x2700F6A3e505402C9daB154C5c6ab9cAEC98EF1F`}</code></pre></div></div>
            <div className="docs-note"><strong>Existing 0G agents</strong><p>An agent does not need to be rebuilt. Any agent that controls an EVM wallet can sign this envelope. Adding its ERC-7857 token ID upgrades the receipt from wallet-authenticated to Agentic-ID-verified.</p></div>
          </section>

          <section className="docs-section" id="receipts">
            <div className="docs-title"><span>04</span><div><p>Proof receipts</p><h2>One portable decision artifact</h2></div></div>
            <div className="schema-table">
              <div><code>receiptId</code><span>string</span><p>Short identifier derived from the evidence hash.</p></div>
              <div><code>evidenceHash</code><span>bytes32</span><p>SHA-256 commitment to canonical task output and evidence.</p></div>
              <div><code>policyHash</code><span>bytes32</span><p>SHA-256 commitment to task, budget, and constraints.</p></div>
              <div><code>decision</code><span>enum</span><p><code>release</code> only when every check passes; otherwise <code>blocked</code>.</p></div>
              <div><code>checks[]</code><span>array</span><p>Human-readable evidence for each policy condition.</p></div>
              <div><code>network</code><span>object</span><p>Galileo chain identity and explorer context.</p></div>
            </div>
          </section>

          <section className="docs-section" id="stack">
            <div className="docs-title"><span>05</span><div><p>0G integration</p><h2>Four load-bearing layers</h2></div></div>
            <div className="integration-list">
              <article><span>Chain</span><div><h3>0G Galileo</h3><p>Live block height, wallet onboarding to chain ID 16602, and the escrow settlement lifecycle.</p></div><b>Live read</b></article>
              <article><span>Compute</span><div><h3>Official Compute SDK</h3><p><code>@0gfoundation/0g-compute-ts-sdk</code> creates a wallet-signed broker when its server-side signer is configured.</p></div><b>Adapter ready</b></article>
              <article><span>Storage</span><div><h3>Official Storage SDK</h3><p><code>@0gfoundation/0g-storage-ts-sdk</code> builds a Merkle tree and uploads the evidence payload.</p></div><b>Adapter ready</b></article>
              <article><span>Identity</span><div><h3>Agentic identity</h3><p>Signed requests can verify ERC-7857 ownership and approvals against the official Galileo Agentic ID registry.</p></div><b>Integrated</b></article>
            </div>
          </section>

          <section className="docs-section" id="escrow">
            <div className="docs-title"><span>06</span><div><p>Escrow contract</p><h2>Value moves after evidence</h2></div></div>
            <p className="docs-lead"><code>contracts/ThemisEscrow.sol</code> implements an ERC-20 task escrow with non-reentrant paths, verifier rotation, manual buyer settlement, and receipt-authorized settlement.</p>
            <div className="state-line">{["Open", "Accepted", "Submitted", "Released / Refunded"].map((state, index) => <div key={state}><span>{index + 1}</span><strong>{state}</strong>{index < 3 && <i>→</i>}</div>)}</div>
            <ul className="docs-list"><li>The buyer deposits tokens with a <code>policyHash</code>.</li><li>A non-buyer worker submits a non-zero <code>evidenceHash</code>.</li><li>The buyer can settle manually, or anyone can relay a valid verifier-signed receipt.</li><li>Authorization binds the contract, chain, task, evidence, decision, and deadline.</li></ul>
          </section>

          <section className="docs-section" id="deploy">
            <div className="docs-title"><span>07</span><div><p>Wallet deployment</p><h2>Compile locally. Deploy with your wallet.</h2></div></div>
            <p className="docs-lead">Compilation does not use a wallet. Run <code>pnpm contract:compile</code> to create the Cancun-targeted ABI and bytecode. Deployment requires an EVM wallet on Galileo, a small testnet 0G balance for gas, and a verifier address.</p>
            <div className="deploy-requirements">
              <div><span>1</span><p><strong>Wallet</strong>MetaMask, Rabby, or another injected EVM wallet.</p></div>
              <div><span>2</span><p><strong>Network</strong>Galileo · chain ID 16602 · RPC <code>evmrpc-testnet.0g.ai</code>.</p></div>
              <div><span>3</span><p><strong>Gas</strong><a href="https://faucet.0g.ai/" target="_blank" rel="noreferrer">Claim testnet 0G from the official faucet ↗</a></p></div>
              <div><span>4</span><p><strong>Verifier</strong>The public address matching <code>THEMIS_VERIFIER_PRIVATE_KEY</code>, or your connected wallet for manual testing.</p></div>
            </div>
            <DeployEscrow />
            <div className="docs-note warning"><strong>Before confirming</strong><p>Deployment is an on-chain transaction. Review the wallet’s network and gas estimate. The contract is an unaudited testnet implementation; do not use it to custody valuable mainnet assets.</p></div>
          </section>

          <section className="docs-section" id="configuration">
            <div className="docs-title"><span>08</span><div><p>Configuration</p><h2>Run locally or activate funded adapters</h2></div></div>
            <div className="code-grid">
              <div><p>Environment</p><pre><code>{`OG_RPC_URL=https://evmrpc-testnet.0g.ai
OG_STORAGE_INDEXER_URL=https://indexer-storage-testnet-turbo.0g.ai
OG_COMPUTE_PRIVATE_KEY=
OG_STORAGE_PRIVATE_KEY=
THEMIS_VERIFIER_PRIVATE_KEY=`}</code></pre></div>
              <div><p>Verification commands</p><pre><code>{`pnpm dev
pnpm test:run
pnpm contract:compile
pnpm build`}</code></pre></div>
            </div>
            <div className="docs-note warning"><strong>Signer safety</strong><p>The public demo has no custody key. Compute, Storage, and verifier keys belong only in encrypted server-side variables. The verifier should be a dedicated low-balance key, separate from the wallet that owns funds.</p></div>
          </section>

          <footer className="docs-footer"><div><span>Θ</span><p>Ready to watch policy become settlement?</p></div><Link href="/">Open the live proof console <b>↗</b></Link></footer>
        </article>
      </div>
    </main>
  );
}
