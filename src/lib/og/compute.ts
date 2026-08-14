import { ethers } from "ethers";
import { OG_NETWORK } from "./config";

/** Creates the official 0G Compute broker for direct, wallet-signed inference. */
export async function createThemisComputeBroker() {
  const privateKey = process.env.OG_COMPUTE_PRIVATE_KEY;
  if (!privateKey) throw new Error("OG_COMPUTE_PRIVATE_KEY is not configured");

  const { createZGComputeNetworkBroker } = await import("@0gfoundation/0g-compute-ts-sdk");
  const provider = new ethers.JsonRpcProvider(OG_NETWORK.rpcUrl);
  const wallet = new ethers.Wallet(privateKey, provider);
  return createZGComputeNetworkBroker(wallet);
}

export async function listInferenceServices() {
  const broker = await createThemisComputeBroker();
  return broker.inference.listService();
}
