import { Wallet } from "ethers";
import { Themis, type EvidenceBundle } from "@themis-protocol/sdk";

const worker = new Wallet(process.env.WORKER_PRIVATE_KEY!);
const themis = new Themis({ network: "0g-galileo", contractAddress: process.env.THEMIS_ESCROW_ADDRESS!, signer: worker });
const taskId = BigInt(process.env.THEMIS_TASK_ID!);
await (await themis.acceptTask(taskId)).wait();
const evidence = JSON.parse(process.env.THEMIS_EVIDENCE_JSON!) as EvidenceBundle;
const evaluation = await themis.evaluate({ policy: themis.policy.research(), evidence });
if (evaluation.decision !== "release") throw new Error(`Settlement blocked: ${evaluation.checks.filter((check) => !check.passed).map((check) => check.id).join(", ")}`);
await (await themis.submitEvidence(taskId, evidence)).wait();
console.log({ taskId: taskId.toString(), evidenceHash: themis.evidence.hash(evidence), decision: evaluation.decision });
