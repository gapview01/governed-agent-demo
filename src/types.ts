export type ActionType = "refund" | "spend" | "notify";

export interface Action {
  id: string;
  type: ActionType;
  /** Amount in major currency units. Zero for notify-only steps. */
  amount: number;
  currency: string;
  counterpart: string;
  memo: string;
}

export interface Plan {
  id: string;
  createdAt: string;
  steps: Action[];
  totalCost: number;
  currency: string;
}

export interface PolicyConfig {
  allowedActions: ActionType[];
  currency: string;
  autoApproveBelow: number;
  maxCostPerAction: number;
  maxCostPerPlan: number;
  dailySpendCap: number;
  blockedCounterparts: string[];
}

export interface PolicyDecision {
  ok: boolean;
  issues: string[];
  requiresApproval: boolean;
  reasons: string[];
}

export interface Simulation {
  ok: boolean;
  messages: string[];
  projectedCost: number;
  residualDailyCap: number;
}

export type ApprovalState = "not_required" | "pending" | "approved" | "rejected";

export interface Receipt {
  at: string;
  event:
    | "previewed"
    | "simulated"
    | "blocked"
    | "approval_requested"
    | "approved"
    | "rejected"
    | "executed";
  planId: string;
  detail: string;
  amounts?: { totalCost: number; currency: string };
}

export interface LedgerSnapshot {
  dailySpend: number;
  entries: Array<{ planId: string; amount: number; memo: string }>;
}
