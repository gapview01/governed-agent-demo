import { LedgerSnapshot, Plan } from "./types.js";

export class Ledger {
  private snapshot: LedgerSnapshot;

  constructor(initial?: LedgerSnapshot) {
    this.snapshot = initial ?? { dailySpend: 0, entries: [] };
  }

  getSnapshot(): LedgerSnapshot {
    return {
      dailySpend: this.snapshot.dailySpend,
      entries: [...this.snapshot.entries],
    };
  }

  execute(plan: Plan): LedgerSnapshot {
    this.snapshot.dailySpend += plan.totalCost;
    this.snapshot.entries.push({
      planId: plan.id,
      amount: plan.totalCost,
      memo: plan.steps.map((step) => step.memo).join("; "),
    });
    return this.getSnapshot();
  }
}
