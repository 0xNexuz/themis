import { createHash } from "node:crypto";

export type EvaluationInput = {
  task: string;
  maxSpend: number;
  constraints?: { minSources?: number; disallowSensitiveData?: boolean };
  result: { summary: string; sources: string[]; amount: number; sensitiveData?: boolean };
};

export function evaluateEvidence(input: EvaluationInput) {
  const minSources = input.constraints?.minSources ?? 1;
  const disallowSensitiveData = input.constraints?.disallowSensitiveData ?? true;
  const checks = [
    { key: "task-defined", label: "Task output is complete", passed: input.task.trim().length >= 12 && input.result.summary.trim().length >= 24, detail: `${input.result.summary.trim().length} characters supplied` },
    { key: "source-threshold", label: "Source threshold met", passed: input.result.sources.length >= minSources, detail: `${input.result.sources.length} of ${minSources} required sources` },
    { key: "budget-policy", label: "Spend remains inside policy", passed: input.result.amount <= input.maxSpend && input.result.amount >= 0, detail: `${input.result.amount.toFixed(2)} requested / ${input.maxSpend.toFixed(2)} maximum` },
    { key: "privacy-policy", label: "Sensitive data policy satisfied", passed: !disallowSensitiveData || !input.result.sensitiveData, detail: input.result.sensitiveData ? "Restricted data detected" : "No restricted data detected" },
  ];
  const canonical = JSON.stringify({
    task: input.task.trim(),
    maxSpend: Number(input.maxSpend),
    constraints: { minSources, disallowSensitiveData },
    result: { summary: input.result.summary.trim(), sources: [...input.result.sources].sort(), amount: Number(input.result.amount), sensitiveData: Boolean(input.result.sensitiveData) },
  });
  const evidenceHash = `0x${createHash("sha256").update(canonical).digest("hex")}`;
  const policyHash = `0x${createHash("sha256").update(JSON.stringify({ task: input.task, maxSpend: input.maxSpend, constraints: input.constraints })).digest("hex")}`;
  const passed = checks.every((check) => check.passed);
  return {
    receiptId: `THM-${evidenceHash.slice(2, 10).toUpperCase()}`,
    evidenceHash,
    policyHash,
    decision: passed ? ("release" as const) : ("blocked" as const),
    checks,
    createdAt: new Date().toISOString(),
    network: { name: "0G Galileo Testnet", chainId: 16602, explorer: "https://chainscan-galileo.0g.ai" },
  };
}
