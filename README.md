# Themis

Proof-carrying commerce for autonomous AI agents on 0G. A buyer agent commits a task, budget, and policy; a worker submits evidence; Themis releases or blocks settlement with a deterministic receipt.

## 0G integration

- **0G Chain / Galileo (16602):** live RPC status, wallet network onboarding, and the `ThemisEscrow.sol` settlement contract.
- **0G Compute:** official `@0gfoundation/0g-compute-ts-sdk` broker adapter for wallet-signed inference.
- **0G Storage:** official `@0gfoundation/0g-storage-ts-sdk` adapter for evidence commitments.
- **Agentic identity:** represented in the receipt and contract architecture; production registration is a later milestone.

The public demo performs deterministic verification without a custody key. Funded Compute and Storage operations activate only when their optional environment signers are configured.

## Development

```bash
pnpm dev
pnpm test:run
pnpm contract:compile
pnpm build
```

Copy `.env.example` to `.env.local` only when enabling funded 0G operations. Never expose or commit private keys.
