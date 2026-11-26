import { randomUUID } from "node:crypto";
import { Action, Plan } from "./types.js";

export function createPlan(steps: Omit<Action, "id">[], currency = "AUD"): Plan {
  const withIds: Action[] = steps.map((step, index) => ({
    ...step,
    id: `step-${index + 1}`,
    currency: step.currency || currency,
  }));
  const totalCost = withIds.reduce((sum, step) => sum + step.amount, 0);
  return {
    id: `plan-${randomUUID().slice(0, 8)}`,
    createdAt: new Date().toISOString(),
    steps: withIds,
    totalCost,
    currency,
  };
}

export function summarisePlan(plan: Plan): string {
  const lines = [
    `Plan ${plan.id}  (${plan.steps.length} step${plan.steps.length === 1 ? "" : "s"}, total ${plan.totalCost} ${plan.currency})`,
  ];
  for (const step of plan.steps) {
    lines.push(
      `  - ${step.id}: ${step.type} ${step.amount} ${step.currency} → ${step.counterpart}  (${step.memo})`,
    );
  }
  return lines.join("\n");
}
