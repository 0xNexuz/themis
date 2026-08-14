import { ethers } from "ethers";
import { OG_NETWORK } from "./config";

export type StoredEvidence = {
  rootHash: string;
  txHash: string;
};

/** Uploads an encrypted-ready evidence bundle to 0G Storage when a funded signer is configured. */
export async function uploadEvidenceBundle(bundle: unknown): Promise<StoredEvidence> {
  const privateKey = process.env.OG_STORAGE_PRIVATE_KEY;
  if (!privateKey) throw new Error("OG_STORAGE_PRIVATE_KEY is not configured");

  const { Indexer, MemData } = await import("@0gfoundation/0g-storage-ts-sdk");
  const provider = new ethers.JsonRpcProvider(OG_NETWORK.rpcUrl);
  const signer = new ethers.Wallet(privateKey, provider);
  const indexer = new Indexer(OG_NETWORK.storageIndexerUrl);
  const bytes = new TextEncoder().encode(JSON.stringify(bundle));
  const data = new MemData(bytes);
  const [tree, treeError] = await data.merkleTree();
  if (treeError !== null || !tree) throw new Error(`0G Merkle tree error: ${treeError}`);

  const [transaction, uploadError] = await indexer.upload(data, OG_NETWORK.rpcUrl, signer);
  if (uploadError !== null || !transaction) throw new Error(`0G upload error: ${uploadError}`);
  if (!("rootHash" in transaction)) throw new Error("Fragmented evidence uploads are not supported yet");

  return { rootHash: transaction.rootHash, txHash: transaction.txHash };
}
