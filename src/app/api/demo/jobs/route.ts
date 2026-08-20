import { randomUUID } from "node:crypto";
import { NextResponse } from "next/server";
import { runRiskBrief } from "@/lib/demo-workflow";
import { claimDemoSlot, saveJob, type DemoJob } from "@/lib/job-store";
export const runtime = "nodejs";
export const maxDuration = 300;
export async function POST(request: Request) {
  const client = request.headers.get("x-forwarded-for")?.split(",")[0] ?? "unknown";
  if (!(await claimDemoSlot(client))) return NextResponse.json({ error: "Daily live-demo limit reached" }, { status: 429 });
  const job: DemoJob = { id: randomUUID(), status: "running", createdAt: new Date().toISOString(), steps: [] };
  await saveJob(job);
  try {
    const result = await runRiskBrief(async (step) => { job.steps.push(step); await saveJob(job); });
    job.status = "complete"; job.result = result; await saveJob(job);
    return NextResponse.json(job);
  } catch (error) {
    job.status = "failed"; job.error = error instanceof Error ? error.message : "LIVE_DEMO_FAILED"; await saveJob(job);
    return NextResponse.json(job, { status: 503 });
  }
}
