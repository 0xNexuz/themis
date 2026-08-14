import { NextResponse } from "next/server";
import { getAgentManifest } from "@/lib/agent";

export function GET(request: Request) {
  return NextResponse.json(getAgentManifest(new URL(request.url).origin));
}
