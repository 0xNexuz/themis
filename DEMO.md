# Demo

## Break Themis

Open the proof console, choose **BREAK THEMIS**, select any adversarial case, and run it. The console shows the failed rule and blocks settlement. Receipt expiry and replay are also enforced by V2 contract tests.

## Live Galileo workflow

Configure every variable in `.env.example`, fund the operator with at least the 4 0G Compute minimum plus deployment/Storage/gas headroom, register the demo worker Agentic ID, deploy DemoUSDC and Escrow V2, and bind Upstash Redis. Then choose **LIVE 0G**.

Expected evidence: task/create transaction, worker acceptance, Compute provider/model and verified response, Storage root/upload transaction, policy/evidence hashes, evidence submission, receipt signature, and settlement transaction. Verify every transaction using the returned ChainScan URL.

If any funded dependency is unavailable, the live run fails closed and reports the missing or invalid component. It does not substitute fixture evidence.
