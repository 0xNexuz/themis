import fs from "node:fs";
import path from "node:path";
import { randomBytes } from "node:crypto";
import { Wallet } from "ethers";

const envPath = path.resolve(".env.local");
if (fs.existsSync(envPath)) {
  throw new Error(".env.local already exists; refusing to overwrite local secrets");
}

const wallets = Object.fromEntries(["deployer", "verifier", "compute", "storage", "buyer", "worker"].map((role) => [role, Wallet.createRandom()]));
const contents = [
  "# Dedicated 0G Galileo testnet operator. Never commit this file.",
  `THEMIS_DEPLOYER_PRIVATE_KEY=${wallets.deployer.privateKey}`,
  `THEMIS_VERIFIER_PRIVATE_KEY=${wallets.verifier.privateKey}`,
  `OG_COMPUTE_PRIVATE_KEY=${wallets.compute.privateKey}`,
  `OG_STORAGE_PRIVATE_KEY=${wallets.storage.privateKey}`,
  `THEMIS_DEMO_BUYER_PRIVATE_KEY=${wallets.buyer.privateKey}`,
  `THEMIS_DEMO_WORKER_PRIVATE_KEY=${wallets.worker.privateKey}`,
  `THEMIS_EVIDENCE_ENCRYPTION_KEY=${randomBytes(32).toString("hex")}`,
  `THEMIS_CHALLENGE_SECRET=${randomBytes(32).toString("hex")}`,
  "THEMIS_REQUIRE_STORAGE=true",
  "THEMIS_ESCROW_ADDRESS=",
  "THEMIS_DEMO_USDC_ADDRESS=",
  "THEMIS_DEMO_AGENTIC_ID=",
  "UPSTASH_REDIS_REST_URL=",
  "UPSTASH_REDIS_REST_TOKEN=",
  "",
].join("\n");

fs.writeFileSync(envPath, contents, { encoding: "utf8", mode: 0o600, flag: "wx" });
console.log(JSON.stringify(Object.fromEntries(Object.entries(wallets).map(([role, wallet]) => [role, wallet.address])), null, 2));
