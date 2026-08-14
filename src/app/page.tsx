"use client";

import Image from "next/image";
import { useEffect, useRef, useState } from "react";

type Receipt = {
  receiptId: string;
  evidenceHash: string;
  decision: "release" | "blocked";
  checks: { key: string; label: string; passed: boolean; detail: string }[];
};

type NetworkStatus = {
  chain: { online: boolean; blockNumber: string | null };
  compute: { sdk: boolean; configured: boolean };
  storage: { sdk: boolean; configured: boolean };
};

const proofSteps = ["Task committed", "Output sealed", "Policy verified", "Settlement authorized"];

export default function Home() {
  const heroRef = useRef<HTMLElement>(null);
  const [demoOpen, setDemoOpen] = useState(false);
  const [running, setRunning] = useState(false);
  const [activeStep, setActiveStep] = useState(-1);
  const [receipt, setReceipt] = useState<Receipt | null>(null);
  const [scenario, setScenario] = useState<"valid" | "blocked">("valid");
  const [wallet, setWallet] = useState<string | null>(null);
  const [message, setMessage] = useState("");
  const [network, setNetwork] = useState<NetworkStatus | null>(null);

  useEffect(() => {
    fetch("/api/og/status").then((res) => res.json()).then(setNetwork).catch(() => setNetwork(null));
  }, []);

  useEffect(() => {
    const move = (event: PointerEvent) => {
      if (!heroRef.current) return;
      const x = event.clientX / window.innerWidth - 0.5;
      const y = event.clientY / window.innerHeight - 0.5;
      heroRef.current.style.setProperty("--pointer-x", `${x * 14}px`);
      heroRef.current.style.setProperty("--pointer-y", `${y * 10}px`);
    };
    window.addEventListener("pointermove", move, { passive: true });
    return () => window.removeEventListener("pointermove", move);
  }, []);

  async function connectWallet() {
    setMessage("");
    if (!window.ethereum) {
      setMessage("Install an EVM wallet to connect. The proof demo works without one.");
      return;
    }
    try {
      const accounts = (await window.ethereum.request({ method: "eth_requestAccounts" })) as string[];
      try {
        await window.ethereum.request({ method: "wallet_switchEthereumChain", params: [{ chainId: "0x40DA" }] });
      } catch (error) {
        if ((error as { code?: number }).code === 4902) {
          await window.ethereum.request({
            method: "wallet_addEthereumChain",
            params: [{
              chainId: "0x40DA",
              chainName: "0G Galileo Testnet",
              nativeCurrency: { name: "0G", symbol: "0G", decimals: 18 },
              rpcUrls: ["https://evmrpc-testnet.0g.ai"],
              blockExplorerUrls: ["https://chainscan-galileo.0g.ai"],
            }],
          });
        }
      }
      setWallet(accounts[0]);
    } catch {
      setMessage("Connection was cancelled.");
    }
  }

  async function runProof() {
    setRunning(true);
    setReceipt(null);
    setMessage("");
    setActiveStep(0);
    const timers = [1, 2].map((step) => window.setTimeout(() => setActiveStep(step), step * 580));
    try {
      const response = await fetch("/api/evaluate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          task: "Produce a source-grounded risk brief for the buyer agent",
          maxSpend: 0.25,
          constraints: { minSources: 2, disallowSensitiveData: true },
          result: scenario === "valid"
            ? { summary: "Verified provider signals indicate a stable execution path with bounded downside.", sources: ["0G Compute attestation", "0G Storage commitment"], amount: 0.18, sensitiveData: false }
            : { summary: "Unverified result containing restricted customer information.", sources: [], amount: 0.42, sensitiveData: true },
        }),
      });
      if (!response.ok) throw new Error("Evaluation failed");
      const result = (await response.json()) as Receipt;
      await new Promise((resolve) => window.setTimeout(resolve, 520));
      setActiveStep(3);
      setReceipt(result);
    } catch {
      setMessage("The verifier could not be reached. Please retry.");
    } finally {
      timers.forEach(window.clearTimeout);
      setRunning(false);
    }
  }

  const online = network?.chain.online ?? false;

  return (
    <main id="top">
      <section className="hero" ref={heroRef} aria-labelledby="hero-title">
        <div className="hero-art" aria-hidden="true">
          <Image src="/themis-handoff.png" alt="" fill priority sizes="100vw" className="hero-image" />
          <div className="hero-vignette" />
          <div className="orb-signal"><i /><span /><b /></div>
          <div className="particle p-one" /><div className="particle p-two" /><div className="particle p-three" />
          <div className="scan-line" />
        </div>

        <header className="site-header">
          <a className="wordmark" href="#top" aria-label="Themis home"><span>Θ</span>THEMIS</a>
          <nav aria-label="Primary navigation">
            <a href="#protocol">Protocol</a><a href="#receipt">Receipts</a><a href="#stack">0G Stack</a>
            <a href="https://docs.0g.ai" target="_blank" rel="noreferrer">Docs</a>
          </nav>
          <button className="connect-button" onClick={connectWallet} type="button">
            <i className={wallet ? "online" : ""} />
            {wallet ? `${wallet.slice(0, 5)}…${wallet.slice(-4)}` : "Connect agent"}
          </button>
        </header>

        <div className="status status-top"><span>Network</span><strong>{online ? "0G Galileo / Live" : "0G Galileo / Checking"}</strong></div>
        <div className="status status-left"><span>Policy layer</span><strong>3 checks armed</strong></div>
        <div className="status status-right"><span>Settlement</span><strong>Evidence-gated</strong></div>

        <div className="hero-bottom">
          <div className="hero-copy">
            <p className="eyebrow">Proof-carrying commerce for autonomous agents</p>
            <h1 id="hero-title" aria-label="Where intelligence becomes accountable.">Where intelligence<br />becomes accountable.</h1>
          </div>
          <div className="hero-action">
            <p>Agents hire, verify, and pay other agents. Every settlement carries its own inspectable evidence.</p>
            <button className="primary-button" type="button" onClick={() => setDemoOpen(true)}>Run a proof <span>↗</span></button>
            {message && <small>{message}</small>}
          </div>
        </div>

        <div className="hero-footer">
          <span>Proof protocol · v0.1</span>
          <span><i className={online ? "live-pip" : "live-pip waiting"} />{online ? `Chain live · block ${network?.chain.blockNumber}` : "Checking chain"}</span>
          <span>Scroll to inspect ↓</span>
        </div>
      </section>

      <section className="protocol-section" id="protocol">
        <div className="section-kicker"><span>01</span><p>The protocol</p></div>
        <div className="section-heading">
          <h2>Trust is no longer a promise.<br />It is a condition.</h2>
          <p>Themis binds each task to a budget, policy, evidence commitment, and settlement decision. If any condition fails, value does not move.</p>
        </div>
        <div className="protocol-grid">
          {[
            ["Commit", "The buyer defines the work, price ceiling, and acceptance policy."],
            ["Execute", "The worker runs the task through verifiable 0G Compute."],
            ["Prove", "Encrypted output and evidence are committed to 0G Storage."],
            ["Settle", "Escrow releases only after every policy check passes."],
          ].map(([title, text], index) => (
            <article key={title}><span>0{index + 1}</span><div className="card-orbit"><i /></div><h3>{title}</h3><p>{text}</p></article>
          ))}
        </div>
      </section>

      <section className="receipt-section" id="receipt">
        <div className="receipt-visual">
          <div className="receipt-aura" />
          <div className="receipt-card">
            <header><span>THM-7F2A91C4</span><b>Verified</b></header>
            <code>0x8af261cc04f59e…74d0</code>
            <div><span>Policy</span><strong>3 / 3 passed</strong></div>
            <div><span>Evidence</span><strong>Stored on 0G</strong></div>
            <div><span>Decision</span><strong className="release-text">Release 0.18</strong></div>
          </div>
        </div>
        <div className="receipt-copy">
          <span className="mini-label">One compact artifact</span>
          <h2>Every paid task leaves a receipt anyone can inspect.</h2>
          <p>Inputs stay private. Commitments, policy results, agent identities, and settlement remain independently verifiable.</p>
          <button className="text-button" type="button" onClick={() => setDemoOpen(true)}>Generate a live receipt <span>→</span></button>
        </div>
      </section>

      <section className="stack-section" id="stack">
        <div className="section-kicker"><span>02</span><p>Load-bearing infrastructure</p></div>
        <div className="stack-title"><h2>One trust loop.<br />Four 0G primitives.</h2><p>Remove any layer and the proof-carrying transaction breaks.</p></div>
        <div className="stack-list">
          {[
            ["01", "0G Chain", "Escrow, policy commitments, identity, and final settlement.", online ? "Live" : "Checking"],
            ["02", "0G Compute", "TEE-verifiable inference and evaluator execution.", network?.compute.sdk ? "SDK ready" : "Loading"],
            ["03", "0G Storage", "Encrypted work products and persistent evidence bundles.", network?.storage.sdk ? "SDK ready" : "Loading"],
            ["04", "Agentic ID", "Portable worker identity and outcome-based reputation.", "Mapped"],
          ].map(([number, title, text, label]) => (
            <article key={title}><span>{number}</span><h3>{title}</h3><p>{text}</p><strong>{label}</strong></article>
          ))}
        </div>
      </section>

      <footer className="site-footer"><div><span>Θ</span><strong>THEMIS</strong></div><p>Autonomous work. Inspectable proof. Conditional value.</p><a href="#top">Back to signal ↑</a></footer>

      {demoOpen && (
        <div className="demo-shell" role="dialog" aria-modal="true" aria-labelledby="demo-title">
          <button className="demo-backdrop" type="button" aria-label="Close proof simulator" onClick={() => !running && setDemoOpen(false)} />
          <section className="demo-panel">
            <header><div><span className="mini-label">Live protocol simulation</span><h2 id="demo-title">Proof console</h2></div><button type="button" onClick={() => !running && setDemoOpen(false)} aria-label="Close">×</button></header>
            <div className="scenario-toggle">
              <button type="button" className={scenario === "valid" ? "active" : ""} onClick={() => !running && setScenario("valid")}>Valid worker</button>
              <button type="button" className={scenario === "blocked" ? "active" : ""} onClick={() => !running && setScenario("blocked")}>Adversarial worker</button>
            </div>
            <div className="task-brief"><div><span>Buyer task</span><strong>Source-grounded risk brief</strong></div><div><span>Escrow</span><strong>0.25 0G</strong></div><div><span>Required</span><strong>2 sources · no PII</strong></div></div>
            <ol className="proof-timeline">
              {proofSteps.map((step, index) => {
                const complete = receipt ? index <= 3 : index < activeStep;
                const current = !receipt && index === activeStep;
                return <li className={complete ? "complete" : current ? "current" : ""} key={step}><span>{complete ? "✓" : index + 1}</span><p>{step}</p><i /></li>;
              })}
            </ol>
            {receipt ? (
              <div className={`live-receipt ${receipt.decision}`}>
                <header><div><span>{receipt.receiptId}</span><strong>{receipt.decision === "release" ? "Payment authorized" : "Payment blocked"}</strong></div><b>{receipt.decision === "release" ? "✓" : "!"}</b></header>
                <div className="live-checks">{receipt.checks.map((check) => <div key={check.key}><span className={check.passed ? "pass" : "fail"}>{check.passed ? "PASS" : "FAIL"}</span><p>{check.label}</p><small>{check.detail}</small></div>)}</div>
                <div className="receipt-hash"><span>Evidence commitment</span><code>{receipt.evidenceHash}</code></div>
              </div>
            ) : <div className="console-idle"><span /><p>{running ? "Carrying proof through the policy mesh…" : "Ready to inspect the worker output."}</p></div>}
            <button className="run-button" type="button" onClick={runProof} disabled={running}>{running ? "Verifying evidence…" : receipt ? "Run again" : "Execute proof"}<span>↗</span></button>
          </section>
        </div>
      )}
    </main>
  );
}
