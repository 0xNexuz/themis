import { Interface, isAddress, isHexString } from "ethers";
import { NextResponse } from "next/server";
import artifact from "@/generated/ThemisEscrow.json";
import { checkRateLimit } from "@/lib/security";

const iface = new Interface(artifact.abi);
const defaultEscrow = process.env.THEMIS_ESCROW_ADDRESS ?? "0x46032577415dfaeddc9758a9d72bc16c47cb1c47";
type Input = { action?: string; escrowAddress?: string; params?: Record<string, unknown> };

function uint(value: unknown, label: string) {
  if ((typeof value !== "string" && typeof value !== "number") || !/^\d+$/.test(String(value))) throw new Error(`INVALID_${label.toUpperCase()}`);
  return BigInt(String(value));
}

function bytes32(value: unknown, label: string) {
  if (typeof value !== "string" || !isHexString(value, 32)) throw new Error(`INVALID_${label.toUpperCase()}`);
  return value;
}

export async function POST(request: Request) {
  const rate = checkRateLimit(request, "agent-actions", 60);
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
        args = [p.token, uint(p.amount, "amount"), bytes32(p.policyHash, "policy_hash")];
        break;
      case "accept": args = [uint(p.taskId, "task_id")]; break;
      case "submit": args = [uint(p.taskId, "task_id"), bytes32(p.evidenceHash, "evidence_hash")]; break;
      case "settle": args = [uint(p.taskId, "task_id"), Boolean(p.release)]; break;
      case "settleWithReceipt": args = [uint(p.taskId, "task_id"), Boolean(p.release), uint(p.deadline, "deadline"), p.signature]; break;
      case "dispute": args = [uint(p.taskId, "task_id"), bytes32(p.reasonHash, "reason_hash")]; break;
      case "resolve": args = [uint(p.taskId, "task_id"), Boolean(p.release)]; break;
      default: throw new Error("UNSUPPORTED_ACTION");
    }
    const method = ({ create: "createTask", accept: "acceptTask", submit: "submitEvidence", settle: "settle", dispute: "disputeTask", resolve: "resolveDispute" } as Record<string, string>)[body.action ?? ""] ?? body.action;
    return NextResponse.json({ chainId: 16602, to: escrowAddress, value: "0", data: iface.encodeFunctionData(method!, args) });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "INVALID_ACTION" }, { status: 400 });
  }
}
