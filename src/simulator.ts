import { Plan, PolicyConfig, Simulation } from "./types.js";
import { money } from "./policy.js";

/**
 * Dry-run a plan against a fictional ledger. This never mutates state.
 * It exists so an agent (or a human) can see the effect before anything is executed.
 */
export function simulate(
  plan: Plan,
  policy: PolicyConfig,
  dailySpendAlready: number,
): Simulation {
  const messages: string[] = [];
  const projectedCost = plan.totalCost;
  const residualDailyCap = policy.dailySpendCap - dailySpendAlready - projectedCost;

  if (projectedCost === 0) {
    messages.push("No funds move. Notify-only plan.");
  } else {
    messages.push(
      `Would move ${money(projectedCost, plan.currency)} across ${plan.steps.filter((s) => s.amount > 0).length} paid step(s).`,
    );
  }

  messages.push(
    `Daily spend today is ${money(dailySpendAlready, policy.currency)}; after this plan it would be ${money(dailySpendAlready + projectedCost, policy.currency)}.`,
  );

  if (residualDailyCap < 0) {
    messages.push(
      `Simulation fails: residual daily cap would be ${money(residualDailyCap, policy.currency)}.`,
    );
    return { ok: false, messages, projectedCost, residualDailyCap };
  }

  messages.push(
    `Residual daily cap after this plan: ${money(residualDailyCap, policy.currency)}.`,
  );
  return { ok: true, messages, projectedCost, residualDailyCap };
}
