import { ApprovalDesk } from "./approval.js";
import { AuditLog, receipt } from "./audit.js";
import { Ledger } from "./executor.js";
import { evaluatePolicy, money } from "./policy.js";
import { summarisePlan } from "./planner.js";
import { simulate } from "./simulator.js";
import { Plan, PolicyConfig, PolicyDecision, Simulation } from "./types.js";

export interface PreviewResult {
  plan: Plan;
  summary: string;
  policy: PolicyDecision;
}

export interface SimulateResult {
  policy: PolicyDecision;
  simulation: Simulation;
}

export interface RunResult {
  executed: boolean;
  message: string;
  simulation?: Simulation;
  policy: PolicyDecision;
}

export class GovernedEngine {
  readonly approvals = new ApprovalDesk();

  constructor(
    readonly policy: PolicyConfig,
    readonly ledger: Ledger,
    readonly audit: AuditLog,
  ) {}

  preview(plan: Plan): PreviewResult {
    const policy = evaluatePolicy(plan, this.policy, this.ledger.getSnapshot().dailySpend);
    const summary = summarisePlan(plan);
    this.audit.append(
      receipt(
        "previewed",
        plan.id,
        policy.ok ? policy.reasons.join(" ") : policy.issues.join(" "),
        { totalCost: plan.totalCost, currency: plan.currency },
      ),
    );
    if (!policy.ok) {
      this.audit.append(receipt("blocked", plan.id, policy.issues.join(" ")));
    }
    return { plan, summary, policy };
  }

  simulate(plan: Plan): SimulateResult {
    const preview = this.preview(plan);
    const simulation = simulate(plan, this.policy, this.ledger.getSnapshot().dailySpend);
    this.audit.append(
      receipt("simulated", plan.id, simulation.messages.join(" "), {
        totalCost: plan.totalCost,
        currency: plan.currency,
      }),
    );
    if (preview.policy.ok) {
      const record = this.approvals.request(plan, preview.policy);
      if (record.state === "pending") {
        this.audit.append(receipt("approval_requested", plan.id, preview.policy.reasons.join(" ")));
      }
    }
    return { policy: preview.policy, simulation };
  }

  approve(planId: string, decidedBy = "operator"): void {
    this.approvals.decide(planId, true, decidedBy);
    this.audit.append(receipt("approved", planId, `Approved by ${decidedBy}.`));
  }

  reject(planId: string, decidedBy = "operator", note?: string): void {
    this.approvals.decide(planId, false, decidedBy, note);
    this.audit.append(receipt("rejected", planId, note ?? `Rejected by ${decidedBy}.`));
  }

  execute(plan: Plan, simulation: Simulation, policy: PolicyDecision): RunResult {
    if (!policy.ok || !simulation.ok) {
      const message = !policy.ok
        ? `Blocked by policy: ${policy.issues.join(" ")}`
        : `Simulation failed: ${simulation.messages.join(" ")}`;
      return { executed: false, message, simulation, policy };
    }
    if (!this.approvals.canExecute(plan.id)) {
      return {
        executed: false,
        message: `Waiting for approval. ${money(plan.totalCost, plan.currency)} is at or above the auto-approve threshold of ${money(this.policy.autoApproveBelow, this.policy.currency)}.`,
        simulation,
        policy,
      };
    }
    this.ledger.execute(plan);
    this.audit.append(
      receipt("executed", plan.id, "Plan executed after policy, simulation and approval checks.", {
        totalCost: plan.totalCost,
        currency: plan.currency,
      }),
    );
    return {
      executed: true,
      message: `Executed ${money(plan.totalCost, plan.currency)} for plan ${plan.id}.`,
      simulation,
      policy,
    };
  }

  run(plan: Plan): RunResult {
    const { policy, simulation } = this.simulate(plan);
    return this.execute(plan, simulation, policy);
  }
}
