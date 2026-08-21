# Architecture

```text
Buyer/SDK → policy hash → Escrow V2
                     ↓
Worker → 0G Compute → normalized core evidence
                     ↓
          AES-256-GCM → 0G Storage root
                     ↓
Policy engine → structured checks → EIP-712 receipt
                     ↓
Escrow verifies domain + task + policy + evidence + nonce → release/refund
```

The SDK owns canonical policy and evidence representations. Next.js APIs, agent scripts, and tests import that same implementation. The server owns funded Compute/Storage operations, encryption, identity verification, receipt signing, and capped public demo jobs. Upstash Redis supplies TTL job state, one-time nonces, idempotency, and distributed limits.

Evidence uses two commitments to avoid a self-referential Storage root: the encrypted core bundle is uploaded first; the final evidence commitment then binds the core result and returned Storage commitment.

Modes are explicit: `live` requires verified Compute and Storage proofs; `demo` never produces a settlement-valid live receipt.
