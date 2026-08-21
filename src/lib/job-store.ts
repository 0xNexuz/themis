import { Redis } from "@upstash/redis";

export type DemoJob = { id: string; status: "running" | "complete" | "failed"; createdAt: string; steps: unknown[]; result?: unknown; error?: string };
const memory = new Map<string, DemoJob>();
function redis() { return process.env.UPSTASH_REDIS_REST_URL && process.env.UPSTASH_REDIS_REST_TOKEN ? Redis.fromEnv() : null; }
export function durableJobsConfigured() { return Boolean(redis()); }
export async function saveJob(job: DemoJob) { const client = redis(); if (client) await client.set(`themis:job:${job.id}`, job, { ex: 3600 }); else if (process.env.NODE_ENV !== "production") memory.set(job.id, job); else throw new Error("DURABLE_JOB_STORE_REQUIRED"); }
export async function getJob(id: string) { const client = redis(); if (client) return client.get<DemoJob>(`themis:job:${id}`); return memory.get(id) ?? null; }
export async function claimDemoSlot(clientId: string) { const client = redis(); if (!client) return process.env.NODE_ENV !== "production"; const key = `themis:demo-rate:${clientId}`; const count = await client.incr(key); if (count === 1) await client.expire(key, 86400); return count <= 2; }
export async function consumeNonce(nonce: string) { const client = redis(); if (client) return (await client.set(`themis:nonce:${nonce}`, "used", { nx: true, ex: 300 })) === "OK"; if (process.env.NODE_ENV === "production") throw new Error("DURABLE_NONCE_STORE_REQUIRED"); const key = `nonce:${nonce}`; if (memory.has(key)) return false; memory.set(key, { id: nonce, status: "complete", createdAt: new Date().toISOString(), steps: [] }); return true; }
