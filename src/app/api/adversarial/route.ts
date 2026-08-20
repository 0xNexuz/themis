import { NextResponse } from "next/server";
import { adversarialScenarios, runAdversarialScenario, type AdversarialScenario } from "@/lib/adversarial";
import { checkRateLimit, isAuthorizedUnsignedRequest } from "@/lib/security";
export async function POST(request: Request) {
  const rate = await checkRateLimit(request, "adversarial", 30);
  if (!rate.allowed) return NextResponse.json({ error: "Rate limit exceeded" }, { status: 429 });
  if (!isAuthorizedUnsignedRequest(request)) return NextResponse.json({ error: "Same-origin request required" }, { status: 401 });
  const { scenario } = await request.json() as { scenario?: AdversarialScenario };
  if (!scenario || !adversarialScenarios.includes(scenario)) return NextResponse.json({ error: "Unknown scenario" }, { status: 400 });
  return NextResponse.json(runAdversarialScenario(scenario));
}
