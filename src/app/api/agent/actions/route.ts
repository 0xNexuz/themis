import { Interface, isAddress, isHexString } from "ethers";
import { NextResponse } from "next/server";
import artifact from "@/generated/ThemisEscrow.json";
import { checkRateLimit } from "@/lib/security";

const iface = new Interface(artifact.abi);
const defaultEscrow = process.env.THEMIS_ESCROW_ADDRESS ?? "0x0B1Cdef5CE5EE077BFEC7d8B50C3fE3073857640";
type Input = { action?: string; escrowAddress?: string; params?: Record<string, unknown> };

function uint(value: unknown, label: string) {
  if ((typeof value !== "string" && typeof value !== "number") || !/^\d+$/.test(String(value))) throw new Error(`INVALID_${label.toUpperCase()}`);
  return BigInt(String(value));
}

function bytes32(value: unknown, label: string) {
  if (typeof value !== "string" || !isHexString(value, 32)) throw new Error(`INVALID_${label.toUpperCase()}`);
  return value;
}
function bool(value: unknown, label: string) { if (typeof value !== "boolean") throw new Error(`INVALID_${label.toUpperCase()}`); return value; }

export async function POST(request: Request) {
  const rate = await checkRateLimit(request, "agent-actions", 60);
  if (!rate.allowed) return NextResponse.json({ error: "Rate limit exceeded" }, { status: 429 });
  try {
    const body = await request.json() as Input;
    const escrowAddress = body.escrowAddress ?? defaultEscrow;
    if (!isAddress(escrowAddress)) throw new Error("INVALID_ESCROW_ADDRESS");
    const p = body.params ?? {};
    let args: unknown[];
    switch (body.action) {
      case "create":
        if (!isAddress(String(p.token))) throw new Error("INVALID_TOKEN");
        if (p.expectedWorker !== undefined && !isAddress(String(p.expectedWorker))) throw new Error("INVALID_EXPECTED_WORKER");
        args = [p.token, uint(p.amount, "amount"), p.expectedWorker ?? "0x0000000000000000000000000000000000000000", bytes32(p.policyHash, "policy_hash")];
        break;
      case "accept": args = [uint(p.taskId, "task_id")]; break;
      case "submit": args = [uint(p.taskId, "task_id"), bytes32(p.evidenceHash, "evidence_hash")]; break;
      case "settleWithReceipt":
        if (!isAddress(String(p.buyer)) || !isAddress(String(p.worker))) throw new Error("INVALID_RECEIPT_PARTY");
        args = [[uint(p.taskId, "task_id"), p.buyer, p.worker, bytes32(p.policyHash, "policy_hash"), bytes32(p.evidenceHash, "evidence_hash"), uint(p.amount, "amount"), uint(p.decision, "decision"), uint(p.nonce, "nonce"), uint(p.deadline, "deadline")], p.signature]; break;
      case "dispute": args = [uint(p.taskId, "task_id"), bytes32(p.reasonHash, "reason_hash")]; break;
      case "resolve": args = [uint(p.taskId, "task_id"), bool(p.release, "release")]; break;
      default: throw new Error("UNSUPPORTED_ACTION");
    }
    const method = ({ create: "createTask", accept: "acceptTask", submit: "submitEvidence", dispute: "disputeTask", resolve: "resolveDispute" } as Record<string, string>)[body.action ?? ""] ?? body.action;
    return NextResponse.json({ chainId: 16602, to: escrowAddress, value: "0", data: iface.encodeFunctionData(method!, args) });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "INVALID_ACTION" }, { status: 400 });
  }
}
