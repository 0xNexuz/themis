# Protocol

## Versioned objects

- `themis.policy.v1`: template, name, and typed rules.
- `themis.evidence.v1`: task, worker, identity, result/artifact commitments, sources, Compute proof, Storage commitment, timestamp, policy hash, amount, privacy flags, metrics, and metadata.
- `themis.receipt.v1`: evidence and policy hashes, structured checks, decision, creation time, and network.

Objects are canonicalized with recursively sorted object keys, normalized domain/address lists, and deterministic source ordering, then SHA-256 hashed. Monetary values are decimal strings.

Every check returns `id`, `label`, `status`, `expected`, `actual`, `evidencePath`, and `reason`. Objective failures return `block`; all required checks passing returns `release`; a party challenge moves the on-chain task to `dispute` for resolver action.

The EIP-712 settlement receipt binds task, buyer, worker, policy hash, evidence hash, amount, decision, nonce, deadline, chain ID, and verifying contract. A changed field invalidates authorization.
