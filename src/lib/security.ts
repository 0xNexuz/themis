import { timingSafeEqual } from "node:crypto";

const buckets = new Map<string, { count: number; resetAt: number }>();

export function checkRateLimit(request: Request, scope: string, limit = 20, windowMs = 60_000) {
  const forwarded = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim();
  const client = forwarded || request.headers.get("x-real-ip") || "unknown";
  const key = `${scope}:${client}`;
  const now = Date.now();
  const current = buckets.get(key);
  if (!current || current.resetAt <= now) {
    buckets.set(key, { count: 1, resetAt: now + windowMs });
    return { allowed: true, remaining: limit - 1, retryAfter: 0 };
  }
  current.count += 1;
  return {
    allowed: current.count <= limit,
    remaining: Math.max(0, limit - current.count),
    retryAfter: Math.ceil((current.resetAt - now) / 1000),
  };
}

export function isAuthorizedUnsignedRequest(request: Request) {
  const expected = process.env.THEMIS_API_KEY;
  const supplied = request.headers.get("authorization")?.replace(/^Bearer\s+/i, "");
  if (expected && supplied) {
    const left = Buffer.from(expected);
    const right = Buffer.from(supplied);
    return left.length === right.length && timingSafeEqual(left, right);
  }

  const origin = request.headers.get("origin");
  const host = request.headers.get("x-forwarded-host") ?? request.headers.get("host");
  if (!origin || !host) return process.env.NODE_ENV !== "production";
  try {
    return new URL(origin).host === host;
  } catch {
    return false;
  }
}

export function audit(event: string, fields: Record<string, unknown> = {}) {
  console.info(JSON.stringify({ service: "themis", event, at: new Date().toISOString(), ...fields }));
}
