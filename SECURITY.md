# Security

Themis V2 is unaudited testnet software. Do not custody valuable assets.

## Controls

- OpenZeppelin SafeERC20, ReentrancyGuard, Pausable, AccessControl, EIP-712, and ECDSA.
- Separate administrator, verifier, resolver, and pauser roles.
- Receipt deadlines, domain separation, consumed digests, terminal task states, expected-worker binding, and committed policy/evidence hashes.
- AES-256-GCM evidence encryption; keys remain server-only.
- Allowlisted HTTPS sources prevent arbitrary-fetch SSRF in the public workflow.
- Redis-backed nonce consumption, public job limits, and one-hour job retention.
- Demo mode cannot satisfy live Compute/Storage rules.

## Assumptions

The verifier correctly executes the published deterministic policy engine. Resolver governance remains trusted for disputed tasks. TEE and Storage proofs inherit 0G network and SDK assumptions. Operator wallets must remain low-balance and separated. Rotate leaked keys and pause V2 immediately.

Report vulnerabilities privately to the repository owner. Do not include secrets or exploitable evidence in public issues.
