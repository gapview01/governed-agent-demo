import { createPlan } from "./planner.js";
import { Plan } from "./types.js";

/** Fictional counterparts only — nothing here is a real customer or vendor. */
export const scenarios: Record<string, () => Plan> = {
  "refund-small": () =>
    createPlan([
      {
        type: "refund",
        amount: 120,
        currency: "AUD",
        counterpart: "riverlane-coffee.example",
        memo: "Goodwill refund for a delayed order",
      },
      {
        type: "notify",
        amount: 0,
        currency: "AUD",
        counterpart: "riverlane-coffee.example",
        memo: "Email the customer that the refund is on the way",
      },
    ]),
  "spend-needs-approval": () =>
    createPlan([
      {
        type: "spend",
        amount: 800,
        currency: "AUD",
        counterpart: "northshore-media.example",
        memo: "Sponsored campaign for the spring catalogue",
      },
    ]),
  "spend-over-cap": () =>
    createPlan([
      {
        type: "spend",
        amount: 4500,
        currency: "AUD",
        counterpart: "northshore-media.example",
        memo: "Attempted spend above the per-action cap",
      },
    ]),
  "blocked-counterpart": () =>
    createPlan([
      {
        type: "spend",
        amount: 200,
        currency: "AUD",
        counterpart: "blocked.example",
        memo: "Should be refused by the counterpart allowlist",
      },
    ]),
};

export function listScenarios(): string[] {
  return Object.keys(scenarios);
}

export function getScenario(name: string): Plan {
  const factory = scenarios[name];
  if (!factory) {
    throw new Error(`Unknown scenario "${name}". Try one of: ${listScenarios().join(", ")}`);
  }
  return factory();
}
