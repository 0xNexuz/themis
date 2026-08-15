import fs from "node:fs";
import path from "node:path";
import { randomBytes } from "node:crypto";
import { Wallet } from "ethers";

const envPath = path.resolve(".env.local");
if (fs.existsSync(envPath)) {
  throw new Error(".env.local already exists; refusing to overwrite local secrets");
}

const wallet = Wallet.createRandom();
const contents = [
  "# Dedicated 0G Galileo testnet operator. Never commit this file.",
  `THEMIS_DEPLOYER_PRIVATE_KEY=${wallet.privateKey}`,
  `THEMIS_VERIFIER_PRIVATE_KEY=${wallet.privateKey}`,
  `OG_COMPUTE_PRIVATE_KEY=${wallet.privateKey}`,
  `OG_STORAGE_PRIVATE_KEY=${wallet.privateKey}`,
  `THEMIS_EVIDENCE_ENCRYPTION_KEY=${randomBytes(32).toString("hex")}`,
  `THEMIS_CHALLENGE_SECRET=${randomBytes(32).toString("hex")}`,
  "THEMIS_REQUIRE_STORAGE=true",
  "THEMIS_ESCROW_ADDRESS=",
  "",
].join("\n");

fs.writeFileSync(envPath, contents, { encoding: "utf8", mode: 0o600, flag: "wx" });
console.log(wallet.address);
