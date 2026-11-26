import { ApprovalState, Plan, PolicyDecision } from "./types.js";

export interface ApprovalRecord {
  planId: string;
  state: ApprovalState;
  decidedBy?: string;
  decidedAt?: string;
  note?: string;
}

export class ApprovalDesk {
  private readonly records = new Map<string, ApprovalRecord>();

  request(plan: Plan, decision: PolicyDecision): ApprovalRecord {
    const existing = this.records.get(plan.id);
    if (existing && existing.state !== "pending") {
      return existing;
    }
    if (!decision.requiresApproval) {
      const record: ApprovalRecord = { planId: plan.id, state: "not_required" };
      this.records.set(plan.id, record);
      return record;
    }
    const record: ApprovalRecord = { planId: plan.id, state: "pending" };
    this.records.set(plan.id, record);
    return record;
  }

  decide(planId: string, approved: boolean, decidedBy: string, note?: string): ApprovalRecord {
    const current = this.records.get(planId);
    if (!current) {
      throw new Error(`No approval request exists for ${planId}.`);
    }
    if (current.state === "not_required") {
      throw new Error(`Plan ${planId} does not require approval.`);
    }
    const record: ApprovalRecord = {
      planId,
      state: approved ? "approved" : "rejected",
      decidedBy,
      decidedAt: new Date().toISOString(),
      note,
    };
    this.records.set(planId, record);
    return record;
  }

  get(planId: string): ApprovalRecord | undefined {
    return this.records.get(planId);
  }

  canExecute(planId: string): boolean {
    const record = this.records.get(planId);
    if (!record) return false;
    return record.state === "not_required" || record.state === "approved";
  }
}
