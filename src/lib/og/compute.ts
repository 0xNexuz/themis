import { ethers } from "ethers";
import { OG_NETWORK } from "./config";
import { hashCanonical, type ComputeAttestation } from "@themis-protocol/sdk";

/** Creates the official 0G Compute broker for direct, wallet-signed inference. */
export async function createThemisComputeBroker() {
  const privateKey = process.env.OG_COMPUTE_PRIVATE_KEY;
  if (!privateKey) throw new Error("OG_COMPUTE_PRIVATE_KEY is not configured");

  const { createZGComputeNetworkBroker } = await import("@0gfoundation/0g-compute-ts-sdk");
  const provider = new ethers.JsonRpcProvider(OG_NETWORK.rpcUrl);
  const wallet = new ethers.Wallet(privateKey, provider);
  return createZGComputeNetworkBroker(wallet);
}

export async function listInferenceServices() {
  const broker = await createThemisComputeBroker();
  return broker.inference.listServiceWithDetail();
}

export async function runVerifiedInference(messages: Array<{ role: "system" | "user"; content: string }>) {
  const broker = await createThemisComputeBroker();
  const services = await broker.inference.listServiceWithDetail();
  const configured = process.env.OG_COMPUTE_PROVIDER?.toLowerCase();
  const service = services.find((item) => configured ? item.provider.toLowerCase() === configured : item.serviceType === "chatbot" && item.teeSignerAcknowledged && item.healthMetrics?.status === "healthy");
  if (!service) throw new Error("NO_HEALTHY_0G_CHAT_PROVIDER");
  const prompt = messages.map((message) => `${message.role}: ${message.content}`).join("\n");
  const { endpoint, model } = await broker.inference.getServiceMetadata(service.provider, process.env.OG_COMPUTE_MODEL || undefined);
  const headers = await broker.inference.getRequestHeaders(service.provider, prompt);
  const response = await fetch(`${endpoint.replace(/\/$/, "")}/chat/completions`, { method: "POST", headers: { "content-type": "application/json", ...headers }, body: JSON.stringify({ model, messages, temperature: 0.1, response_format: { type: "json_object" } }) });
  const raw = await response.text();
  if (!response.ok) throw new Error(`0G_COMPUTE_${response.status}: ${raw.slice(0, 300)}`);
  const payload = JSON.parse(raw) as { id?: string; choices?: Array<{ message?: { content?: string } }>; usage?: unknown };
  const content = payload.choices?.[0]?.message?.content;
  if (!content) throw new Error("0G_COMPUTE_EMPTY_RESPONSE");
  const responseKey = response.headers.get("ZG-Res-Key") ?? payload.id;
  const verified = (await broker.inference.processResponse(service.provider, responseKey, JSON.stringify(payload.usage ?? {}))) === true;
  const attestation: ComputeAttestation = { mode: "live", provider: service.provider, model, requestHash: hashCanonical({ messages, model }), responseHash: hashCanonical({ content }), responseKey, teeType: service.verifiability, verified };
  return { content, attestation, endpoint };
}
