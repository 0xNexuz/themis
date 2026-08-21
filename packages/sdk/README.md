# @themis-protocol/sdk

Typed policy, evidence, receipt, and 0G Galileo contract helpers for Themis. This package is prepared for publishing but remains private until an explicit release decision.

```ts
const themis = new Themis({ network: "0g-galileo", contractAddress, signer });
const policy = themis.policy.research();
const task = await themis.createTask({ token, amount, expectedWorker, policy });
```
