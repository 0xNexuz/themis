import { NextResponse } from "next/server";
import artifact from "@/generated/ThemisEscrow.json";

export function GET() {
  return NextResponse.json(artifact, {
    headers: { "Cache-Control": "public, max-age=3600, s-maxage=86400" },
  });
}
