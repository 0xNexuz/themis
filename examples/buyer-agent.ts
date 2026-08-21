import { Wallet, parseUnits } from "ethers";
import { ResearchPolicy, Themis } from "@themis-protocol/sdk";

const buyer = new Wallet(process.env.BUYER_PRIVATE_KEY!);
const themis = new Themis({ network: "0g-galileo", contractAddress: process.env.THEMIS_ESCROW_ADDRESS!, signer: buyer });
const task = await themis.createTask({ token: process.env.THEMIS_DEMO_USDC_ADDRESS!, amount: parseUnits("25", 6), expectedWorker: process.env.WORKER_ADDRESS!, policy: ResearchPolicy });
console.log({ transaction: task.hash, policyHash: themis.policy.hash(ResearchPolicy) });
await task.wait();
