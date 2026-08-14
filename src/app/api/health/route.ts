import { NextResponse } from "next/server";

export function GET() {
  return NextResponse.json({ service: "themis-verifier", status: "ok", version: "0.1.0", time: new Date().toISOString() });
}
