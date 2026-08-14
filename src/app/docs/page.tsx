import type { Metadata } from "next";
import Link from "next/link";

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

const sections = [
  ["overview", "Overview"], ["flow", "Protocol flow"], ["api", "Evaluator API"],
  ["receipts", "Proof receipts"], ["stack", "0G integration"],
  ["escrow", "Escrow contract"], ["configuration", "Configuration"],
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

          <section className="docs-section" id="receipts">
            <div className="docs-title"><span>03</span><div><p>Proof receipts</p><h2>One portable decision artifact</h2></div></div>
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
            <div className="docs-title"><span>04</span><div><p>0G integration</p><h2>Four load-bearing layers</h2></div></div>
            <div className="integration-list">
              <article><span>Chain</span><div><h3>0G Galileo</h3><p>Live block height, wallet onboarding to chain ID 16602, and the escrow settlement lifecycle.</p></div><b>Live read</b></article>
              <article><span>Compute</span><div><h3>Official Compute SDK</h3><p><code>@0gfoundation/0g-compute-ts-sdk</code> creates a wallet-signed broker when its server-side signer is configured.</p></div><b>Adapter ready</b></article>
              <article><span>Storage</span><div><h3>Official Storage SDK</h3><p><code>@0gfoundation/0g-storage-ts-sdk</code> builds a Merkle tree and uploads the evidence payload.</p></div><b>Adapter ready</b></article>
              <article><span>Identity</span><div><h3>Agentic identity</h3><p>Worker identity is represented in the transaction and receipt architecture; portable reputation registration is next.</p></div><b>Roadmap</b></article>
            </div>
          </section>

          <section className="docs-section" id="escrow">
            <div className="docs-title"><span>05</span><div><p>Escrow contract</p><h2>Value moves after evidence</h2></div></div>
            <p className="docs-lead"><code>contracts/ThemisEscrow.sol</code> implements an ERC-20 task escrow with non-reentrant create and settle paths.</p>
            <div className="state-line">{["Open", "Accepted", "Submitted", "Released / Refunded"].map((state, index) => <div key={state}><span>{index + 1}</span><strong>{state}</strong>{index < 3 && <i>→</i>}</div>)}</div>
            <ul className="docs-list"><li>The buyer deposits tokens with a <code>policyHash</code>.</li><li>A non-buyer worker submits a non-zero <code>evidenceHash</code>.</li><li>Only the buyer can release or refund settlement.</li><li>Events preserve the task, evidence, and settlement trail.</li></ul>
          </section>

          <section className="docs-section" id="configuration">
            <div className="docs-title"><span>06</span><div><p>Configuration</p><h2>Run locally or activate funded adapters</h2></div></div>
            <div className="code-grid">
              <div><p>Environment</p><pre><code>{`OG_RPC_URL=https://evmrpc-testnet.0g.ai
OG_STORAGE_INDEXER_URL=https://indexer-storage-testnet-turbo.0g.ai
OG_COMPUTE_PRIVATE_KEY=
OG_STORAGE_PRIVATE_KEY=`}</code></pre></div>
              <div><p>Verification commands</p><pre><code>{`pnpm dev
pnpm test:run
pnpm contract:compile
pnpm build`}</code></pre></div>
            </div>
            <div className="docs-note warning"><strong>Signer safety</strong><p>The public demo has no custody key. Add funded 0G keys only as encrypted server-side variables; never expose or commit them.</p></div>
          </section>

          <footer className="docs-footer"><div><span>Θ</span><p>Ready to watch policy become settlement?</p></div><Link href="/">Open the live proof console <b>↗</b></Link></footer>
        </article>
      </div>
    </main>
  );
}
