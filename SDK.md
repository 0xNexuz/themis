# SDK

`packages/sdk` contains the private, publish-ready `@themis-protocol/sdk` workspace package.

```ts
const themis = new Themis({ network: "0g-galileo", contractAddress, signer });
const policy = themis.policy.research();
const policyHash = themis.policy.hash(policy);
const result = await themis.evaluate({ policy, evidence });
if (result.decision === "release") await themis.submitEvidence(taskId, evidence);
```

Available helpers cover Research, Code Delivery, and Data Delivery templates; canonical policy/evidence hashing; structured evaluation; task creation, acceptance, submission, and disputes; and EIP-712 receipt verification. See `examples/buyer-agent.ts` and `examples/worker-agent.ts`.

The package is not published. Consumers can use the workspace package or copy it into a monorepo until release governance and semantic-versioning policy are finalized.
