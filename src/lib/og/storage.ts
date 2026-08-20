import { ethers } from "ethers";
import { OG_NETWORK } from "./config";
import { createHash, randomUUID } from "node:crypto";
import { readFile, unlink } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

export type StoredEvidence = {
  rootHash: string;
  txHash: string;
  verified: boolean;
  payloadHash: string;
};

/** Uploads an encrypted-ready evidence bundle to 0G Storage when a funded signer is configured. */
export async function uploadEvidenceBundle(bundle: unknown): Promise<StoredEvidence> {
  const privateKey = process.env.OG_STORAGE_PRIVATE_KEY;
  if (!privateKey) throw new Error("OG_STORAGE_PRIVATE_KEY is not configured");

  const { Indexer, MemData } = await import("@0gfoundation/0g-storage-ts-sdk");
  const provider = new ethers.JsonRpcProvider(OG_NETWORK.rpcUrl);
  const signer = new ethers.Wallet(privateKey, provider);
  const indexer = new Indexer(OG_NETWORK.storageIndexerUrl);
  const serialized = JSON.stringify(bundle);
  const bytes = new TextEncoder().encode(serialized);
  const data = new MemData(bytes);
  const [tree, treeError] = await data.merkleTree();
  if (treeError !== null || !tree) throw new Error(`0G Merkle tree error: ${treeError}`);

  const [transaction, uploadError] = await indexer.upload(data, OG_NETWORK.rpcUrl, signer);
  if (uploadError !== null || !transaction) throw new Error(`0G upload error: ${uploadError}`);
  if (!("rootHash" in transaction)) throw new Error("Fragmented evidence uploads are not supported yet");

  const file = join(tmpdir(), `themis-${randomUUID()}.json`);
  try {
    const downloadError = await indexer.download(transaction.rootHash, file, true);
    if (downloadError) throw new Error(`0G download verification error: ${downloadError}`);
    const downloaded = await readFile(file);
    const expected = createHash("sha256").update(bytes).digest("hex");
    const actual = createHash("sha256").update(downloaded).digest("hex");
    if (expected !== actual) throw new Error("0G_STORAGE_RETRIEVAL_MISMATCH");
    return { rootHash: transaction.rootHash, txHash: transaction.txHash, verified: true, payloadHash: `0x${expected}` };
  } finally {
    await unlink(file).catch(() => undefined);
  }
}
