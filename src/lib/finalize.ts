import { createCipheriv, randomBytes } from "node:crypto";
import { listInferenceServices } from "./og/compute";
import { uploadEvidenceBundle } from "./og/storage";
import { audit } from "./security";
import { evaluateEvidence, type EvaluationInput } from "./themis";

function encryptionKey() {
  const configured = process.env.THEMIS_EVIDENCE_ENCRYPTION_KEY?.replace(/^0x/, "");
  if (!configured || !/^[a-fA-F0-9]{64}$/.test(configured)) {
    throw new Error("THEMIS_EVIDENCE_ENCRYPTION_KEY must be a 32-byte hex value");
  }
  return Buffer.from(configured, "hex");
}

export function encryptEvidence(bundle: unknown) {
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", encryptionKey(), iv);
  const ciphertext = Buffer.concat([cipher.update(JSON.stringify(bundle), "utf8"), cipher.final()]);
  return {
    algorithm: "AES-256-GCM",
    iv: iv.toString("base64url"),
    tag: cipher.getAuthTag().toString("base64url"),
    ciphertext: ciphertext.toString("base64url"),
  };
}

export async function finalizeEvidence(input: EvaluationInput, existing = evaluateEvidence(input)) {
  const requireStorage = process.env.THEMIS_REQUIRE_STORAGE === "true";
  let compute: { status: string; serviceCount?: number; error?: string } = { status: "unconfigured" };
  if (process.env.OG_COMPUTE_PRIVATE_KEY) {
    try {
      const services = await listInferenceServices();
      compute = { status: "attested", serviceCount: Array.isArray(services) ? services.length : undefined };
    } catch (error) {
      compute = { status: "degraded", error: error instanceof Error ? error.message : "COMPUTE_ATTESTATION_FAILED" };
    }
  }

  try {
    const encryptedEvidence = encryptEvidence({ evidence: input, receipt: existing });
    const stored = await uploadEvidenceBundle({
      schema: "themis-evidence-v1",
      receiptId: existing.receiptId,
      evidenceHash: existing.evidenceHash,
      policyHash: existing.policyHash,
      encryption: encryptedEvidence,
    });
    audit("receipt.stored", { receiptId: existing.receiptId, rootHash: stored.rootHash, txHash: stored.txHash });
    return {
      ...existing,
      compute,
      storage: { status: "stored" as const, encryption: "AES-256-GCM", ...stored },
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : "EVIDENCE_UPLOAD_FAILED";
    audit("receipt.storage_failed", { receiptId: existing.receiptId, error: message });
    if (requireStorage) throw new Error(`EVIDENCE_STORAGE_REQUIRED: ${message}`);
    return { ...existing, compute, storage: { status: "degraded" as const, error: message } };
  }
}
