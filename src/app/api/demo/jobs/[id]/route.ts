import { NextResponse } from "next/server";
import { getJob } from "@/lib/job-store";
export async function GET(_request: Request, context: { params: Promise<{ id: string }> }) { const { id } = await context.params; const job = await getJob(id); return job ? NextResponse.json(job) : NextResponse.json({ error: "Job not found" }, { status: 404 }); }
