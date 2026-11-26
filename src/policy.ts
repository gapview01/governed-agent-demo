import { readFileSync } from "node:fs";
import { Action, Plan, PolicyConfig, PolicyDecision } from "./types.js";

export function loadPolicy(path: string): PolicyConfig {
  const raw = JSON.parse(readFileSync(path, "utf8")) as PolicyConfig;
  return raw;
}

export function defaultPolicy(): PolicyConfig {
  return {
    allowedActions: ["refund", "spend", "notify"],
    currency: "AUD",
    autoApproveBelow: 500,
    maxCostPerAction: 2000,
    maxCostPerPlan: 3000,
    dailySpendCap: 5000,
    blockedCounterparts: ["blocked.example", "denied-vendor.example"],
  };
}

export function evaluatePolicy(
  plan: Plan,
  policy: PolicyConfig,
  dailySpendAlready: number,
): PolicyDecision {
  const issues: string[] = [];
  const reasons: string[] = [];

  if (plan.currency !== policy.currency) {
    issues.push(
      `Plan currency ${plan.currency} does not match policy currency ${policy.currency}.`,
    );
  }

  if (plan.totalCost > policy.maxCostPerPlan) {
    issues.push(
      `Plan total ${money(plan.totalCost, plan.currency)} exceeds the plan cap of ${money(policy.maxCostPerPlan, policy.currency)}.`,
    );
  }

  if (dailySpendAlready + plan.totalCost > policy.dailySpendCap) {
    issues.push(
      `Plan would take daily spend to ${money(dailySpendAlready + plan.totalCost, policy.currency)}, above the daily cap of ${money(policy.dailySpendCap, policy.currency)}.`,
    );
  }

  for (const step of plan.steps) {
    issues.push(...evaluateStep(step, policy));
  }

  const ok = issues.length === 0;
  const requiresApproval = ok && plan.totalCost >= policy.autoApproveBelow;

  if (ok && requiresApproval) {
    reasons.push(
      `Total ${money(plan.totalCost, plan.currency)} is at or above the auto-approve threshold of ${money(policy.autoApproveBelow, policy.currency)}, so a human must approve before execution.`,
    );
  } else if (ok) {
    reasons.push(
      `Total ${money(plan.totalCost, plan.currency)} is below ${money(policy.autoApproveBelow, policy.currency)}, so this plan can run after a successful simulation.`,
    );
  }

  return { ok, issues, requiresApproval, reasons };
}

function evaluateStep(step: Action, policy: PolicyConfig): string[] {
  const issues: string[] = [];
  if (!policy.allowedActions.includes(step.type)) {
    issues.push(`Step ${step.id} uses action "${step.type}", which is not on the allowlist.`);
  }
  if (step.amount < 0) {
    issues.push(`Step ${step.id} has a negative amount.`);
  }
  if (step.type !== "notify" && step.amount === 0) {
    issues.push(`Step ${step.id} is a ${step.type} with a zero amount.`);
  }
  if (step.amount > policy.maxCostPerAction) {
    issues.push(
      `Step ${step.id} costs ${money(step.amount, step.currency)}, above the per-action cap of ${money(policy.maxCostPerAction, policy.currency)}.`,
    );
  }
  const counterpart = step.counterpart.trim().toLowerCase();
  if (policy.blockedCounterparts.some((blocked) => counterpart === blocked.toLowerCase())) {
    issues.push(`Step ${step.id} targets blocked counterpart "${step.counterpart}".`);
  }
  return issues;
}

export function money(amount: number, currency: string): string {
  return new Intl.NumberFormat("en-AU", {
    style: "currency",
    currency,
    maximumFractionDigits: 2,
  }).format(amount);
}
